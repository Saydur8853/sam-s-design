from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def notify_new_message(message):
    custom_request = message.conversation.request
    group_name = (
        f"user_{custom_request.customer_id}"
        if message.sender.is_staff or message.sender.role == "DESIGNER"
        else "designers"
    )
    async_to_sync(get_channel_layer().group_send)(
        group_name,
        {
            "type": "message_created",
            "request_id": str(custom_request.pk),
            "message_id": message.pk,
        },
    )
