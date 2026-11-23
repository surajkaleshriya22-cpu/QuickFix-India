# QuickFix-India Universal Super App Roadmap

## Product promise

**One app. Many kinds of work. One account. One connected platform.**

QuickFix-India is intended to grow into a broad everyday-services platform for India, with a path to other markets. Customers should not need a different app for each category of work. All supported verticals live inside the same QuickFix-India customer experience and use a shared identity, address book, search, notifications, support and trust layer.

This roadmap expands the existing one-app/many-services direction. It does not authorize a second app, a new brand, or a replacement repository.

## Experience surfaces

- **Customer app:** one home screen, one account, one search, one cart/booking history and one support/safety entry point. Category-specific steps appear only after a customer chooses a service.
- **Channel Partner mode:** one partner identity and app experience. A partner can qualify for one or more work categories; each category has its own eligibility, schedule, job workflow, wallet ledger and payout rules.
- **Admin control centre:** one operations system for departments, categories, partner verification, service areas, pricing, commissions, safety cases, disputes, refunds and reporting.

## Service departments

The catalogue is designed to expand through configuration rather than separate apps:

1. **Home and property:** electrician, plumber, AC/fridge/appliance repair, cleaning, cooking, laundry, carpenter, painter, gardener, pest control, movers and contractors.
2. **Mobility:** bike taxi/captain, car rides, driver-on-demand, vehicle repair and roadside assistance.
3. **Delivery and logistics:** parcels, local pickup/drop, grocery/food delivery, courier and house shifting.
4. **Food and daily shopping:** restaurant discovery/order, groceries, essentials, local stores and product marketplace.
5. **Travel and local discovery:** bus/train/flight/hotel discovery or booking through authorized integrations, local guides, tours and experiences.
6. **Health and care:** appointment discovery, home sample collection or home care only through appropriately licensed/verified providers; emergency services must never be misrepresented as guaranteed.
7. **Education and skills:** tutors, classes, training, test preparation and verified learning providers.
8. **Jobs and professional work:** local jobs, skilled projects, freelancers, contractors and business services.
9. **Agriculture and rural services:** farm equipment rental, repair, input/service discovery, transport and verified local experts.
10. **Bills and money tools:** bill reminders/payment integrations, receipts and a unified transaction view. Regulated financial activity must use authorized providers; QuickFix must not hold or move customer funds outside compliant payment rails.
11. **Community and safety:** verified help, complaint resolution, emergency contacts, trip/job sharing, SOS escalation and audit trails.

These are target departments, not a claim that every service is currently live. Third-party-like capabilities require lawful integrations, commercial agreements, licenses and operational capacity; QuickFix must not copy another company's private platform or imply an affiliation.

## Shared platform foundation

Build reusable platform capabilities once, then connect departments to them:

- Identity and role/permission model for customers, multi-skill partners, department operators and admins.
- Canonical service catalogue with category, subcategory, service questions, pricing unit, eligibility, SLA, cancellation policy and availability status.
- Location hierarchy: country, state, district, tehsil/taluka, city, locality, pincode and map coordinates; serviceability is checked per category and locality.
- Common order/booking engine with category-specific workflow definitions and state transitions.
- Discovery/search, ratings, reviews, saved addresses, notifications, customer support and complaint management.
- Partner KYC, qualification, background checks where lawful, safety checklists, job history and category-specific wallets/ledgers.
- Secure payment orchestration, refunds and payouts through verified provider APIs and signed webhooks; never show a payment as settled based only on a client-side action.
- Admin audit log, fraud/risk controls, access control, data minimization and retention rules.

## Architecture rule

Use a **modular monolith first**, not dozens of disconnected services: shared identity, catalogue, location, order, payment, notification and safety modules with explicit department boundaries. Keep Android and web customer experiences aligned through shared API contracts and a canonical catalogue. Extract independently scalable services only when real load and team ownership justify it.

A category is not production-ready merely because it appears on a screen. It is launchable only when its customer flow, qualified partner flow, service-area coverage, pricing, dispatch, safety, support, admin operations and end-to-end tests are all verified.

## Delivery sequence

### Phase 0 — stabilize the existing foundation
- Keep working in this repository and preserve the current app identity.
- Close critical authentication/OTP and profile-security gaps.
- Establish shared catalogue and service-area contracts across web and Android.
- Remove demo/mock records from any customer-facing live availability or price claims.

### Phase 1 — make the existing marketplace dependable
- Complete and physically verify core home-service booking and partner workflows.
- Make location, dispatch, tracking, cancellation, support and safety operational.
- Make category pricing and partner wallets/ledgers server-authoritative.
- Launch only in localities with real verified partner coverage.

### Phase 2 — add adjacent high-frequency departments
- Add delivery/logistics, local shopping and food ordering as separate modules within the same app.
- Reuse identity, address, search, order status, support, notifications and payment orchestration.
- Add the correct merchant/rider/restaurant partner types and their own compliance checks.

### Phase 3 — broaden the ecosystem
- Add mobility, travel, education, jobs, healthcare/care and agriculture through verified operators and lawful integrations.
- Build department-specific workflows without fragmenting the customer account or app.

### Phase 4 — scale across India and then internationally
- Expand state/district/tehsil coverage based on verified supply and support readiness.
- Add localization, currencies, tax and legal controls per market before international launch.

## Release gates and honest status

For every department, report these separately:
1. UI present
2. API/backend implemented
3. Security and admin controls tested
4. CI/build passed
5. End-to-end integration tests passed
6. Real-device/real-provider verification passed
7. Service area and operational supply live

Never combine these into a single “complete” claim. Do not advertise nationwide availability when only a subset of localities is serviceable.

## Immediate engineering priority

Before adding many disconnected category tiles, implement the canonical catalogue and department configuration contract used by both Android and web. Then attach each vertical to the shared booking/order engine and partner eligibility model. This is the foundation that lets QuickFix grow without becoming a collection of unrelated mini-apps.
