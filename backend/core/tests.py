import io
import zipfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


class HealthTests(APITestCase):
    def test_health_is_public(self):
        response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")

    def test_sitemap_xml_is_public_and_lists_trust_pages(self):
        response = self.client.get("/sitemap.xml")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.content.decode("utf-8")
        self.assertIn("https://sameulshajid.art/privacy", body)
        self.assertIn("https://sameulshajid.art/terms", body)
        self.assertIn("https://sameulshajid.art/about", body)

    def test_artwork_middleware_allows_pinterest_and_blocks_unknown_hotlinkers(self):
        # Pinterest crawler and referer should be allowed on media paths
        pin_bot = self.client.get(
            "/media/product_previews/sample.png",
            HTTP_USER_AGENT="Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)",
            HTTP_SEC_FETCH_SITE="cross-site",
        )
        self.assertNotEqual(pin_bot.status_code, status.HTTP_403_FORBIDDEN)

        pin_ref = self.client.get(
            "/media/product_previews/sample.png",
            HTTP_REFERER="https://www.pinterest.com/pin/create/button/",
            HTTP_SEC_FETCH_SITE="cross-site",
        )
        self.assertNotEqual(pin_ref.status_code, status.HTTP_403_FORBIDDEN)

        # Untrusted external hotlinker should still be blocked with 403 Forbidden
        hotlink = self.client.get(
            "/media/product_previews/sample.png",
            HTTP_REFERER="https://scraper-spam-example.xyz/steal",
            HTTP_SEC_FETCH_SITE="cross-site",
        )
        self.assertEqual(hotlink.status_code, status.HTTP_403_FORBIDDEN)



class StudioUserListTests(APITestCase):
    def setUp(self):
        users = get_user_model()
        self.designer = users.objects.create_user(
            email="designer@studio.test", password="Long-test-pass-8472", role="DESIGNER"
        )
        self.customer = users.objects.create_user(
            email="customer@studio.test", password="Long-test-pass-8472", first_name="Sam"
        )

    def test_designer_can_list_registered_users(self):
        self.client.force_authenticate(self.designer)
        response = self.client.get("/api/v1/studio/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({item["email"] for item in response.data}, {self.designer.email, self.customer.email})
        customer = next(item for item in response.data if item["email"] == self.customer.email)
        self.assertEqual(customer["name"], "Sam")
        self.assertEqual(customer["role"], "CUSTOMER")

    def test_customer_cannot_list_registered_users(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get("/api/v1/studio/users/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("core.studio_views._build_postgresql_sql_dump", return_value="-- test backup\n")
    def test_designer_downloads_a_valid_zip_backup(self, _mock_dump):
        self.client.force_authenticate(self.designer)
        response = self.client.get("/api/v1/studio/db-backup/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/zip")
        self.assertIn("attachment;", response["Content-Disposition"])
        payload = b"".join(response.streaming_content)
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            self.assertEqual(set(archive.namelist()), {"postgres_backup.sql", "database_dump.json"})
            self.assertEqual(archive.read("postgres_backup.sql"), b"-- test backup\n")

