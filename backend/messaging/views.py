from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from custom_requests.models import CustomDesignRequest
from .models import Conversation, Message, MessageAttachment
from .serializers import MessageSerializer


class RequestMessagesView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    throttle_scope = "messages"

    def conversation(self):
        custom_request = get_object_or_404(CustomDesignRequest.objects.select_related("customer"), pk=self.kwargs["request_id"])
        user = self.request.user
        if custom_request.customer_id != user.id and not user.is_staff and user.role != "DESIGNER":
            raise PermissionDenied("You do not have access to this conversation.")
        conversation, _ = Conversation.objects.get_or_create(request=custom_request)
        return conversation

    def get_queryset(self):
        return Message.objects.select_related("sender").filter(conversation=self.conversation())

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        conversation = self.conversation()
        field = "designer_last_read_at" if (request.user.is_staff or request.user.role == "DESIGNER") else "customer_last_read_at"
        setattr(conversation, field, timezone.now())
        conversation.save(update_fields=(field,))
        return response

    def perform_create(self, serializer):
        conversation = self.conversation()
        serializer.save(conversation=conversation, sender=self.request.user)
        custom_request = conversation.request
        if (self.request.user.is_staff or self.request.user.role == "DESIGNER") and custom_request.status == CustomDesignRequest.Status.SUBMITTED:
            custom_request.status = CustomDesignRequest.Status.UNDER_REVIEW
        custom_request.updated_at = timezone.now()
        custom_request.save(update_fields=("status", "updated_at"))


class AttachmentDownloadView(generics.GenericAPIView):
    def get(self, request, attachment_id):
        attachment = get_object_or_404(MessageAttachment.objects.select_related("message__conversation__request__customer"), pk=attachment_id)
        custom_request = attachment.message.conversation.request
        user = request.user
        if custom_request.customer_id != user.id and not user.is_staff and user.role != "DESIGNER":
            raise PermissionDenied("You do not have access to this attachment.")
        return FileResponse(attachment.file.open("rb"), as_attachment=True, filename=attachment.original_name, content_type=attachment.mime_type)


class MessageDetailView(generics.DestroyAPIView):
    serializer_class = MessageSerializer

    def get_queryset(self):
        return Message.objects.select_related("sender", "conversation__request").filter(
            conversation__request_id=self.kwargs["request_id"]
        )

    def perform_destroy(self, instance):
        user = self.request.user
        custom_request = instance.conversation.request
        if instance.sender_id != user.id and custom_request.customer_id != user.id and not user.is_staff and user.role != "DESIGNER":
            raise PermissionDenied("You do not have permission to delete this message.")
        for attachment in instance.attachments.all():
            if attachment.file:
                try:
                    attachment.file.delete(save=False)
                except OSError:
                    pass
        instance.delete()


