from django.db import transaction
from rest_framework import serializers
from messaging.models import Conversation, Message
from .models import CustomDesignRequest


class CustomDesignRequestSerializer(serializers.ModelSerializer):
    initial_message = serializers.CharField(write_only=True, max_length=4000, required=True)
    request_type_display = serializers.CharField(source="get_request_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    customer_email = serializers.EmailField(source="customer.email", read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = CustomDesignRequest
        fields = ("id", "title", "request_type", "request_type_display", "status", "status_display", "customer_email", "created_at", "updated_at", "last_message", "unread_count", "initial_message")
        read_only_fields = ("id", "status", "created_at", "updated_at")

    def get_last_message(self, obj):
        try:
            message = obj.conversation.messages.last()
        except Conversation.DoesNotExist:
            return ""
        return message.body[:120] if message else ""

    def get_unread_count(self, obj):
        try:
            conversation = obj.conversation
        except Conversation.DoesNotExist:
            return 0
        request = self.context.get("request")
        if not request:
            return 0
        designer = request.user.is_staff or request.user.role == "DESIGNER"
        last_read = conversation.designer_last_read_at if designer else conversation.customer_last_read_at
        messages = conversation.messages.exclude(sender=request.user)
        if last_read:
            messages = messages.filter(created_at__gt=last_read)
        return messages.count()

    @transaction.atomic
    def create(self, validated_data):
        initial_message = validated_data.pop("initial_message").strip()
        custom_request = CustomDesignRequest.objects.create(customer=self.context["request"].user, **validated_data)
        conversation = Conversation.objects.create(request=custom_request)
        Message.objects.create(conversation=conversation, sender=custom_request.customer, body=initial_message)
        return custom_request


class StudioCustomDesignRequestSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CustomDesignRequest
        fields = ("id", "status", "status_display", "updated_at")
        read_only_fields = ("id", "status_display", "updated_at")

