from django.urls import path
from .views import (
    CreateStripeCheckoutSessionView,
    StripeWebhookView,
)

urlpatterns = [
    path("checkout/session/", CreateStripeCheckoutSessionView.as_view(), name="checkout-session"),
    path("webhooks/stripe/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
