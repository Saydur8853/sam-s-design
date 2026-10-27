from django.core.signing import TimestampSigner
from rest_framework import serializers
from .models import DownloadEntitlement


class DownloadEntitlementSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="order_item.product_title", read_only=True)
    display_name = serializers.CharField(source="product_file.display_name", read_only=True)
    download_url = serializers.SerializerMethodField()
    download_count = serializers.SerializerMethodField()
    remaining_downloads = serializers.SerializerMethodField()

    class Meta:
        model = DownloadEntitlement
        fields = (
            "id",
            "product_title",
            "display_name",
            "granted_at",
            "download_url",
            "max_downloads",
            "download_count",
            "remaining_downloads",
        )

    def get_download_url(self, obj):
        signer = TimestampSigner(salt="sameulshajid.download")
        token = signer.sign(f"{obj.pk}:{obj.user_id}")
        return f"/api/v1/downloads/{obj.pk}/file/?token={token}"

    def get_download_count(self, obj):
        return obj.logs.count()

    def get_remaining_downloads(self, obj):
        return max(0, obj.max_downloads - obj.logs.count())


