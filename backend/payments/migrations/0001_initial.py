import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [("orders", "0001_initial")]
    operations = [migrations.CreateModel(name="PaymentTransaction", fields=[("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("provider", models.CharField(default="DEMO", max_length=30)), ("provider_reference", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)), ("amount", models.DecimalField(decimal_places=2, max_digits=10)), ("currency", models.CharField(max_length=3)), ("status", models.CharField(choices=[("CREATED", "Created"), ("PENDING", "Pending"), ("SUCCEEDED", "Succeeded"), ("FAILED", "Failed"), ("REFUNDED", "Refunded")], default="CREATED", max_length=30)), ("created_at", models.DateTimeField(auto_now_add=True)), ("processed_at", models.DateTimeField(blank=True, null=True)), ("order", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payments", to="orders.order"))])]
