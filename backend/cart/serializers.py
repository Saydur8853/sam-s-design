from decimal import Decimal
from rest_framework import serializers
from catalog.serializers import ProductSerializer
from .models import Cart, CartItem


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ("id", "product", "quantity", "line_total")

    def get_line_total(self, obj):
        return str(obj.product.price * Decimal(obj.quantity))


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ("id", "items", "total", "item_count")

    def get_total(self, obj):
        return str(sum((item.product.price * item.quantity for item in obj.items.all()), Decimal("0.00")))

    def get_item_count(self, obj):
        return sum(item.quantity for item in obj.items.all())

