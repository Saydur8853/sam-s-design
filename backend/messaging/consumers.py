from channels.generic.websocket import AsyncJsonWebsocketConsumer


class MessageNotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close(code=4401)
            return
        self.group_name = "designers" if (user.is_staff or user.role == "DESIGNER") else f"user_{user.pk}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept(subprotocol="portal-realtime")

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def message_created(self, event):
        await self.send_json({
            "type": "message.created",
            "request_id": event["request_id"],
            "message_id": event["message_id"],
        })
