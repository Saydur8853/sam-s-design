from django.contrib import admin
from .models import PaymentTransaction


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "provider", "amount", "currency", "status", "processed_at")
    list_filter = ("provider", "status", "currency")
    search_fields = ("id", "provider_reference", "order__id", "order__user__email")
    readonly_fields = ("id", "provider_reference", "created_at", "processed_at")

