from django.db import transaction

from .realtime import notify_new_message
from .tasks import send_new_message_email


def schedule_new_message_notifications(message) -> None:
    message_id = message.pk
    transaction.on_commit(lambda: notify_new_message(message), robust=True)
    transaction.on_commit(lambda: send_new_message_email.delay(message_id), robust=True)
