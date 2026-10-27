from django.urls import path
from .views import AddCartItemView, CartView, RemoveCartItemView

urlpatterns = [path("", CartView.as_view(), name="cart"), path("items/", AddCartItemView.as_view(), name="cart-add"), path("items/<int:item_id>/", RemoveCartItemView.as_view(), name="cart-remove")]
