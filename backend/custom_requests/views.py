from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from core.permissions import IsDesigner
from messaging.models import MessageAttachment
from .models import CustomDesignRequest
from .serializers import CustomDesignRequestSerializer, StudioCustomDesignRequestSerializer


class CustomRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomDesignRequestSerializer

    def get_queryset(self):
        queryset = CustomDesignRequest.objects.select_related("customer").prefetch_related("conversation__messages")
        if self.request.user.is_staff or self.request.user.role == "DESIGNER":
            return queryset
        return queryset.filter(customer=self.request.user)

    def perform_create(self, serializer):
        if self.request.user.is_staff or self.request.user.role == "DESIGNER":
            raise PermissionDenied("Designer accounts cannot create customer requests.")
        serializer.save()


class CustomRequestDetailView(generics.DestroyAPIView):
    serializer_class = CustomDesignRequestSerializer

    def get_queryset(self):
        queryset = CustomDesignRequest.objects.select_related("customer")
        if self.request.user.is_staff or self.request.user.role == "DESIGNER":
            return queryset
        return queryset.filter(customer=self.request.user)

    def perform_destroy(self, instance):
        for attachment in MessageAttachment.objects.filter(message__conversation__request=instance):
            if attachment.file:
                try:
                    attachment.file.delete(save=False)
                except OSError:
                    pass
        instance.delete()


class CustomRequestStudioDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = StudioCustomDesignRequestSerializer
    permission_classes = (IsDesigner,)
    http_method_names = ("get", "patch", "head", "options")
    queryset = CustomDesignRequest.objects.select_related("customer", "conversation").prefetch_related("conversation__messages")

    def get_serializer(self, *args, **kwargs):
        if self.request.method == "PATCH":
            kwargs.setdefault("partial", True)
        return super().get_serializer(*args, **kwargs)

