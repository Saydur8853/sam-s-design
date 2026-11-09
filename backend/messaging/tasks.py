from html import escape
from urllib.parse import urljoin

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives

from .models import Message


def _sender_name(message: Message) -> str:
    profile = getattr(message.sender, "customer_profile", None)
    name = (getattr(profile, "display_name", "") or message.sender.get_full_name()).strip()
    return name or ("Designer" if message.sender.role == "DESIGNER" else message.sender.email)


def _recipient_emails(message: Message) -> tuple[list[str], str]:
    custom_request = message.conversation.request
    sender_is_designer = message.sender.is_staff or message.sender.role == "DESIGNER"
    if sender_is_designer:
        return [custom_request.customer.email], "custom-work"

    users = get_user_model().objects.filter(is_active=True).exclude(pk=message.sender_id)
    recipients = users.filter(role="DESIGNER").values_list("email", flat=True)
    staff_recipients = users.filter(is_staff=True).values_list("email", flat=True)
    return sorted(set(recipients).union(staff_recipients)), "studio"


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=5,
)
def send_new_message_email(self, message_id: int) -> int:
    message = (
        Message.objects.select_related(
            "sender",
            "sender__customer_profile",
            "conversation__request__customer",
        )
        .prefetch_related("attachments")
        .get(pk=message_id)
    )
    recipients, route = _recipient_emails(message)
    if not recipients:
        return 0

    custom_request = message.conversation.request
    sender_name = _sender_name(message)
    message_preview = message.body.strip()
    if not message_preview:
        attachment_count = len(message.attachments.all())
        message_preview = f"Sent {attachment_count} attachment{'s' if attachment_count != 1 else ''}."
    if len(message_preview) > 500:
        message_preview = f"{message_preview[:497]}..."

    conversation_url = urljoin(f"{settings.FRONTEND_URL.rstrip('/')}/", route)
    subject = f"New message: {custom_request.title}"
    text_body = (
        f"{sender_name} sent a new message about {custom_request.title}.\n\n"
        f"{message_preview}\n\n"
        f"Open the conversation: {conversation_url}"
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#24211d;line-height:1.6">
      <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#777">New project message</p>
      <h1 style="font-size:24px;margin:0 0 8px">{escape(custom_request.title)}</h1>
      <p><strong>{escape(sender_name)}</strong> sent you a message:</p>
      <div style="padding:16px 18px;background:#f5f2ec;border-left:3px solid #24211d;white-space:pre-wrap">{escape(message_preview)}</div>
      <p style="margin-top:24px"><a href="{escape(conversation_url, quote=True)}" style="display:inline-block;padding:12px 18px;background:#24211d;color:#fff;text-decoration:none">Open conversation</a></p>
      <p style="font-size:12px;color:#777">You received this email because you participate in this custom-work conversation.</p>
    </div>
    """

    email = EmailMultiAlternatives(subject, text_body, settings.DEFAULT_FROM_EMAIL, recipients)
    email.attach_alternative(html_body, "text/html")
    return email.send(fail_silently=False)
