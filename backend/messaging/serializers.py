from pathlib import Path
from django.db import transaction
from rest_framework import serializers
from .models import Message, MessageAttachment


ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".zip", ".docx", ".pptx", ".ai", ".psd"}
ALLOWED_MIME_PREFIXES = ("image/jpeg", "image/png", "image/webp", "application/pdf", "application/zip", "application/x-zip-compressed", "application/vnd.openxmlformats-officedocument", "application/postscript", "application/octet-stream")
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024


class MessageAttachmentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = MessageAttachment
        fields = ("id", "original_name", "mime_type", "file_size", "download_url")

    def get_download_url(self, obj):
        return f"/api/v1/messaging/attachments/{obj.pk}/download/"


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.CharField(source="sender.role", read_only=True)
    is_mine = serializers.SerializerMethodField()
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    uploaded_files = serializers.ListField(child=serializers.FileField(), write_only=True, required=False, max_length=5)

    class Meta:
        model = Message
        fields = ("id", "body", "sender_name", "sender_role", "is_mine", "created_at", "attachments", "uploaded_files")
        read_only_fields = ("id", "sender_name", "sender_role", "is_mine", "created_at")
        extra_kwargs = {"body": {"required": False, "allow_blank": True}}

    def validate_uploaded_files(self, files):
        for uploaded in files:
            if Path(uploaded.name).suffix.lower() not in ALLOWED_EXTENSIONS:
                raise serializers.ValidationError(f"{uploaded.name}: file type is not allowed.")
            if uploaded.size > MAX_ATTACHMENT_SIZE:
                raise serializers.ValidationError(f"{uploaded.name}: maximum file size is 10 MB.")
            if uploaded.content_type and not uploaded.content_type.startswith(ALLOWED_MIME_PREFIXES):
                raise serializers.ValidationError(f"{uploaded.name}: MIME type is not allowed.")
        return files

    def validate(self, attrs):
        if not attrs.get("body", "").strip() and not attrs.get("uploaded_files"):
            raise serializers.ValidationError("Write a message or attach at least one file.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        files = validated_data.pop("uploaded_files", [])
        validated_data["body"] = validated_data.get("body", "").strip()
        message = super().create(validated_data)
        for uploaded in files:
            MessageAttachment.objects.create(message=message, file=uploaded, original_name=Path(uploaded.name).name[:255], mime_type=uploaded.content_type or "application/octet-stream", file_size=uploaded.size)
        return message

    def get_sender_name(self, obj):
        name = obj.sender.get_full_name().strip()
        return name or ("Designer" if obj.sender.role == "DESIGNER" else obj.sender.email)

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and obj.sender_id == request.user.id)

