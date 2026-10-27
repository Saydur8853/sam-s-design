import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ("catalog", "0001_initial")]
    operations = [
        migrations.CreateModel(name="Order", fields=[("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("status", models.CharField(choices=[("PENDING_PAYMENT", "Pending payment"), ("PAID", "Paid"), ("PAYMENT_FAILED", "Payment failed"), ("CANCELLED", "Cancelled"), ("REFUNDED", "Refunded")], default="PENDING_PAYMENT", max_length=30)), ("total", models.DecimalField(decimal_places=2, max_digits=10)), ("currency", models.CharField(default="USD", max_length=3)), ("created_at", models.DateTimeField(auto_now_add=True)), ("paid_at", models.DateTimeField(blank=True, null=True)), ("user", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="orders", to=settings.AUTH_USER_MODEL))], options={"ordering": ("-created_at",)}),
        migrations.CreateModel(name="OrderItem", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("product_title", models.CharField(max_length=180)), ("unit_price", models.DecimalField(decimal_places=2, max_digits=10)), ("quantity", models.PositiveSmallIntegerField(default=1)), ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="orders.order")), ("product", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="catalog.product"))]),
    ]
