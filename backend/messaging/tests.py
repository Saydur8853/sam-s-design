from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.test import TransactionTestCase
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application
from custom_requests.models import CustomDesignRequest
from messaging.models import Conversation, Message
from messaging.tasks import send_new_message_email


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="notifications@example.com",
    FRONTEND_URL="https://sameulshajid.art",
)
class MessageEmailNotificationTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.customer = users.objects.create_user(
            email="customer@example.com", password="Long-test-pass-8472"
        )
        self.designer = users.objects.create_user(
            email="designer@example.com", password="Long-test-pass-8472", role="DESIGNER"
        )
        custom_request = CustomDesignRequest.objects.create(
            customer=self.customer,
            title="Eid campaign poster",
            request_type=CustomDesignRequest.RequestType.NEW_DESIGN,
        )
        self.conversation = Conversation.objects.create(request=custom_request)

    def test_customer_message_is_emailed_to_designer(self):
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.customer,
            body="Please use the new brand colors.",
        )

        sent = send_new_message_email.run(message.pk)

        self.assertEqual(sent, 1)
        self.assertEqual(mail.outbox[0].to, [self.designer.email])
        self.assertNotIn(self.customer.email, mail.outbox[0].to)
        self.assertIn("https://sameulshajid.art/studio", mail.outbox[0].body)
        self.assertIn("Please use the new brand colors.", mail.outbox[0].body)

    def test_designer_message_is_emailed_to_customer(self):
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.designer,
            body="The first draft is ready.",
        )

        sent = send_new_message_email.run(message.pk)

        self.assertEqual(sent, 1)
        self.assertEqual(mail.outbox[0].to, [self.customer.email])
        self.assertNotIn(self.designer.email, mail.outbox[0].to)
        self.assertIn("https://sameulshajid.art/custom-work", mail.outbox[0].body)


class MessageWebSocketTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="realtime@example.com", password="Long-test-pass-8472"
        )

    def test_authenticated_user_receives_message_event_immediately(self):
        token = str(AccessToken.for_user(self.user))
        async_to_sync(self._receive_event)(token, self.user.pk)

    async def _receive_event(self, token, user_id):
        communicator = WebsocketCommunicator(
            application,
            "/ws/messages/",
            subprotocols=["portal-realtime", f"jwt.{token}"],
            headers=[(b"origin", b"http://localhost")],
        )
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        self.assertEqual(subprotocol, "portal-realtime")

        await get_channel_layer().group_send(
            f"user_{user_id}",
            {"type": "message_created", "request_id": "request-123", "message_id": 42},
        )
        event = await communicator.receive_json_from(timeout=1)
        self.assertEqual(event["type"], "message.created")
        self.assertEqual(event["request_id"], "request-123")
        self.assertEqual(event["message_id"], 42)
        await communicator.disconnect()
