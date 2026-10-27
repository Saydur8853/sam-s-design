import mimetypes
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage
from django.utils.text import slugify
from rest_framework import serializers

from .models import Category, Product, ProductFile
from .watermark import apply_burned_watermark, extract_preview_from_source, process_image_to_preview


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug", "description")


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    product_type_display = serializers.CharField(source="get_product_type_display", read_only=True)
    license_type_display = serializers.CharField(source="get_license_type_display", read_only=True)

    class Meta:
        model = Product
        fields = (
            "id", "title", "slug", "short_description", "description", "price", "currency",
            "product_type", "product_type_display", "license_type", "license_type_display",
            "preview_url", "file_formats", "dimensions", "resolution", "color_mode",
            "is_featured", "category",
        )


class StudioProductFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductFile
        fields = ("id", "display_name", "mime_type", "file_size", "is_active")


class StudioProductSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(source="category", queryset=Category.objects.all())
    category_name = serializers.CharField(source="category.name", read_only=True)
    preview_file = serializers.FileField(write_only=True, required=False)
    source_file = serializers.FileField(write_only=True, required=False)
    download_files = StudioProductFileSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = (
            "id", "title", "slug", "short_description", "description", "price", "currency",
            "product_type", "license_type", "preview_url", "preview_file", "source_file",
            "file_formats", "dimensions", "resolution", "color_mode", "is_featured", "is_active",
            "category_id", "category_name", "download_files", "created_at", "updated_at",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")
        extra_kwargs = {"preview_url": {"required": False, "allow_blank": True}}

    def validate_preview_file(self, uploaded):
        if uploaded.size > 8 * 1024 * 1024:
            raise serializers.ValidationError("Preview image must be 8 MB or smaller.")
        if Path(uploaded.name).suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise serializers.ValidationError("Preview must be JPG, PNG, or WebP.")
        return uploaded

    def validate_source_file(self, uploaded):
        if uploaded.size > 250 * 1024 * 1024:
            raise serializers.ValidationError("Product file must be 250 MB or smaller.")
        if Path(uploaded.name).suffix.lower() not in {".zip", ".pdf", ".psd", ".ai", ".eps", ".svg", ".png", ".jpg", ".jpeg", ".webp"}:
            raise serializers.ValidationError("This product file type is not allowed.")
        return uploaded

    def validate(self, attrs):
        if not self.instance and not attrs.get("source_file") and not attrs.get("preview_file") and not attrs.get("preview_url"):
            raise serializers.ValidationError({"source_file": "Upload your main artwork file."})
        return attrs

    def _unique_slug(self, title, instance=None):
        base = slugify(title)[:180] or "artwork"
        slug = base
        index = 2
        queryset = Product.objects.exclude(pk=instance.pk) if instance else Product.objects.all()
        while queryset.filter(slug=slug).exists():
            slug = f"{base[:190-len(str(index))]}-{index}"
            index += 1
        return slug

    def _save_uploads(self, product, preview_file=None, source_file=None):
        # If the designer only uploaded preview_file without source_file, treat it as both original & preview source
        if preview_file and not source_file:
            source_file = preview_file

        detected_dims = None
        if preview_file:
            try:
                watermarked_content, extension, detected_dims = process_image_to_preview(preview_file)
                name = f"product_previews/{product.slug}-{uuid.uuid4().hex[:10]}{extension}"
                saved = default_storage.save(name, watermarked_content)
            except Exception:
                preview_file.seek(0)
                extension = Path(preview_file.name).suffix.lower()
                name = f"product_previews/{product.slug}-{uuid.uuid4().hex[:10]}{extension}"
                saved = default_storage.save(name, preview_file)
            product.preview_url = default_storage.url(saved)
            product.save(update_fields=("preview_url", "updated_at"))
        elif source_file:
            auto_content, auto_ext, detected_dims = extract_preview_from_source(source_file)
            if auto_content and auto_ext:
                name = f"product_previews/{product.slug}-{uuid.uuid4().hex[:10]}{auto_ext}"
                saved = default_storage.save(name, auto_content)
                product.preview_url = default_storage.url(saved)
                product.save(update_fields=("preview_url", "updated_at"))
            elif Path(source_file.name).suffix.lower() == ".svg":
                source_file.seek(0)
                name = f"product_previews/{product.slug}-{uuid.uuid4().hex[:10]}.svg"
                saved = default_storage.save(name, source_file)
                product.preview_url = default_storage.url(saved)
                product.save(update_fields=("preview_url", "updated_at"))

        if source_file:
            source_file.seek(0)
            original_name = Path(source_file.name).name
            extension = Path(original_name).suffix.lower()
            relative = Path("products") / product.slug / f"{uuid.uuid4().hex}{extension}"
            target = Path(settings.PRIVATE_MEDIA_ROOT) / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("wb") as destination:
                for chunk in source_file.chunks():
                    destination.write(chunk)
            product.download_files.update(is_active=False)
            ProductFile.objects.create(
                product=product,
                display_name=original_name[:180],
                private_path=relative.as_posix(),
                mime_type=source_file.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream",
                file_size=source_file.size,
            )

            updated_fields = []
            if detected_dims and not product.dimensions:
                product.dimensions = detected_dims
                updated_fields.append("dimensions")
            if not product.file_formats and extension:
                product.file_formats = [extension.lstrip(".").upper()]
                updated_fields.append("file_formats")
            if updated_fields:
                updated_fields.append("updated_at")
                product.save(update_fields=updated_fields)

    def create(self, validated_data):
        preview_file = validated_data.pop("preview_file", None)
        source_file = validated_data.pop("source_file", None)
        validated_data["slug"] = self._unique_slug(validated_data["title"])
        product = super().create(validated_data)
        self._save_uploads(product, preview_file, source_file)
        return product

    def update(self, instance, validated_data):
        preview_file = validated_data.pop("preview_file", None)
        source_file = validated_data.pop("source_file", None)
        if "title" in validated_data and validated_data["title"] != instance.title:
            validated_data["slug"] = self._unique_slug(validated_data["title"], instance)
        product = super().update(instance, validated_data)
        self._save_uploads(product, preview_file, source_file)
        return product

