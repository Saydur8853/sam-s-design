from django.urls import path

from .studio_views import StudioDashboardView, StudioDatabaseBackupView, StudioUserListView
from .views import HealthView, sitemap_xml_view

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("sitemap.xml", sitemap_xml_view, name="api-sitemap"),
    path("studio/dashboard/", StudioDashboardView.as_view(), name="studio-dashboard"),
    path("studio/db-backup/", StudioDatabaseBackupView.as_view(), name="studio-db-backup"),
    path("studio/users/", StudioUserListView.as_view(), name="studio-users"),
]
