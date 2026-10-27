from django.urls import path

from .views import CategoryListView, ProductDetailView, ProductListView, StudioProductDetailView, StudioProductListCreateView

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path("products/", ProductListView.as_view(), name="product-list"),
    path("products/<slug:slug>/", ProductDetailView.as_view(), name="product-detail"),
    path("studio/products/", StudioProductListCreateView.as_view(), name="studio-product-list"),
    path("studio/products/<int:pk>/", StudioProductDetailView.as_view(), name="studio-product-detail"),
]

