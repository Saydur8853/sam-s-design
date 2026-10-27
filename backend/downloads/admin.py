from django.contrib import admin
from .models import DownloadEntitlement, DownloadLog


@admin.register(DownloadEntitlement)
class DownloadEntitlementAdmin(admin.ModelAdmin):
    list_display = ("user", "product_file", "order_item", "is_active", "granted_at")
    list_filter = ("is_active",)
    search_fields = ("user__email", "product_file__display_name")


@admin.register(DownloadLog)
class DownloadLogAdmin(admin.ModelAdmin):
    list_display = ("entitlement", "downloaded_at", "ip_address")
    readonly_fields = ("entitlement", "downloaded_at", "ip_address", "user_agent")

