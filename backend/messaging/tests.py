from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application


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
