from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from messaging.models import Conversation
from .models import CustomDesignRequest


class ConversationInline(admin.StackedInline):
    model = Conversation
    extra = 0


@admin.register(CustomDesignRequest)
class CustomDesignRequestAdmin(admin.ModelAdmin):
    list_display = ("title", "customer", "request_type", "status", "updated_at", "reply_link")
    list_filter = ("request_type", "status")
    list_editable = ("status",)
    search_fields = ("title", "customer__email")
    inlines = (ConversationInline,)

    @admin.display(description="Message")
    def reply_link(self, obj):
        try:
            conversation_id = obj.conversation.pk
        except Conversation.DoesNotExist:
            return "—"
        url = reverse("admin:messaging_message_add")
        return format_html('<a class="button" href="{}?conversation={}">Reply</a>', url, conversation_id)

