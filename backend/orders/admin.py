from django.contrib import admin
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "product_title", "unit_price", "quantity")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "total", "currency", "created_at", "paid_at")
    list_filter = ("status", "currency")
    search_fields = ("id", "user__email")
    readonly_fields = ("id", "total", "currency", "created_at", "paid_at")
    inlines = (OrderItemInline,)

