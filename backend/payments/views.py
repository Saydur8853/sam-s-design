import hashlib
import hmac
import json
import os
import urllib.parse
import urllib.request
from decimal import Decimal

from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.html import escape
from dotenv import load_dotenv
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.models import Order
from .models import PaymentTransaction
from .services import confirm_verified_payment


def _create_lemonsqueezy_checkout(order: Order, transaction: PaymentTransaction, user) -> str:
    """
    Creates a live Lemon Squeezy Hosted Checkout session supporting International
    Visa, Mastercard, Amex, PayPal, Apple Pay, and Google Pay.
    """
    api_key = os.getenv("LEMONSQUEEZY_API_KEY", "").strip()
    store_id = os.getenv("LEMONSQUEEZY_STORE_ID", "").strip()
    variant_id = os.getenv("LEMONSQUEEZY_VARIANT_ID", "").strip()

    items = list(order.items.all())
    title_summary = ", ".join(item.product_title for item in items[:3]) or f"Order {order.id}"
    if len(items) > 3:
        title_summary += f" (+{len(items) - 3} more)"

    amount_cents = int((Decimal(str(order.total)) * Decimal("100")).quantize(Decimal("1")))
    redirect_url = f"{settings.FRONTEND_URL}/payment-result?order={order.id}"
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email.split("@")[0]

    payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "custom_price": amount_cents,
                "product_options": {
                    "name": f"sameulshajid.art — {title_summary}"[:180],
                    "description": "High-resolution original digital artwork download.",
                    "redirect_url": redirect_url,
                    "receipt_button_text": "Download Original Files",
                    "receipt_link_url": redirect_url,
                },
                "checkout_options": {
                    "embed": False,
                    "media": False,
                    "logo": True,
                    "dark": True,
                },
                "checkout_data": {
                    "email": user.email,
                    "name": full_name,
                    "custom": {
                        "order_id": str(order.id),
                        "transaction_id": str(transaction.id),
                        "reference": str(transaction.provider_reference),
                    },
                },
            },
            "relationships": {
                "store": {"data": {"type": "stores", "id": str(store_id)}},
                "variant": {"data": {"type": "variants", "id": str(variant_id)}},
            },
        }
    }

    req = urllib.request.Request(
        "https://api.lemonsqueezy.com/v1/checkouts",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "sameulshajid.art/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = json.loads(resp.read().decode("utf-8"))
        return body["data"]["attributes"]["url"]


def _create_stripe_checkout(order: Order, transaction: PaymentTransaction, user) -> str:
    """
    Creates a live Stripe Checkout Session supporting Visa, Mastercard, Amex, Apple Pay, Google Pay.
    """
    secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    amount_cents = int((Decimal(str(order.total)) * Decimal("100")).quantize(Decimal("1")))
    items = list(order.items.all())
    title_summary = ", ".join(item.product_title for item in items[:3]) or f"Order {order.id}"

    form_data = {
        "mode": "payment",
        "customer_email": user.email,
        "success_url": f"{settings.FRONTEND_URL}/payment-result?order={order.id}",
        "cancel_url": f"{settings.FRONTEND_URL}/checkout/{order.id}",
        "client_reference_id": str(transaction.provider_reference),
        "metadata[order_id]": str(order.id),
        "metadata[reference]": str(transaction.provider_reference),
        "line_items[0][price_data][currency]": order.currency.lower(),
        "line_items[0][price_data][unit_amount]": str(amount_cents),
        "line_items[0][price_data][product_data][name]": f"sameulshajid.art — {title_summary}"[:180],
        "line_items[0][quantity]": "1",
    }

    req = urllib.request.Request(
        "https://api.stripe.com/v1/checkout/sessions",
        data=urllib.parse.urlencode(form_data).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = json.loads(resp.read().decode("utf-8"))
        return body["url"]


class CreateDemoPaymentSessionView(APIView):
    def post(self, request):
        load_dotenv(settings.BASE_DIR.parent / ".env", override=True)
        order = get_object_or_404(
            Order.objects.prefetch_related("items"),
            pk=request.data.get("order_id"),
            user=request.user,
            status=Order.Status.PENDING_PAYMENT,
        )
        transaction = PaymentTransaction.objects.filter(
            order=order,
            status__in=(PaymentTransaction.Status.CREATED, PaymentTransaction.Status.PENDING),
        ).first()
        if not transaction:
            transaction = PaymentTransaction.objects.create(
                order=order,
                amount=order.total,
                currency=order.currency,
                status=PaymentTransaction.Status.PENDING,
            )

        ls_key = os.getenv("LEMONSQUEEZY_API_KEY", "").strip()
        ls_store = os.getenv("LEMONSQUEEZY_STORE_ID", "").strip()
        ls_variant = os.getenv("LEMONSQUEEZY_VARIANT_ID", "").strip()
        stripe_key = os.getenv("STRIPE_SECRET_KEY", "").strip()

        if ls_key and ls_store and ls_variant:
            try:
                checkout_url = _create_lemonsqueezy_checkout(order, transaction, request.user)
                transaction.provider = "LEMONSQUEEZY"
                transaction.save(update_fields=("provider",))
                return Response(
                    {"transaction_id": transaction.id, "provider": "LEMONSQUEEZY", "checkout_url": checkout_url}
                )
            except Exception as exc:
                return Response(
                    {"detail": f"Lemon Squeezy gateway error: {str(exc)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if stripe_key:
            try:
                checkout_url = _create_stripe_checkout(order, transaction, request.user)
                transaction.provider = "STRIPE"
                transaction.save(update_fields=("provider",))
                return Response({"transaction_id": transaction.id, "provider": "STRIPE", "checkout_url": checkout_url})
            except Exception as exc:
                return Response(
                    {"detail": f"Stripe gateway error: {str(exc)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not settings.DEBUG:
            return Response(
                {"detail": "International payment gateway is not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        gateway_path = reverse("demo-gateway", args=(transaction.provider_reference,))
        return Response(
            {
                "transaction_id": transaction.id,
                "provider": "DEMO",
                "checkout_url": request.build_absolute_uri(gateway_path),
            }
        )


class LemonSqueezyWebhookView(APIView):
    """
    Receives and verifies HMAC-SHA256 webhooks from Lemon Squeezy ('order_created')
    and automatically unlocks purchased files via confirm_verified_payment().
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        load_dotenv(settings.BASE_DIR.parent / ".env", override=True)
        webhook_secret = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET", "").strip()
        signature = request.META.get("HTTP_X_SIGNATURE", "")

        if webhook_secret:
            digest = hmac.new(webhook_secret.encode("utf-8"), request.body, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(digest, signature):
                return Response({"detail": "Invalid Lemon Squeezy webhook signature."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            payload = json.loads(request.body.decode("utf-8"))
        except Exception:
            return Response({"detail": "Invalid JSON payload."}, status=status.HTTP_400_BAD_REQUEST)

        meta = payload.get("meta") or {}
        event_name = meta.get("event_name")
        custom_data = meta.get("custom_data") or {}
        attrs = (payload.get("data") or {}).get("attributes") or {}

        if event_name == "order_created" and attrs.get("status") == "paid":
            reference = custom_data.get("reference")
            order_id = custom_data.get("order_id")
            transaction = None
            if reference:
                transaction = PaymentTransaction.objects.filter(provider_reference=reference).first()
            if not transaction and order_id:
                transaction = PaymentTransaction.objects.filter(order_id=order_id).order_by("-created_at").first()
            if transaction:
                confirm_verified_payment(transaction)

        return Response({"received": True}, status=status.HTTP_200_OK)


class StripeWebhookView(APIView):
    """
    Receives and verifies Stripe webhooks ('checkout.session.completed')
    and automatically unlocks purchased files via confirm_verified_payment().
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        load_dotenv(settings.BASE_DIR.parent / ".env", override=True)
        webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

        if webhook_secret:
            parts = dict(item.split("=", 1) for item in sig_header.split(",") if "=" in item)
            timestamp = parts.get("t", "")
            v1_sig = parts.get("v1", "")
            signed_payload = f"{timestamp}.{request.body.decode('utf-8')}".encode("utf-8")
            expected = hmac.new(webhook_secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
            if not v1_sig or not hmac.compare_digest(expected, v1_sig):
                return Response({"detail": "Invalid Stripe webhook signature."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            payload = json.loads(request.body.decode("utf-8"))
        except Exception:
            return Response({"detail": "Invalid JSON."}, status=status.HTTP_400_BAD_REQUEST)

        if payload.get("type") == "checkout.session.completed":
            session_obj = (payload.get("data") or {}).get("object") or {}
            metadata = session_obj.get("metadata") or {}
            reference = metadata.get("reference") or session_obj.get("client_reference_id")
            if reference:
                transaction = PaymentTransaction.objects.filter(provider_reference=reference).first()
                if transaction:
                    confirm_verified_payment(transaction)

        return Response({"received": True}, status=status.HTTP_200_OK)


class DemoGatewayView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, reference):
        if not settings.DEBUG:
            return HttpResponseNotFound()
        transaction = get_object_or_404(
            PaymentTransaction.objects.select_related("order__user").prefetch_related("order__items"),
            provider_reference=reference,
        )
        action = reverse("demo-gateway-confirm", args=(reference,))
        webhook_url = f"{settings.FRONTEND_URL}/api/v1/payments/webhooks/lemonsqueezy/"
        html = f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>International Card Checkout — sameulshajid.art</title>
        <style>
          * {{ box-sizing: border-box; }}
          body {{ margin:0; background:#11110f; color:#f2efe8; font-family:'DM Sans',Arial,sans-serif; display:grid; min-height:100vh; place-items:center; padding:24px; }}
          main {{ width:min(480px,100%); background:#1a1a17; padding:34px 30px; border:1px solid rgba(242,239,232,.16); border-radius:16px; box-shadow:0 28px 70px rgba(0,0,0,.65); }}
          .badge {{ display:inline-block; padding:4px 10px; background:#c8f257; color:#171714; font-size:10px; font-weight:800; letter-spacing:.12em; border-radius:4px; }}
          h1 {{ margin:14px 0 6px; font-size:26px; letter-spacing:-.03em; }}
          .sub {{ margin:0 0 20px; color:#a6a298; font-size:13px; line-height:1.5; }}
          .amount-box {{ display:flex; justify-content:space-between; align-items:center; padding:16px 18px; background:#11110f; border:1px solid rgba(242,239,232,.13); border-radius:10px; margin-bottom:18px; }}
          .amount-box strong {{ font-size:28px; font-weight:800; color:#c8f257; }}
          .cards-row {{ display:flex; gap:7px; flex-wrap:wrap; margin-bottom:16px; }}
          .card-pill {{ padding:5px 10px; background:#22221e; border:1px solid rgba(242,239,232,.15); border-radius:6px; font-size:11px; font-weight:700; color:#f2efe8; }}
          .field {{ margin-bottom:12px; }}
          .field label {{ display:block; font-size:11px; font-weight:700; color:#a6a298; margin-bottom:5px; text-transform:uppercase; letter-spacing:.08em; }}
          .field input {{ width:100%; padding:12px 13px; background:#11110f; border:1px solid rgba(242,239,232,.2); border-radius:8px; color:#f2efe8; font-size:14px; }}
          .row2 {{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }}
          button {{ width:100%; padding:15px; border:0; border-radius:8px; background:#ff5b35; color:white; font-weight:800; font-size:15px; cursor:pointer; margin-top:6px; }}
          button:hover {{ background:#ff6f4d; }}
          details {{ margin-top:20px; padding:14px; background:#11110f; border:1px solid rgba(200,242,87,.25); border-radius:10px; font-size:12px; color:#a6a298; line-height:1.6; }}
          summary {{ color:#c8f257; font-weight:700; cursor:pointer; }}
          code {{ display:block; padding:8px; margin:6px 0; background:#1a1a17; border-radius:6px; color:#f2efe8; font-size:11px; word-break:break-all; }}
        </style></head>
        <body>
          <main>
            <span class="badge">INTERNATIONAL CHECKOUT (SANDBOX MODE)</span>
            <h1>Pay with Card</h1>
            <p class="sub">Supports Visa, Mastercard, American Express, PayPal &amp; Apple Pay worldwide.</p>
            <div class="amount-box">
              <span>Total due ({escape(transaction.order.user.email)})</span>
              <strong>{escape(transaction.currency)} {transaction.amount}</strong>
            </div>
            <div class="cards-row">
              <span class="card-pill">💳 VISA</span>
              <span class="card-pill">💳 Mastercard</span>
              <span class="card-pill">💳 AMEX</span>
              <span class="card-pill">🅿 PayPal</span>
              <span class="card-pill"> Pay</span>
            </div>
            <form method="post" action="{action}">
              <div class="field">
                <label>Card number</label>
                <input type="text" value="4242 •••• •••• 4242" readonly>
              </div>
              <div class="row2">
                <div class="field"><label>Expiry</label><input type="text" value="08 / 29" readonly></div>
                <div class="field"><label>CVC / CID (Amex)</label><input type="text" value="884" readonly></div>
              </div>
              <button type="submit">Pay {escape(transaction.currency)} {transaction.amount} Now →</button>
            </form>
            <details>
              <summary>⚡ How to switch from Sandbox to Live Lemon Squeezy</summary>
              <p style="margin:8px 0 0;">1. Create a free store at <strong>lemonsqueezy.com</strong> (works from Bangladesh with Passport/NID &amp; Bank/Payoneer payout).</p>
              <p style="margin:6px 0;">2. Add a webhook pointing to:<code>{escape(webhook_url)}</code></p>
              <p style="margin:6px 0 0;">3. Paste <strong>LEMONSQUEEZY_API_KEY</strong>, <strong>LEMONSQUEEZY_STORE_ID</strong>, <strong>LEMONSQUEEZY_VARIANT_ID</strong>, and <strong>LEMONSQUEEZY_WEBHOOK_SECRET</strong> into your <strong>.env</strong> file.</p>
            </details>
          </main>
        </body></html>"""
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
