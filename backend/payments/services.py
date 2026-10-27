from django.db import transaction
from django.utils import timezone
from downloads.models import DownloadEntitlement
from orders.models import Order
from .models import PaymentTransaction


@transaction.atomic
def confirm_verified_payment(transaction):
    transaction = PaymentTransaction.objects.select_for_update().select_related("order__user").get(pk=transaction.pk)
    if transaction.status == PaymentTransaction.Status.SUCCEEDED:
        return transaction
    order = Order.objects.select_for_update().get(pk=transaction.order_id)
    if transaction.amount != order.total or transaction.currency != order.currency:
        raise ValueError("Payment amount does not match the order.")
    transaction.status = PaymentTransaction.Status.SUCCEEDED
    transaction.processed_at = timezone.now()
    transaction.save(update_fields=("status", "processed_at"))
    order.status = Order.Status.PAID
    order.paid_at = timezone.now()
    order.save(update_fields=("status", "paid_at"))
    for item in order.items.select_related("product").all():
        for product_file in item.product.download_files.filter(is_active=True):
            DownloadEntitlement.objects.get_or_create(user=order.user, order_item=item, product_file=product_file)
    return transaction

