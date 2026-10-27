from decimal import Decimal
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

