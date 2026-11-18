import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.models import Order
from .models import PaymentTransaction
from .services import confirm_verified_payment


STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300


def _amount_in_smallest_unit(amount: Decimal) -> int:
    return int((Decimal(str(amount)) * Decimal("100")).quantize(Decimal("1")))


def _create_stripe_checkout(order: Order, transaction: PaymentTransaction, user) -> str:
    secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    amount = _amount_in_smallest_unit(order.total)
    items = list(order.items.all())
    title_summary = ", ".join(item.product_title for item in items[:3]) or f"Order {order.id}"
    if len(items) > 3:
        title_summary += f" (+{len(items) - 3} more)"

    success_url = f"{settings.FRONTEND_URL}/payment-result?order={order.id}&session_id={{CHECKOUT_SESSION_ID}}"
    form_data = {
        "mode": "payment",
        "customer_email": user.email,
        "success_url": success_url,
        "cancel_url": f"{settings.FRONTEND_URL}/checkout/{order.id}",
        "client_reference_id": str(transaction.provider_reference),
        "metadata[order_id]": str(order.id),
        "metadata[transaction_id]": str(transaction.id),
        "line_items[0][price_data][currency]": order.currency.lower(),
        "line_items[0][price_data][unit_amount]": str(amount),
        "line_items[0][price_data][product_data][name]": f"sameulshajid.art — {title_summary}"[:180],
        "line_items[0][quantity]": "1",
    }
    request = urllib.request.Request(
        "https://api.stripe.com/v1/checkout/sessions",
        data=urllib.parse.urlencode(form_data).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))["url"]


def _stripe_signature_is_valid(payload: bytes, signature_header: str, webhook_secret: str) -> bool:
    """Verify Stripe's signed payload and reject stale webhook deliveries."""
    try:
        parts = {}
        signatures = []
        for item in signature_header.split(","):
            key, value = item.split("=", 1)
            if key == "v1":
                signatures.append(value)
            else:
                parts[key] = value
        timestamp = int(parts["t"])
    except (KeyError, TypeError, ValueError):
        return False

    if abs(time.time() - timestamp) > STRIPE_WEBHOOK_TOLERANCE_SECONDS:
        return False

    signed_payload = str(timestamp).encode("utf-8") + b"." + payload
    expected = hmac.new(webhook_secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, signature) for signature in signatures)


class CreateStripeCheckoutSessionView(APIView):
    def post(self, request):
        secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
        if not secret_key:
            return Response(
                {"detail": "Stripe checkout is not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        order = get_object_or_404(
            Order.objects.prefetch_related("items"),
            pk=request.data.get("order_id"),
            user=request.user,
            status=Order.Status.PENDING_PAYMENT,
        )
        transaction = PaymentTransaction.objects.filter(
            order=order,
            provider="STRIPE",
            status__in=(PaymentTransaction.Status.CREATED, PaymentTransaction.Status.PENDING),
        ).first()
        if not transaction:
            transaction = PaymentTransaction.objects.create(
                order=order,
                provider="STRIPE",
                amount=order.total,
                currency=order.currency,
                status=PaymentTransaction.Status.PENDING,
            )

        try:
            checkout_url = _create_stripe_checkout(order, transaction, request.user)
        except urllib.error.HTTPError:
            return Response(
                {"detail": "Stripe could not create a checkout session. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except (urllib.error.URLError, TimeoutError):
            return Response(
                {"detail": "Stripe is temporarily unavailable. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"transaction_id": transaction.id, "provider": "STRIPE", "checkout_url": checkout_url})


class StripeWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
        if not webhook_secret:
            return Response(
                {"detail": "Stripe webhook is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not _stripe_signature_is_valid(request.body, request.META.get("HTTP_STRIPE_SIGNATURE", ""), webhook_secret):
            return Response({"detail": "Invalid Stripe webhook signature."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            payload = json.loads(request.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return Response({"detail": "Invalid Stripe webhook payload."}, status=status.HTTP_400_BAD_REQUEST)

        event_type = payload.get("type")
        session = (payload.get("data") or {}).get("object") or {}
        reference = session.get("client_reference_id")
        transaction = PaymentTransaction.objects.select_related("order").filter(
            provider="STRIPE", provider_reference=reference
        ).first()

        if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
            if transaction and self._matches_transaction(session, transaction):
                confirm_verified_payment(transaction)
        elif (
            event_type == "checkout.session.async_payment_failed"
            and transaction
            and transaction.status != PaymentTransaction.Status.SUCCEEDED
        ):
            transaction.status = PaymentTransaction.Status.FAILED
            transaction.save(update_fields=("status",))

        return Response({"received": True}, status=status.HTTP_200_OK)

    @staticmethod
    def _matches_transaction(session: dict, transaction: PaymentTransaction) -> bool:
        metadata = session.get("metadata") or {}
        return (
            session.get("payment_status") == "paid"
            and metadata.get("order_id") == str(transaction.order_id)
            and metadata.get("transaction_id") == str(transaction.id)
            and session.get("amount_total") == _amount_in_smallest_unit(transaction.amount)
            and str(session.get("currency", "")).upper() == transaction.currency.upper()
        )
