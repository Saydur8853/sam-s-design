from django.urls import path
from .views import CreateDemoPaymentSessionView, DemoGatewayConfirmView, DemoGatewayView

urlpatterns = [path("demo/session/", CreateDemoPaymentSessionView.as_view(), name="demo-session"), path("demo-gateway/<uuid:reference>/", DemoGatewayView.as_view(), name="demo-gateway"), path("demo-gateway/<uuid:reference>/confirm/", DemoGatewayConfirmView.as_view(), name="demo-gateway-confirm")]
