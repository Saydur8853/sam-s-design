from django.contrib import admin

from .models import Category, Product, ProductFile


class ProductFileInline(admin.TabularInline):
    model = ProductFile
    extra = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "price", "currency", "product_type", "is_featured", "is_active")
    list_filter = ("is_active", "is_featured", "product_type", "license_type", "category")
    list_editable = ("price", "is_featured", "is_active")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title", "short_description", "description")
    inlines = (ProductFileInline,)


@admin.register(ProductFile)
class ProductFileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "product", "mime_type", "file_size", "is_active")
    list_filter = ("is_active", "mime_type")
    search_fields = ("display_name", "product__title")

