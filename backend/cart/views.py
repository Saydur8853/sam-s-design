from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Product
from .models import Cart, CartItem
from .serializers import CartSerializer


def user_cart(user):
    cart, _ = Cart.objects.get_or_create(user=user)
    return Cart.objects.prefetch_related("items__product__category").get(pk=cart.pk)


class CartView(APIView):
    def get(self, request):
        return Response(CartSerializer(user_cart(request.user)).data)


class AddCartItemView(APIView):
    def post(self, request):
        product = get_object_or_404(Product, pk=request.data.get("product_id"), is_active=True)
        cart, _ = Cart.objects.get_or_create(user=request.user)
        item, created = CartItem.objects.get_or_create(cart=cart, product=product)
        if not created:
            item.quantity = 1
            item.save(update_fields=("quantity",))
        return Response(CartSerializer(user_cart(request.user)).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class RemoveCartItemView(APIView):
    def delete(self, request, item_id):
        item = get_object_or_404(CartItem, pk=item_id, cart__user=request.user)
        item.delete()
        return Response(CartSerializer(user_cart(request.user)).data)

