from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User


@database_sync_to_async
def _get_user(user_id):
    try:
        return User.objects.get(pk=user_id, is_active=True)
    except User.DoesNotExist:
        return AnonymousUser()


class JwtSubprotocolAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        token = next(
            (protocol[4:] for protocol in scope.get("subprotocols", []) if protocol.startswith("jwt.")),
            "",
        )
        user = AnonymousUser()
        if token:
            try:
                validated = AccessToken(token)
                user = await _get_user(validated["user_id"])
            except (TokenError, KeyError):
                pass
        return await self.app({**scope, "user": user}, receive, send)
