# Graphic Design Marketplace — Project Plan

## 1. Project Overview

এই ওয়েবসাইটটি একজন graphic designer-এর নিজস্ব digital design marketplace ও custom-work portal হিসেবে কাজ করবে। Designer এখানে poster, print-ready design, template এবং অন্যান্য digital design upload ও sell করতে পারবেন। Customer ready-made design কিনতে পারবেন, custom design বা modification request করতে পারবেন, designer-এর সঙ্গে যোগাযোগ করতে পারবেন এবং payment সম্পন্ন হওয়ার পরে original file download করতে পারবেন।

## 2. Plan Assessment

প্রাথমিক পরিকল্পনাটি বাস্তবসম্মত এবং Django এই project-এর জন্য ভালো পছন্দ, কারণ:

- Django-তে built-in admin panel আছে, যা designer-এর product, order, request এবং customer management সহজ করবে।
- Django REST Framework ব্যবহার করে Angular frontend-এর জন্য নিরাপদ API তৈরি করা যাবে।
- Permission, authentication, payment record এবং protected download Django দিয়ে নির্ভরযোগ্যভাবে নিয়ন্ত্রণ করা যাবে।
- ভবিষ্যতে একাধিক designer, coupon, subscription বা marketplace feature যোগ করার সুযোগ থাকবে।

Frontend-এর জন্য legacy **AngularJS (1.x)** ব্যবহার করা উচিত নয়। এটি আর actively supported নয়। এই project-এ modern **Angular** ব্যবহার করা হবে।

## 3. Proposed Technology Stack

### Backend

- Python
- Django
- Django REST Framework (REST API)
- Django Admin
- PostgreSQL
- Celery + Redis (email, watermark generation এবং background job-এর জন্য; প্রয়োজন অনুযায়ী)

### Frontend

- Modern Angular
- Angular Router
- Angular Material বা অন্য responsive UI library
- Secure token/cookie-based authentication

### File and Media Storage

- Development: local/private media storage
- Production: private object storage, যেমন Amazon S3, Cloudflare R2 বা compatible service
- Preview-এর জন্য server-generated watermarked image
- Original file private থাকবে; public URL দেওয়া হবে না
- Paid customer-এর জন্য short-lived signed download URL অথবা authenticated download endpoint

### Deployment

- Docker-based deployment বিবেচনা করা হবে
- Nginx reverse proxy
- Django application server
- HTTPS বাধ্যতামূলক
- Database backup এবং private media backup

## 4. User Roles

### Visitor

- Product browse ও search করতে পারবেন
- Watermarked preview দেখতে পারবেন
- Product details ও price দেখতে পারবেন
- Account তৈরি বা login করতে পারবেন

### Customer

- Cart-এ product যোগ করতে পারবেন
- Checkout ও payment করতে পারবেন
- Purchased original files download করতে পারবেন
- Custom design request করতে পারবেন
- Existing design modification request করতে পারবেন
- Custom size/specification দিতে পারবেন
- Reference/sample file upload করতে পারবেন
- Designer-এর সঙ্গে portal message অথবা email notification-এর মাধ্যমে যোগাযোগ করতে পারবেন
- Partial এবং due payment করতে পারবেন
- নিজের order, request, invoice এবং download history দেখতে পারবেন

### Designer/Admin

- Product এবং category তৈরি ও manage করতে পারবেন
- Preview, watermarked file এবং original/source file manage করতে পারবেন
- Price, license এবং available file formats নির্ধারণ করতে পারবেন
- Order এবং payment status দেখতে পারবেন
- Custom request review ও reply করতে পারবেন
- Quote, deadline এবং partial-payment offer দিতে পারবেন
- Draft/sample submit করতে পারবেন
- Revision ও final delivery manage করতে পারবেন
- Customer-এর access/download permission নিয়ন্ত্রণ করতে পারবেন

## 5. Product Types

- Ready-made poster/design
- Print-ready artwork
- Editable template
- Social media design pack
- Custom-sized version of an existing design
- Modification of an existing design
- Fully custom design service

প্রতিটি ready-made product-এ নিম্নের তথ্য থাকতে পারে:

- Title এবং description
- Category এবং tags
- Price এবং currency
- Watermarked preview images
- Original/downloadable files
- File type, dimension, resolution এবং color mode
- Print specifications
- License type এবং usage terms
- Featured/active status

## 6. Core Customer Flow

### Ready-made Product Purchase

1. Customer watermarked preview দেখে product নির্বাচন করবেন।
2. Product cart-এ যোগ করবেন।
3. Checkout-এর সময় account, billing information এবং payment method দেবেন।
4. Payment gateway সফল payment নিশ্চিত করবে।
5. Order `PAID` হবে এবং customer original file download access পাবেন।
6. Download authenticated endpoint বা expiring signed URL দিয়ে হবে।
7. Customer email ও dashboard-এ receipt এবং download option পাবেন।

### Custom Design / Modification Request

1. Customer request type নির্বাচন করবেন:
   - New custom design
   - Custom size/version
   - Existing purchased design modification
   - অন্য কোনো design service
2. Customer brief, dimensions, file format, deadline, budget এবং reference files submit করবেন।
3. Designer portal message এবং প্রয়োজনে email-এর মাধ্যমে প্রয়োজনীয় আলোচনা করবেন।
4. Designer total price, advance amount/percentage, scope, revision limit এবং estimated delivery date-সহ offer দেবেন।
5. Customer offer accept করে partial/advance payment করবেন।
6. Designer কাজ শুরু করে watermarked বা low-resolution sample submit করবেন।
7. Customer feedback দেবেন এবং agreed revision cycle চলবে।
8. Designer final preview approve করাবেন এবং remaining balance invoice করবেন।
9. Full payment সফল হলে original/final files-এর download access চালু হবে।
10. Request complete হিসেবে marked হবে।

## 7. Suggested Status Models

### Ready-made Order Status

- `PENDING_PAYMENT`
- `PAID`
- `PAYMENT_FAILED`
- `CANCELLED`
- `REFUNDED`

### Custom Request Status

- `SUBMITTED`
- `UNDER_REVIEW`
- `NEEDS_INFORMATION`
- `QUOTED`
- `AWAITING_ADVANCE`
- `IN_PROGRESS`
- `SAMPLE_SUBMITTED`
- `REVISION_REQUESTED`
- `AWAITING_FINAL_PAYMENT`
- `COMPLETED`
- `CANCELLED`
- `DISPUTED`

### Payment Status

- `CREATED`
- `PENDING`
- `SUCCEEDED`
- `FAILED`
- `PARTIALLY_REFUNDED`
- `REFUNDED`

## 8. Payment Design

Website-এ একাধিক international payment gateway support করার জন্য একটি common payment abstraction/service layer রাখা হবে। সম্ভাব্য provider business location এবং eligibility অনুযায়ী নির্বাচন করতে হবে, যেমন Stripe, PayPal বা অন্য supported gateway।

গুরুত্বপূর্ণ নিয়ম:

- Frontend redirect/success message-এর ওপর ভিত্তি করে order paid করা যাবে না।
- Gateway webhook server-side verify হওয়ার পরে payment সফল ধরা হবে।
- প্রতিটি transaction-এর gateway reference, amount, currency এবং status সংরক্ষণ করতে হবে।
- Duplicate webhook আটকাতে idempotency ব্যবস্থা রাখতে হবে।
- Custom work-এর total, advance paid এবং remaining due আলাদাভাবে track করতে হবে।
- Full payment না হওয়া পর্যন্ত final file locked থাকবে।
- Refund, cancellation, tax এবং invoice policy implementation-এর আগে নির্ধারণ করতে হবে।

## 9. File Security and Watermarking

- Original/source files private storage-এ থাকবে এবং সরাসরি publicly accessible হবে না।
- Upload-এর পরে preview image তৈরি হবে এবং তাতে visible watermark যোগ হবে।
- Product page-এ শুধু watermarked preview ব্যবহার করা হবে।
- Custom work-এর sample-ও watermarked বা reduced-resolution হবে।
- Backend payment এবং ownership verify করে download অনুমতি দেবে।
- Download link short-lived এবং non-guessable হবে।
- Download event log করা হবে: customer, order, file, time এবং প্রয়োজনে IP/device metadata।
- Rate limit ও download-count policy যোগ করা যেতে পারে।
- Watermark deterrent হিসেবে কাজ করে; screenshot বা copying সম্পূর্ণভাবে বন্ধ করতে পারে না—license terms-ও প্রয়োজন।

## 10. Main Backend Modules

- `accounts`: registration, login, profile, roles এবং password reset
- `catalog`: products, categories, tags, previews, files এবং licenses
- `cart`: shopping cart এবং cart items
- `orders`: checkout, ready-made orders এবং order items
- `payments`: gateways, transactions, webhooks, refunds এবং invoices
- `custom_requests`: briefs, quotes, milestones, revisions এবং delivery
- `messaging`: request-based conversations, messages এবং attachments
- `downloads`: entitlements, protected delivery এবং download logs
- `notifications`: email এবং in-app notifications
- `core`: shared settings, audit logs এবং common utilities

## 11. Initial Data Model

- User
- CustomerProfile
- Category
- Product
- ProductPreview
- ProductFile
- License
- Cart
- CartItem
- Order
- OrderItem
- PaymentTransaction
- DownloadEntitlement
- DownloadLog
- CustomDesignRequest
- RequestAttachment
- Quote
- Milestone/PaymentSchedule
- Conversation
- Message
- Revision
- FinalDelivery
- Notification
- AuditLog

## 12. Essential Screens

### Public/Customer Frontend

- Home page
- Shop/product listing
- Category and search results
- Product details with watermarked gallery
- Cart
- Checkout
- Payment result
- Login, registration এবং password reset
- Customer dashboard
- Orders and downloads
- Custom request form
- Request details, quote এবং payment screen
- Request conversation/chat
- Sample review এবং revision submission
- Final payment এবং final download
- Terms, privacy, refund এবং license pages

### Designer/Admin

- Django Admin for products, orders, customers এবং configuration
- Custom request work queue
- Quote creation and update
- Message and attachment review
- Sample/final delivery upload
- Payment এবং download audit view

প্রথম version-এ Django Admin দিয়েই অধিকাংশ management করা যাবে। প্রয়োজন হলে পরে dedicated designer dashboard তৈরি করা হবে।

## 13. Communication Model

- প্রতিটি custom request-এর জন্য আলাদা conversation thread থাকবে।
- Customer এবং designer short text message ও attachment exchange করতে পারবেন।
- নতুন message, quote, payment বা delivery হলে email notification যাবে।
- Sensitive কাজের আলোচনা portal-এ সংরক্ষণ করাই primary পদ্ধতি হবে, যাতে history ও dispute evidence থাকে।
- Email notification থেকে customer portal-এর সংশ্লিষ্ট request-এ ফিরে আসবেন।

## 14. Security Requirements

- HTTPS এবং secure production settings
- Strong authentication ও password reset
- Role-based permissions
- CSRF/CORS configuration
- Upload file type, MIME, size এবং malware validation
- Private file storage
- Payment webhook signature verification
- API throttling/rate limiting
- Admin account-এ 2FA বিবেচনা
- Audit logging
- Regular database/file backups
- Secrets environment variables বা secret manager-এ রাখা
- Personally identifiable information-এর সীমিত সংগ্রহ ও সুরক্ষা

## 15. Business Rules to Finalize

Implementation-এর আগে নিচের সিদ্ধান্তগুলো চূড়ান্ত করতে হবে:

- কোন দেশ/business entity থেকে payment গ্রহণ করা হবে
- Supported currencies
- Payment gateway eligibility এবং fees
- Advance payment fixed amount নাকি percentage
- Minimum advance percentage
- Revision-এর সংখ্যা ও extra revision charge
- Delivery deadline policy
- Cancellation/refund policy
- Commercial/personal/extended license terms
- Tax/VAT এবং invoice requirements
- Download expiry বা maximum download count
- Customer-uploaded এবং final file retention period
- Chargeback/dispute handling

## 16. MVP Scope

প্রথম release-এ:

- Customer registration/login
- Product catalog এবং watermarked previews
- Product details, cart এবং checkout
- একটি payment gateway
- Successful payment-এর পরে protected download
- Customer order/download dashboard
- Custom design/modification request form
- Designer quote with advance and due amount
- Request-based messaging and attachments
- Sample/revision workflow
- Final payment-এর পরে protected final download
- Email notifications
- Django Admin management
- Basic legal/policy pages

MVP-তে বাদ রাখা যেতে পারে:

- Multiple sellers/designers
- Real-time WebSocket chat
- Mobile app
- Subscription
- Affiliate/referral system
- Multiple payment gateways একসঙ্গে
- Advanced analytics
- Automated tax calculation for many countries

## 17. Suggested Implementation Phases

### Phase 1 — Discovery and Foundation

- Business rules এবং license/refund policy final করা
- Wireframe এবং UI direction
- Django, DRF, Angular এবং PostgreSQL project setup
- Authentication এবং user roles

### Phase 2 — Product Store

- Catalog, product upload এবং admin configuration
- Watermarked preview pipeline
- Product browsing, cart এবং checkout UI
- Payment gateway ও webhook integration
- Protected downloads

### Phase 3 — Custom Work Portal

- Custom request এবং attachment upload
- Conversation/message system
- Quote, advance এবং due-payment workflow
- Sample, revision এবং final-delivery workflow

### Phase 4 — Hardening and Launch

- Email notifications
- Security review
- Payment/download testing
- Backup, logging এবং monitoring
- Legal pages and launch checklist
- Production deployment

## 18. Acceptance Criteria for the MVP

- Unpaid users original product file access করতে পারবেন না।
- Successful verified payment-এর পরে buyer original file download করতে পারবেন।
- Designer watermarked preview এবং private original file আলাদাভাবে manage করতে পারবেন।
- Customer reference file-সহ custom request submit করতে পারবেন।
- Designer scope, total, advance এবং balance-সহ quote দিতে পারবেন।
- Advance payment ছাড়া custom request `IN_PROGRESS` হবে না, যদি designer তা require করেন।
- Full balance paid না হওয়া পর্যন্ত final custom file locked থাকবে।
- Customer ও designer request-এর মধ্যে message এবং attachment exchange করতে পারবেন।
- গুরুত্বপূর্ণ status change email এবং dashboard-এ visible হবে।
- Payment, status change এবং download-এর audit record থাকবে।

## 19. Testing Priorities

- Permission and unauthorized download tests
- Payment success, failure, retry এবং duplicate webhook tests
- Partial/final payment calculation tests
- Cart/order price consistency tests
- File upload validation tests
- Watermark generation tests
- Quote acceptance এবং revision workflow tests
- Email notification tests
- Responsive UI এবং accessibility checks
- Backup restore test before launch

## 20. Current Decisions

- Backend: Django + Django REST Framework
- Administration: Django Admin
- Frontend: Modern Angular, not legacy AngularJS
- Database: PostgreSQL
- Product previews: watermarked
- Original files: private and downloadable only after verified full payment
- Custom work: quote → advance payment → work/sample/revision → remaining payment → final download
- Communication: portal conversation with email notifications
- Initial product model: single-designer store, with future expansion possible

## 21. Next Step

পরবর্তী implementation session-এ প্রথমে business rules final করে project architecture, database schema এবং API contract তৈরি করা হবে। এরপর Django/Angular project scaffold করে Phase 1 শুরু করা যাবে।
