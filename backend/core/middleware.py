from urllib.parse import urlparse

from django.conf import settings
from django.http import HttpResponseForbidden


class ArtworkSecurityMiddleware:
    """
    Protects designer artwork and media assets against hotlinking, third-party embedding,
    and automated image/AI scraping.
    """

    ALLOWED_HOSTS = {"localhost", "127.0.0.1", "sameulshajid.art", "www.sameulshajid.art"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path or ""
        is_media = path.startswith(settings.MEDIA_URL)

        if is_media:
            # Block cross-site hotlinking when Sec-Fetch-Site or Referer indicates an external site
            sec_fetch_site = (request.META.get("HTTP_SEC_FETCH_SITE") or "").lower()
            if sec_fetch_site == "cross-site":
                return HttpResponseForbidden("Hotlinking to artwork is prohibited.")

            referer = request.META.get("HTTP_REFERER") or ""
            if referer:
                parsed = urlparse(referer)
                host = (parsed.hostname or "").lower()
                if host and host not in self.ALLOWED_HOSTS:
                    return HttpResponseForbidden("External hotlinking to artwork is prohibited.")

        response = self.get_response(request)

        if is_media or path.startswith("/api/v1/catalog/"):
            response["X-Robots-Tag"] = "noimageindex, noarchive, nosnippet"
            response["Cross-Origin-Resource-Policy"] = "same-origin"

        return response

