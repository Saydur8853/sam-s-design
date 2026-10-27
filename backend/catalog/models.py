from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("name",)
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    class ProductType(models.TextChoices):
        POSTER = "POSTER", "Poster"
        TEMPLATE = "TEMPLATE", "Editable template"
        SOCIAL_PACK = "SOCIAL_PACK", "Social media pack"
        PRINT_ART = "PRINT_ART", "Print-ready artwork"

    class LicenseType(models.TextChoices):
        PERSONAL = "PERSONAL", "Personal"
        COMMERCIAL = "COMMERCIAL", "Commercial"
        EXTENDED = "EXTENDED", "Extended commercial"

    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    title = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True)
    short_description = models.CharField(max_length=240)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    product_type = models.CharField(max_length=20, choices=ProductType.choices)
    license_type = models.CharField(max_length=20, choices=LicenseType.choices, default=LicenseType.COMMERCIAL)
    preview_url = models.CharField(max_length=500, help_text="Public watermarked preview path or URL")
    file_formats = models.JSONField(default=list)
    dimensions = models.CharField(max_length=100, blank=True)
    resolution = models.CharField(max_length=50, blank=True)
    color_mode = models.CharField(max_length=30, blank=True)
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-is_featured", "-created_at")

    def __str__(self):
        return self.title


class ProductFile(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="download_files")
    display_name = models.CharField(max_length=180)
    private_path = models.CharField(max_length=500, help_text="Path relative to PRIVATE_MEDIA_ROOT")
    mime_type = models.CharField(max_length=100, default="application/octet-stream")
    file_size = models.PositiveBigIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.product.title} — {self.display_name}"

