from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ("catalog", "0002_productfile"), ("orders", "0001_initial")]
    operations = [
        migrations.CreateModel(name="DownloadEntitlement", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("is_active", models.BooleanField(default=True)), ("granted_at", models.DateTimeField(auto_now_add=True)), ("order_item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="download_entitlements", to="orders.orderitem")), ("product_file", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="catalog.productfile")), ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="download_entitlements", to=settings.AUTH_USER_MODEL))], options={"constraints": [models.UniqueConstraint(fields=("user", "order_item", "product_file"), name="unique_download_entitlement")]}),
        migrations.CreateModel(name="DownloadLog", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("downloaded_at", models.DateTimeField(auto_now_add=True)), ("ip_address", models.GenericIPAddressField(blank=True, null=True)), ("user_agent", models.CharField(blank=True, max_length=500)), ("entitlement", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="logs", to="downloads.downloadentitlement"))]),
    ]
