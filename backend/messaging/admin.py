from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from custom_requests.models import CustomDesignRequest
from .models import Conversation, Message, MessageAttachment


class MessageAttachmentInline(admin.TabularInline):
    model = MessageAttachment
    extra = 1
    fields = ("file",)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("project", "customer", "status", "latest_message", "reply_link")
    search_fields = ("request__title", "request__customer__email", "messages__body")
    list_select_related = ("request", "request__customer")

    @admin.display(description="Project", ordering="request__title")
    def project(self, obj):
        return obj.request.title

    @admin.display(description="Customer", ordering="request__customer__email")
    def customer(self, obj):
        return obj.request.customer.email

    @admin.display(description="Status", ordering="request__status")
    def status(self, obj):
        return obj.request.get_status_display()

    @admin.display(description="Latest message")
    def latest_message(self, obj):
        message = obj.messages.last()
        return message.body[:80] if message else "—"

    @admin.display(description="Action")
    def reply_link(self, obj):
        url = reverse("admin:messaging_message_add")
        return format_html('<a class="button" href="{}?conversation={}">Reply</a>', url, obj.pk)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("project", "sender", "sender_role", "message_preview", "created_at")
    list_filter = ("sender__role", "created_at")
    search_fields = ("body", "sender__email", "conversation__request__title", "conversation__request__customer__email")
    list_select_related = ("conversation__request", "sender")
    ordering = ("-created_at",)
    inlines = (MessageAttachmentInline,)

    def get_fields(self, request, obj=None):
        if obj:
            return ("conversation", "sender", "body", "created_at")
        return ("conversation", "body")

    def get_readonly_fields(self, request, obj=None):
        return ("conversation", "sender", "body", "created_at") if obj else ()

    def get_changeform_initial_data(self, request):
        initial = super().get_changeform_initial_data(request)
        conversation = request.GET.get("conversation")
        if conversation and conversation.isdigit():
            initial["conversation"] = conversation
        return initial

    def save_model(self, request, obj, form, change):
        if not change:
            obj.sender = request.user
        super().save_model(request, obj, form, change)
        custom_request = obj.conversation.request
        if custom_request.status == CustomDesignRequest.Status.SUBMITTED:
            custom_request.status = CustomDesignRequest.Status.UNDER_REVIEW
            custom_request.save(update_fields=("status", "updated_at"))

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for instance in instances:
            if isinstance(instance, MessageAttachment) and instance.file:
                uploaded = instance.file.file
                instance.original_name = instance.file.name.rsplit("/", 1)[-1][:255]
                instance.mime_type = getattr(uploaded, "content_type", None) or "application/octet-stream"
                instance.file_size = instance.file.size
            instance.save()
        formset.save_m2m()

    def has_change_permission(self, request, obj=None):
        return obj is None

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="Project", ordering="conversation__request__title")
    def project(self, obj):
        return obj.conversation.request.title

    @admin.display(description="Role", ordering="sender__role")
    def sender_role(self, obj):
        return obj.sender.get_role_display()

    @admin.display(description="Message")
    def message_preview(self, obj):
        return obj.body[:100]

