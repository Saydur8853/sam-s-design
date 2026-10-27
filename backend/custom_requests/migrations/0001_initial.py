import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(name="CustomDesignRequest", fields=[("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("title", models.CharField(max_length=180)), ("request_type", models.CharField(choices=[("NEW_DESIGN", "New custom design"), ("CUSTOM_SIZE", "Custom size/version"), ("MODIFICATION", "Existing design modification"), ("OTHER", "Other design service")], max_length=30)), ("status", models.CharField(choices=[("SUBMITTED", "Submitted"), ("UNDER_REVIEW", "Under review"), ("NEEDS_INFORMATION", "Needs information"), ("QUOTED", "Quoted"), ("IN_PROGRESS", "In progress"), ("COMPLETED", "Completed"), ("CANCELLED", "Cancelled")], default="SUBMITTED", max_length=30)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)), ("customer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="custom_design_requests", to=settings.AUTH_USER_MODEL))], options={"ordering": ("-updated_at",)})]
