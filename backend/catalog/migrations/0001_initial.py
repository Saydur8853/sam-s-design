from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Category",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, unique=True)),
                ("slug", models.SlugField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"verbose_name_plural": "categories", "ordering": ("name",)},
        ),
        migrations.CreateModel(
            name="Product",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("slug", models.SlugField(max_length=200, unique=True)),
                ("short_description", models.CharField(max_length=240)),
                ("description", models.TextField()),
                ("price", models.DecimalField(decimal_places=2, max_digits=10)),
                ("currency", models.CharField(default="USD", max_length=3)),
                ("product_type", models.CharField(choices=[("POSTER", "Poster"), ("TEMPLATE", "Editable template"), ("SOCIAL_PACK", "Social media pack"), ("PRINT_ART", "Print-ready artwork")], max_length=20)),
                ("license_type", models.CharField(choices=[("PERSONAL", "Personal"), ("COMMERCIAL", "Commercial"), ("EXTENDED", "Extended commercial")], default="COMMERCIAL", max_length=20)),
                ("preview_url", models.CharField(help_text="Public watermarked preview path or URL", max_length=500)),
                ("file_formats", models.JSONField(default=list)),
                ("dimensions", models.CharField(blank=True, max_length=100)),
                ("resolution", models.CharField(blank=True, max_length=50)),
                ("color_mode", models.CharField(blank=True, max_length=30)),
                ("is_featured", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("category", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="products", to="catalog.category")),
            ],
            options={"ordering": ("-is_featured", "-created_at")},
        ),
    ]

