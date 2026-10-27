from django.conf import settings
from django.db import models
from custom_requests.models import CustomDesignRequest


class Conversation(models.Model):
    request = models.OneToOneField(CustomDesignRequest, on_delete=models.CASCADE, related_name="conversation")
    created_at = models.DateTimeField(auto_now_add=True)
    customer_last_read_at = models.DateTimeField(null=True, blank=True)
    designer_last_read_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.request.title} — {self.request.customer.email}"


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="portal_messages")
    body = models.TextField(max_length=4000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.sender.email}: {self.body[:60]}"


def attachment_upload_path(instance, filename):
    return f"private/message_attachments/{instance.message.conversation.request_id}/{filename}"


class MessageAttachment(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=attachment_upload_path)
    original_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120)
    file_size = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_name

