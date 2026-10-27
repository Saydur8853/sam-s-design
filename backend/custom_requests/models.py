import uuid
from django.conf import settings
from django.db import models


class CustomDesignRequest(models.Model):
    class RequestType(models.TextChoices):
        NEW_DESIGN = "NEW_DESIGN", "New custom design"
        CUSTOM_SIZE = "CUSTOM_SIZE", "Custom size/version"
        MODIFICATION = "MODIFICATION", "Existing design modification"
        OTHER = "OTHER", "Other design service"

    class Status(models.TextChoices):
        SUBMITTED = "SUBMITTED", "Submitted"
        UNDER_REVIEW = "UNDER_REVIEW", "Under review"
        NEEDS_INFORMATION = "NEEDS_INFORMATION", "Needs information"
        QUOTED = "QUOTED", "Quoted"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="custom_design_requests")
    title = models.CharField(max_length=180)
    request_type = models.CharField(max_length=30, choices=RequestType.choices)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.SUBMITTED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

    def __str__(self):
        return f"{self.title} — {self.customer.email}"

