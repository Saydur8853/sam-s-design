from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from catalog.models import Product
from cart.models import Cart
from .models import Order
from .serializers import OrderSerializer
from .services import create_order


class OrderListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    def get_queryset(self):
        return Order.objects.prefetch_related("items__product").filter(user=self.request.user)


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    def get_queryset(self):
        return Order.objects.prefetch_related("items__product").filter(user=self.request.user)


class BuyNowView(APIView):
    def post(self, request):
        product = get_object_or_404(Product, pk=request.data.get("product_id"), is_active=True)
        order = create_order(request.user, [(product, 1)])
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CartCheckoutView(APIView):
    @transaction.atomic
    def post(self, request):
        cart = get_object_or_404(Cart.objects.prefetch_related("items__product"), user=request.user)
        try:
            order = create_order(request.user, [(item.product, item.quantity) for item in cart.items.all()])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        cart.items.all().delete()
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

