from django.db.models import Count
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Product
from custom_requests.models import CustomDesignRequest
from messaging.models import Conversation
from orders.models import Order

from .permissions import IsDesigner


class StudioDashboardView(APIView):
    permission_classes = (IsDesigner,)

    def get(self, request):
        # The exact inbox count is calculated per conversation so a newly-created
        # designer account still sees existing customer messages.
        unread_messages = 0
        for custom_request in CustomDesignRequest.objects.select_related("conversation"):
            try:
                last_read = custom_request.conversation.designer_last_read_at
            except Conversation.DoesNotExist:
                continue
            messages = custom_request.conversation.messages.exclude(sender=request.user)
            if last_read:
                messages = messages.filter(created_at__gt=last_read)
            unread_messages += messages.count()

        return Response({
            "products": Product.objects.count(),
            "published_products": Product.objects.filter(is_active=True).count(),
            "active_projects": CustomDesignRequest.objects.exclude(
                status__in=(CustomDesignRequest.Status.COMPLETED, CustomDesignRequest.Status.CANCELLED)
            ).count(),
            "new_projects": CustomDesignRequest.objects.filter(status=CustomDesignRequest.Status.SUBMITTED).count(),
            "unread_messages": unread_messages,
            "paid_orders": Order.objects.filter(status=Order.Status.PAID).count(),
            "recent_projects": list(
                CustomDesignRequest.objects.select_related("customer")
                .annotate(message_count=Count("conversation__messages"))
                .values("id", "title", "status", "customer__email", "updated_at", "message_count")[:5]
            ),
        })
