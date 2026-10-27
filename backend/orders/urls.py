from django.urls import path
from .views import BuyNowView, CartCheckoutView, OrderDetailView, OrderListView

urlpatterns = [path("", OrderListView.as_view(), name="order-list"), path("buy-now/", BuyNowView.as_view(), name="buy-now"), path("checkout-cart/", CartCheckoutView.as_view(), name="checkout-cart"), path("<uuid:pk>/", OrderDetailView.as_view(), name="order-detail")]
