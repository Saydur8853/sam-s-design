from django.urls import path
from .views import (
    CreateDemoPaymentSessionView,
    DemoGatewayConfirmView,
    DemoGatewayView,
    LemonSqueezyWebhookView,
    StripeWebhookView,
)

urlpatterns = [
    path("demo/session/", CreateDemoPaymentSessionView.as_view(), name="demo-session"),
    path("checkout/session/", CreateDemoPaymentSessionView.as_view(), name="checkout-session"),
    path("webhooks/lemonsqueezy/", LemonSqueezyWebhookView.as_view(), name="lemonsqueezy-webhook"),
    path("webhooks/stripe/", StripeWebhookView.as_view(), name="stripe-webhook"),
    path("demo-gateway/<uuid:reference>/", DemoGatewayView.as_view(), name="demo-gateway"),
    path("demo-gateway/<uuid:reference>/confirm/", DemoGatewayConfirmView.as_view(), name="demo-gateway-confirm"),
]
