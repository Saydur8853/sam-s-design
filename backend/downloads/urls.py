from django.urls import path
from .views import DownloadListView, ProtectedDownloadView

urlpatterns = [path("", DownloadListView.as_view(), name="download-list"), path("<int:entitlement_id>/file/", ProtectedDownloadView.as_view(), name="protected-download")]
