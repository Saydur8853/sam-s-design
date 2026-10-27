import io
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.models import Order
from .models import DownloadEntitlement, DownloadLog
from .serializers import DownloadEntitlementSerializer


class DownloadListView(generics.ListAPIView):
    serializer_class = DownloadEntitlementSerializer

    def get_queryset(self):
        return (
            DownloadEntitlement.objects.select_related("order_item__order", "product_file")
            .prefetch_related("logs")
            .filter(user=self.request.user, is_active=True, order_item__order__status=Order.Status.PAID)
        )


class ProtectedDownloadView(APIView):
    def get(self, request, entitlement_id):
        entitlement = get_object_or_404(
            DownloadEntitlement.objects.select_related("order_item__order", "product_file"),
            pk=entitlement_id,
            user=request.user,
            is_active=True,
            order_item__order__status=Order.Status.PAID,
        )

        token = request.query_params.get("token")
        if token:
            signer = TimestampSigner(salt="sameulshajid.download")
            try:
                unsigned = signer.unsign(token, max_age=600)
                if unsigned != f"{entitlement.pk}:{request.user.id}":
                    return Response({"detail": "Invalid download signature."}, status=status.HTTP_403_FORBIDDEN)
            except SignatureExpired:
                return Response(
                    {"detail": "Download session expired (10-minute security window). Please refresh the page."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            except BadSignature:
                return Response({"detail": "Invalid download token."}, status=status.HTTP_403_FORBIDDEN)

        used_count = entitlement.logs.count()
        if used_count >= entitlement.max_downloads:
            return Response(
                {"detail": f"Download limit ({entitlement.max_downloads} downloads) reached for this order."},
                status=status.HTTP_403_FORBIDDEN,
            )

        root = Path(settings.PRIVATE_MEDIA_ROOT).resolve()
        file_path = (root / entitlement.product_file.private_path).resolve()
        if root not in file_path.parents or not file_path.is_file():
            raise Http404("The purchased file is unavailable.")

        ip_addr = request.META.get("REMOTE_ADDR")
        DownloadLog.objects.create(
            entitlement=entitlement,
            ip_address=ip_addr,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
        )

        # Buyer Fingerprinting: embed LICENSE-CERTIFICATE.txt inside ZIP archives
        if file_path.suffix.lower() == ".zip":
            try:
                buf = io.BytesIO(file_path.read_bytes())
                with zipfile.ZipFile(buf, "a", zipfile.ZIP_DEFLATED) as zf:
                    cert_text = (
                        f"sameulshajid.art — Official License & Buyer Fingerprint\n"
                        f"=======================================================\n"
                        f"Product: {entitlement.order_item.product_title}\n"
                        f"Licensed To: {request.user.email} (User ID #{request.user.id})\n"
                        f"Order ID: {entitlement.order_item.order_id}\n"
                        f"Downloaded At (UTC): {timezone.now().isoformat()}\n"
                        f"Download IP: {ip_addr or 'recorded'}\n"
                        f"Download Count: {used_count + 1} of {entitlement.max_downloads}\n\n"
                        f"Redistribution, resale, or public sharing of this original file is strictly prohibited.\n"
                    )
                    zf.writestr("LICENSE-CERTIFICATE.txt", cert_text)
                buf.seek(0)
                response = FileResponse(
                    buf,
                    as_attachment=True,
                    filename=entitlement.product_file.display_name,
                    content_type=entitlement.product_file.mime_type,
                )
            except Exception:
                response = FileResponse(
                    file_path.open("rb"),
                    as_attachment=True,
                    filename=entitlement.product_file.display_name,
                    content_type=entitlement.product_file.mime_type,
                )
        else:
            response = FileResponse(
                file_path.open("rb"),
                as_attachment=True,
                filename=entitlement.product_file.display_name,
                content_type=entitlement.product_file.mime_type,
            )

        response["X-License-Holder"] = request.user.email
        response["X-Order-ID"] = str(entitlement.order_item.order_id)
        response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        return response


