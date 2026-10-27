from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.html import escape
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from orders.models import Order
from .models import PaymentTransaction
from .services import confirm_verified_payment


class CreateDemoPaymentSessionView(APIView):
    def post(self, request):
        if not settings.DEBUG:
            return Response({"detail": "Demo gateway is disabled."}, status=status.HTTP_404_NOT_FOUND)
        order = get_object_or_404(Order, pk=request.data.get("order_id"), user=request.user, status=Order.Status.PENDING_PAYMENT)
        transaction = PaymentTransaction.objects.filter(order=order, status__in=(PaymentTransaction.Status.CREATED, PaymentTransaction.Status.PENDING)).first()
        if not transaction:
            transaction = PaymentTransaction.objects.create(order=order, amount=order.total, currency=order.currency, status=PaymentTransaction.Status.PENDING)
        gateway_path = reverse("demo-gateway", args=(transaction.provider_reference,))
        return Response({"transaction_id": transaction.id, "checkout_url": request.build_absolute_uri(gateway_path)})


class DemoGatewayView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, reference):
        if not settings.DEBUG:
            return HttpResponseNotFound()
        transaction = get_object_or_404(PaymentTransaction.objects.select_related("order"), provider_reference=reference)
        action = reverse("demo-gateway-confirm", args=(reference,))
        html = f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Demo Payment Gateway</title><style>body{{margin:0;background:#171714;color:#f2efe8;font-family:Arial;display:grid;min-height:100vh;place-items:center}}main{{width:min(430px,calc(100% - 40px));background:#262622;padding:42px;border:1px solid #444}}small{{color:#c8f257;letter-spacing:.15em}}h1{{font-size:34px}}.amount{{font-size:44px;margin:28px 0}}button{{width:100%;padding:17px;border:0;background:#ff5b35;color:white;font-weight:700;font-size:16px;cursor:pointer}}p{{color:#aaa;line-height:1.6}}code{{font-size:11px;color:#888}}</style></head><body><main><small>SAMEULSHAJID.ART · DEMO GATEWAY</small><h1>Complete test payment</h1><p>This hosted screen simulates a payment provider. No real money or card details are used.</p><div class="amount">{escape(transaction.currency)} {transaction.amount}</div><form method="post" action="{action}"><button type="submit">Confirm successful payment</button></form><p><code>Reference: {transaction.provider_reference}</code></p></main></body></html>'''
        return HttpResponse(html)


class DemoGatewayConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, reference):
        if not settings.DEBUG:
            return HttpResponseNotFound()
        transaction = get_object_or_404(PaymentTransaction, provider_reference=reference)
        confirm_verified_payment(transaction)
        return HttpResponseRedirect(f"{settings.FRONTEND_URL}/payment-result?order={transaction.order_id}")

