from django.db import connection
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Product


class HealthResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()


class HealthView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=HealthResponseSerializer)
    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return Response({"status": "ok", "service": "sameulshajid.art API"})


def sitemap_xml_view(request):
    """
    Dynamic XML sitemap including core pages, trust/legal pages, and all active catalog products.
    """
    base_url = "https://sameulshajid.art"
    today = timezone.now().date().isoformat()
    static_entries = [
        ("/", "weekly", "1.0"),
        ("/about", "monthly", "0.8"),
        ("/custom-work", "monthly", "0.8"),
        ("/privacy", "yearly", "0.5"),
        ("/terms", "yearly", "0.5"),
        ("/refunds", "yearly", "0.5"),
        ("/contact", "monthly", "0.6"),
    ]
    urls = [
        f"  <url><loc>{base_url}{path}</loc><lastmod>{today}</lastmod><changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
        for path, freq, prio in static_entries
    ]
    for product in Product.objects.filter(is_active=True).only("slug", "updated_at"):
        lastmod = product.updated_at.date().isoformat() if product.updated_at else today
        urls.append(
            f"  <url><loc>{base_url}/shop/{product.slug}</loc><lastmod>{lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return HttpResponse(xml, content_type="application/xml; charset=utf-8")


