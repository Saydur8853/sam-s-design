from django.urls import path
from .views import AttachmentDownloadView, MessageDetailView, RequestMessagesView

urlpatterns = [
    path("requests/<uuid:request_id>/messages/", RequestMessagesView.as_view(), name="request-messages"),
    path("requests/<uuid:request_id>/messages/<int:pk>/", MessageDetailView.as_view(), name="request-message-detail"),
    path("attachments/<int:attachment_id>/download/", AttachmentDownloadView.as_view(), name="attachment-download"),
]

