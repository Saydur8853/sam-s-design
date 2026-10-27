from django.conf import settings
from django.db import models
from catalog.models import ProductFile
from orders.models import OrderItem


class DownloadEntitlement(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="download_entitlements")
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name="download_entitlements")
    product_file = models.ForeignKey(ProductFile, on_delete=models.PROTECT)
    max_downloads = models.PositiveSmallIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("user", "order_item", "product_file"), name="unique_download_entitlement")]


class DownloadLog(models.Model):
    entitlement = models.ForeignKey(DownloadEntitlement, on_delete=models.PROTECT, related_name="logs")
    downloaded_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)

