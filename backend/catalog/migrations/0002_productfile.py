from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("catalog", "0001_initial")]
    operations = [
        migrations.CreateModel(
            name="ProductFile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("display_name", models.CharField(max_length=180)),
                ("private_path", models.CharField(help_text="Path relative to PRIVATE_MEDIA_ROOT", max_length=500)),
                ("mime_type", models.CharField(default="application/octet-stream", max_length=100)),
                ("file_size", models.PositiveBigIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="download_files", to="catalog.product")),
            ],
        ),
    ]
