from django.urls import path
from .views import CustomRequestDetailView, CustomRequestListCreateView, CustomRequestStudioDetailView

urlpatterns = [
    path("", CustomRequestListCreateView.as_view(), name="custom-request-list-create"),
    path("<uuid:pk>/", CustomRequestDetailView.as_view(), name="custom-request-detail"),
    path("<uuid:pk>/studio/", CustomRequestStudioDetailView.as_view(), name="custom-request-studio-detail"),
]

