from urllib.parse import urlparse

from django.conf import settings
from django.http import HttpResponseForbidden


class ArtworkSecurityMiddleware:
    """
    Protects designer artwork and media assets against hotlinking, third-party embedding,
    and automated image/AI scraping, while allowing verified social preview crawlers
    (such as Pinterest, Google, Facebook, Twitter/X, LinkedIn) to fetch watermarked
    preview images and build rich link previews.
    """

    ALLOWED_HOSTS = {
        "localhost",
        "127.0.0.1",
        "sameulshajid.art",
        "www.sameulshajid.art",
    }

    TRUSTED_REFERRER_SUFFIXES = (
        "sameulshajid.art",
        "pinterest.com",
        "pinimg.com",
        "pin.it",
        "google.com",
        "bing.com",
        "facebook.com",
        "fb.com",
        "twitter.com",
        "x.com",
        "t.co",
        "linkedin.com",
    )

    TRUSTED_BOT_TOKENS = (
        "pinterest",
        "googlebot",
        "bingbot",
        "facebookexternalhit",
        "facebot",
        "twitterbot",
        "linkedinbot",
        "slackbot",
        "discordbot",
        "whatsapp",
        "telegrambot",
        "applebot",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    @classmethod
    def _is_trusted_crawler(cls, request) -> bool:
        user_agent = (request.META.get("HTTP_USER_AGENT") or "").lower()
        return any(token in user_agent for token in cls.TRUSTED_BOT_TOKENS)

    @classmethod
    def _is_trusted_referer_host(cls, host: str) -> bool:
        if not host:
            return True
        host = host.lower()
        if host in cls.ALLOWED_HOSTS:
            return True
        return any(host == suffix or host.endswith(f".{suffix}") for suffix in cls.TRUSTED_REFERRER_SUFFIXES)

    def __call__(self, request):
        path = request.path or ""
        is_media = path.startswith(settings.MEDIA_URL)
        is_trusted_crawler = self._is_trusted_crawler(request)

        if is_media and not is_trusted_crawler:
            referer = request.META.get("HTTP_REFERER") or ""
            parsed_host = (urlparse(referer).hostname or "").lower() if referer else ""
            is_trusted_referer = self._is_trusted_referer_host(parsed_host)

            if referer and not is_trusted_referer:
                return HttpResponseForbidden("External hotlinking to artwork is prohibited.")

            # Block cross-site hotlinking when Sec-Fetch-Site indicates an untrusted external site
            sec_fetch_site = (request.META.get("HTTP_SEC_FETCH_SITE") or "").lower()
            if sec_fetch_site == "cross-site" and not (referer and is_trusted_referer):
                return HttpResponseForbidden("Hotlinking to artwork is prohibited.")

        response = self.get_response(request)

        # Apply strict anti-scraping headers on API catalog responses and untrusted media requests,
        # while allowing social crawlers and Pin widgets to read watermarked preview media.
        if path.startswith("/api/v1/catalog/"):
            response["X-Robots-Tag"] = "noarchive"
        elif is_media:
            if is_trusted_crawler:
                response["Cross-Origin-Resource-Policy"] = "cross-origin"
            else:
                response["X-Robots-Tag"] = "noarchive"
                response["Cross-Origin-Resource-Policy"] = "cross-origin"

        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(self), usb=()",
        )

        return response


