from django.db.models import Q
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from core.permissions import IsDesigner

from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer, StudioProductSerializer


class ProductPagination(PageNumberPagination):
    page_size = 8
    page_size_query_param = "page_size"
    max_page_size = 24


class CategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Category.objects.filter(is_active=True)


class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]
    pagination_class = ProductPagination

    def get_queryset(self):
        queryset = (
            Product.objects.select_related("category")
            .filter(is_active=True, category__is_active=True)
            .order_by("-is_featured", "-created_at")
        )
        category = self.request.query_params.get("category")
        exclude = self.request.query_params.get("exclude")
        search = self.request.query_params.get("search")
        featured = self.request.query_params.get("featured")
        if category:
            queryset = queryset.filter(category__slug=category)
        if exclude:
            queryset = queryset.exclude(slug=exclude)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(short_description__icontains=search) | Q(description__icontains=search)
            )
        if featured and featured.lower() in {"1", "true", "yes"}:
            queryset = queryset.filter(is_featured=True)
        return queryset


class ProductDetailView(generics.RetrieveAPIView):
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    queryset = Product.objects.select_related("category").filter(is_active=True, category__is_active=True)


class StudioProductPagination(PageNumberPagination):
    page_size = 9
    page_size_query_param = "page_size"
    max_page_size = 36


class StudioProductListCreateView(generics.ListCreateAPIView):
    serializer_class = StudioProductSerializer
    permission_classes = (IsDesigner,)
    pagination_class = StudioProductPagination

    def get_queryset(self):
        queryset = (
            Product.objects.select_related("category")
            .prefetch_related("download_files")
            .order_by("-created_at")
        )
        category = self.request.query_params.get("category")
        search = self.request.query_params.get("search")
        if category:
            queryset = queryset.filter(category_id=category)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(short_description__icontains=search) | Q(category__name__icontains=search)
            )
        return queryset

    def paginate_queryset(self, queryset):
        if "page" not in self.request.query_params:
            return None
        return super().paginate_queryset(queryset)


class StudioProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StudioProductSerializer
    permission_classes = (IsDesigner,)
    http_method_names = ("get", "patch", "delete", "head", "options")
    queryset = Product.objects.select_related("category").prefetch_related("download_files").all()

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=("is_active", "updated_at"))

