from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


class AuthenticationTests(APITestCase):
    def test_registration_creates_customer_and_returns_tokens(self):
        response = self.client.post(
            "/api/v1/auth/register/",
            {"email": "Buyer@Example.com", "password": "Long-test-pass-8472", "password_confirm": "Long-test-pass-8472"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["role"], "CUSTOMER")
        self.assertIn("access", response.data)
        self.assertTrue(get_user_model().objects.filter(email="buyer@example.com").exists())

    def test_anonymous_user_cannot_read_profile(self):
        response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_read_profile(self):
        user = get_user_model().objects.create_user(email="buyer@example.com", password="Long-test-pass-8472")
        self.client.force_authenticate(user)
        response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], user.email)

