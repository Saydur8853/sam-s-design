import hashlib
import hmac
import json
import time
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from catalog.models import Category, Product, ProductFile
from downloads.models import DownloadEntitlement
from orders.models import Order
from .models import PaymentTransaction
from .services import confirm_verified_payment


class ReadyMadePurchaseFlowTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="buyer@example.com", password="Long-test-pass-8472")
        category = Category.objects.create(name="Posters", slug="posters")
        self.product = Product.objects.create(category=category, title="Original Poster", slug="original-poster", short_description="A poster", description="Details", price=Decimal("42.00"), currency="USD", product_type=Product.ProductType.POSTER, preview_url="/demo/poster.svg")
        ProductFile.objects.create(product=self.product, display_name="Original.svg", private_path="products/original.svg", mime_type="image/svg+xml")

    def test_anonymous_customer_cannot_add_to_cart(self):
        response = self.client.post("/api/v1/cart/items/", {"product_id": self.product.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_verified_payment_is_idempotent_and_unlocks_download(self):
        self.client.force_authenticate(self.user)
        response = self.client.post("/api/v1/orders/buy-now/", {"product_id": self.product.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.total, Decimal("42.00"))
        transaction = PaymentTransaction.objects.create(order=order, amount=order.total, currency=order.currency, status=PaymentTransaction.Status.PENDING)
        confirm_verified_payment(transaction)
        confirm_verified_payment(transaction)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertEqual(DownloadEntitlement.objects.filter(user=self.user).count(), 1)

    def test_unpaid_order_has_no_download_entitlement(self):
        self.client.force_authenticate(self.user)
        self.client.post("/api/v1/orders/buy-now/", {"product_id": self.product.id}, format="json")
        self.assertFalse(DownloadEntitlement.objects.filter(user=self.user).exists())

    def test_valid_stripe_webhook_unlocks_the_matching_paid_order(self):
        order = Order.objects.create(user=self.user, total=Decimal("42.00"), currency="USD")
        transaction = PaymentTransaction.objects.create(
            order=order,
            provider="STRIPE",
            amount=order.total,
            currency=order.currency,
            status=PaymentTransaction.Status.PENDING,
        )
        ProductFile.objects.create(product=self.product, display_name="Another.svg", private_path="products/another.svg")
        order.items.create(product=self.product, product_title=self.product.title, unit_price=order.total, quantity=1)
        payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": str(transaction.provider_reference),
                    "payment_status": "paid",
                    "amount_total": 4200,
                    "currency": "usd",
                    "metadata": {"order_id": str(order.id), "transaction_id": str(transaction.id)},
                }
            },
        }
        raw_body = json.dumps(payload).encode("utf-8")
        secret = "whsec_test_secret"
        timestamp = str(int(time.time()))
        signature = hmac.new(secret.encode("utf-8"), timestamp.encode("utf-8") + b"." + raw_body, hashlib.sha256).hexdigest()

        with patch.dict("os.environ", {"STRIPE_WEBHOOK_SECRET": secret}, clear=False):
            response = self.client.post(
                "/api/v1/payments/webhooks/stripe/",
                data=raw_body,
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE=f"t={timestamp},v1={signature}",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertEqual(DownloadEntitlement.objects.filter(user=self.user).count(), 2)

    def test_stripe_webhook_rejects_an_amount_mismatch(self):
        order = Order.objects.create(user=self.user, total=Decimal("42.00"), currency="USD")
        transaction = PaymentTransaction.objects.create(
            order=order,
            provider="STRIPE",
            amount=order.total,
            currency=order.currency,
            status=PaymentTransaction.Status.PENDING,
        )
        payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": str(transaction.provider_reference),
                    "payment_status": "paid",
                    "amount_total": 1,
                    "currency": "usd",
                    "metadata": {"order_id": str(order.id), "transaction_id": str(transaction.id)},
                }
            },
        }
        raw_body = json.dumps(payload).encode("utf-8")
        secret = "whsec_test_secret"
        timestamp = str(int(time.time()))
        signature = hmac.new(secret.encode("utf-8"), timestamp.encode("utf-8") + b"." + raw_body, hashlib.sha256).hexdigest()

        with patch.dict("os.environ", {"STRIPE_WEBHOOK_SECRET": secret}, clear=False):
            response = self.client.post(
                "/api/v1/payments/webhooks/stripe/",
                data=raw_body,
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE=f"t={timestamp},v1={signature}",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING_PAYMENT)

