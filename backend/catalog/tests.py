from decimal import Decimal
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Category, Product


class PublicCatalogTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Posters", slug="posters")
        self.product = Product.objects.create(
            category=self.category, title="Test Poster", slug="test-poster",
            short_description="A test poster", description="Description", price=Decimal("25.00"),
            product_type=Product.ProductType.POSTER, preview_url="/demo/test.svg",
        )

    def test_product_list_is_public(self):
        response = self.client.get("/api/v1/catalog/products/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "test-poster")

    def test_inactive_products_are_hidden(self):
        self.product.is_active = False
        self.product.save()
        response = self.client.get("/api/v1/catalog/products/")
        self.assertEqual(response.data["results"], [])


class StudioCatalogTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Templates", slug="templates")
        users = get_user_model()
        self.designer = users.objects.create_user(email="designer@studio.test", password="Long-test-pass-8472", role="DESIGNER")
        self.customer = users.objects.create_user(email="customer@studio.test", password="Long-test-pass-8472")

    def test_only_designer_can_manage_products_and_upload_files(self):
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get("/api/v1/catalog/studio/products/").status_code, status.HTTP_403_FORBIDDEN)

        with tempfile.TemporaryDirectory() as media, tempfile.TemporaryDirectory() as private:
            self.client.force_authenticate(self.designer)
            with self.settings(MEDIA_ROOT=media, PRIVATE_MEDIA_ROOT=private):
                response = self.client.post(
                    "/api/v1/catalog/studio/products/",
                    {
                        "title": "Studio Poster", "category_id": self.category.pk,
                        "short_description": "A studio test", "description": "Full description",
                        "price": "20.00", "currency": "USD", "product_type": "POSTER",
                        "license_type": "COMMERCIAL", "file_formats": '["PSD", "PNG"]',
                        "is_featured": "false", "is_active": "true",
                        "preview_file": SimpleUploadedFile("preview.png", b"preview-data", content_type="image/png"),
                        "source_file": SimpleUploadedFile("source.zip", b"source-data", content_type="application/zip"),
                    },
                    format="multipart",
                )
                self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
                self.assertTrue(response.data["preview_url"].startswith("/media/product_previews/"))
                self.assertEqual(len(response.data["download_files"]), 1)
                self.assertEqual(response.data["file_formats"], ["PSD", "PNG"])

