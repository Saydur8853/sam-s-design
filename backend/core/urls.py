from django.urls import path

from .studio_views import StudioDashboardView, StudioDatabaseBackupView
from .views import HealthView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("studio/dashboard/", StudioDashboardView.as_view(), name="studio-dashboard"),
    path("studio/db-backup/", StudioDatabaseBackupView.as_view(), name="studio-db-backup"),
]
