from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
import tempfile
from rest_framework import status
from rest_framework.test import APITestCase
from .models import CustomDesignRequest


class ConversationPermissionTests(APITestCase):
    def setUp(self):
        users = get_user_model()
        self.customer = users.objects.create_user(email="customer@example.com", password="Long-test-pass-8472")
        self.other = users.objects.create_user(email="other@example.com", password="Long-test-pass-8472")
        self.designer = users.objects.create_user(email="designer@example.com", password="Long-test-pass-8472", role="DESIGNER")
        self.client.force_authenticate(self.customer)
        response = self.client.post("/api/v1/custom-requests/", {"title": "Campaign poster", "request_type": "NEW_DESIGN", "initial_message": "I need a poster for an event."}, format="json")
        self.request_id = response.data["id"]

    def test_customer_can_start_and_reply_to_conversation(self):
        response = self.client.get(f"/api/v1/messaging/requests/{self.request_id}/messages/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        reply = self.client.post(f"/api/v1/messaging/requests/{self.request_id}/messages/", {"body": "The event is next month."}, format="json")
        self.assertEqual(reply.status_code, status.HTTP_201_CREATED)

    def test_other_customer_cannot_access_conversation(self):
        self.client.force_authenticate(self.other)
        response = self.client.get(f"/api/v1/messaging/requests/{self.request_id}/messages/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_designer_can_view_and_reply(self):
        self.client.force_authenticate(self.designer)
        listing = self.client.get("/api/v1/custom-requests/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        reply = self.client.post(f"/api/v1/messaging/requests/{self.request_id}/messages/", {"body": "Thanks. I will review the brief."}, format="json")
        self.assertEqual(reply.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CustomDesignRequest.objects.get(pk=self.request_id).status, CustomDesignRequest.Status.UNDER_REVIEW)

    def test_designer_can_update_status_but_cannot_create_customer_request(self):
        self.client.force_authenticate(self.designer)
        updated = self.client.patch(
            f"/api/v1/custom-requests/{self.request_id}/studio/",
            {"status": CustomDesignRequest.Status.IN_PROGRESS},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["status"], CustomDesignRequest.Status.IN_PROGRESS)
        created = self.client.post(
            "/api/v1/custom-requests/",
            {"title": "Invalid", "request_type": "OTHER", "initial_message": "Should not work"},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_403_FORBIDDEN)

    def test_participant_can_send_file_only_and_outsider_cannot_download_attachment(self):
        with tempfile.TemporaryDirectory() as directory, self.settings(MEDIA_ROOT=directory):
            sample = SimpleUploadedFile("sample.png", b"fake-png-content", content_type="image/png")
            response = self.client.post(
                f"/api/v1/messaging/requests/{self.request_id}/messages/",
                {"body": "", "uploaded_files": [sample]},
                format="multipart",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertEqual(len(response.data["attachments"]), 1)
            download_url = response.data["attachments"][0]["download_url"]
            own_download = self.client.get(download_url)
            self.assertEqual(own_download.status_code, status.HTTP_200_OK)
            own_download.close()
            self.client.force_authenticate(self.other)
            self.assertEqual(self.client.get(download_url).status_code, status.HTTP_403_FORBIDDEN)

