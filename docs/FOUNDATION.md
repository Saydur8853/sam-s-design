# Phase 1 foundation

## Product identity

- Brand and production domain: **sameulshajid.art**
- Initial model: a single-designer digital storefront with a customer portal
- Public product previews are watermarked; originals and final custom files remain private

## Working MVP assumptions

These defaults unblock development and can be changed before payment integration:

- Base currency: USD, represented as an ISO code and decimal amounts (never floating point)
- Custom-work advance: configurable per quote; suggested default 50%
- Included revisions: configurable per quote; suggested default 2
- Download entitlement: granted only after a server-verified full payment
- Download links: authenticated and short-lived; every attempt is logged
- Payment provider: selected in Phase 2 after business-country eligibility is confirmed
- Legal, refund, tax, file-retention, and license wording must be approved before launch

## Architecture

```text
Angular storefront / customer portal
              |
          JSON over HTTPS
              |
Django REST API + Django Admin
   |          |          |
PostgreSQL  private    background jobs
            storage    (Redis/Celery later)
```

The backend is the authority for pricing, payments, roles, and download access. The browser never decides that an order is paid and never receives a permanent public original-file URL.

## Module boundaries

- `accounts`: identity, authentication, customer profile, roles
- `catalog`: categories, products, licenses, previews, private product files
- `cart`: customer carts and items
- `orders`: immutable checkout snapshots and ready-made orders
- `payments`: provider-neutral transactions and verified webhooks
- `custom_requests`: brief, quote, sample, revision, and final-delivery workflow
- `messaging`: request-scoped conversations and attachments
- `downloads`: entitlements, expiring delivery, and logs
- `notifications`: email and in-app notifications
- `core`: shared utilities, health, and audit concerns

Only `core` and `accounts` are implemented in the first foundation slice. Later modules should follow these boundaries rather than being placed in one large app.

## Initial API contract

All endpoints are below `/api/v1/` and JSON unless noted.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health/` | Public | Service readiness |
| POST | `/auth/register/` | Public | Create a customer account and return JWTs |
| POST | `/auth/token/` | Public | Sign in using email/password |
| POST | `/auth/token/refresh/` | Public | Refresh access token |
| GET/PATCH | `/auth/me/` | Authenticated | Read/update the current profile |

Future catalog resources will use `/products/`, `/categories/`, `/cart/`, `/orders/`, `/custom-requests/`, and `/downloads/`. OpenAPI is available at `/api/schema/` and Swagger UI at `/api/docs/`.

## Implemented ready-made purchase flow

- Authenticated server-side cart with add/remove and server-calculated totals
- Direct “Buy now” order creation that bypasses the cart
- Immutable order-item title and price snapshots
- Provider-neutral payment transaction records
- Development-only hosted Demo Gateway; it uses no real money or card details
- Idempotent backend payment confirmation that grants download entitlements
- Authenticated original-file delivery with download audit logs

The Demo Gateway deliberately cannot run when `DJANGO_DEBUG=false`. A production provider must be selected after the business country, eligibility, fees, currency, tax, and refund rules are finalized. Its verified webhook will call the same backend payment-confirmation service; a frontend success redirect alone never marks an order paid.

## Security baseline

- Public registration can only create a `CUSTOMER`; designer/admin elevation is admin-only.
- Email addresses are normalized and unique.
- JWT access tokens are short-lived; refresh tokens rotate and are blacklisted.
- Production refuses permissive host/CORS defaults and enables secure proxy/cookie settings.
- Secrets are read from environment variables and `.env` is ignored.
- Product originals must eventually use a storage backend separate from public previews.

