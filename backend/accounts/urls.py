from django.urls import path
from .views import (
    ChangePasswordView,
    DemoEmailPreviewView,
    GoogleAuthCallbackView,
    GoogleAuthPopupView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    RegisterView,
    ResendVerificationView,
    VerifyEmailView,
    VerifyStatusView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("resend-verification/", ResendVerificationView.as_view(), name="resend-verification"),
    path("verify-email/<str:token>/", VerifyEmailView.as_view(), name="verify-email"),
    path("verify-status/<uuid:verification_id>/", VerifyStatusView.as_view(), name="verify-status"),
    path("demo-email/<str:token>/", DemoEmailPreviewView.as_view(), name="demo-email-preview"),
    path("google/authorize/", GoogleAuthPopupView.as_view(), name="google-auth-popup"),
    path("google/callback/", GoogleAuthCallbackView.as_view(), name="google-auth-callback"),
    path("token/", LoginView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", RefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
]
