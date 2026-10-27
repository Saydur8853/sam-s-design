from decimal import Decimal
from django.db import transaction
from .models import Order, OrderItem


@transaction.atomic
def create_order(user, product_quantities):
    entries = [(product, quantity) for product, quantity in product_quantities if product.is_active]
    if not entries:
        raise ValueError("There are no purchasable products.")
    currencies = {product.currency for product, _ in entries}
    if len(currencies) != 1:
        raise ValueError("All products in an order must use the same currency.")
    total = sum((product.price * quantity for product, quantity in entries), Decimal("0.00"))
    order = Order.objects.create(user=user, total=total, currency=currencies.pop())
    OrderItem.objects.bulk_create([OrderItem(order=order, product=product, product_title=product.title, unit_price=product.price, quantity=quantity) for product, quantity in entries])
    return order

