# QuickFix-India product direction: one app, many services

## North star
QuickFix-India is a unified, India-wide multi-service platform. The customer installs one app—QuickFix-India—to request many kinds of everyday work. Do not split service verticals into separate customer apps or separate brands.

## One app, shared foundation
All service verticals use the same:
- Customer identity, profile, saved addresses and language preference.
- Channel Partner identity, onboarding, KYC, availability and safety controls.
- Service discovery, search, location, state/district/tehsil coverage and booking history.
- Booking status, notifications, customer support, complaint and emergency/safety workflows.
- Admin control centre, audit trail and service-quality monitoring.

## Service catalogue (expandable)
1. Home repair: electrician, plumber, AC, fridge and appliance technician.
2. Home and daily help: cleaning, cooking, laundry, maid, carpenter, painter, gardener and pest control.
3. Mobility and transport: QuickFix Bike Taxi Captain, driver and future vehicle services.
4. Delivery and moving: rider/captain, parcel delivery and house shifting.
5. Skilled trades and projects: welder/fabricator, mechanic and contractor.
6. Local expertise: tourist guide and additional local services.
7. Future categories: add through the same catalogue and Admin controls, not a new app.

## Category-specific workflows inside the same app
A single platform does not mean every job has the same form. Each category can define its own:
- Required partner qualification and KYC.
- Booking questions, service duration, pricing unit, quote/inspection and cancellation rules.
- Dispatch/assignment and route requirements.
- Commission, wallet, reserve and payout policy.
- Customer/partner safety checklist and completion evidence.

These are configurations and workflows within QuickFix-India, not separate apps.

## Product experience
- Hindi-first/simple-language option with English toggle.
- Large service tiles, voice/search, clear prices and a short booking flow.
- Show only services available in the customer's selected service area; never imply nationwide live coverage before partners and operations exist there.
- One customer app, one Channel Partner experience, and one Admin dashboard under the QuickFix-India product.

## Implementation rule
Extend the existing `surajkaleshriya22-cpu/QuickFix-India` repository. Do not create or switch to a separate QuickFix app/repository. Keep the current staging and security boundaries honest: a category in the catalogue is not proof that booking, dispatch, payments, maps or service delivery are live in every city.

## Delivery order
1. Establish one canonical service catalogue shared by web and Android.
2. Verify each category has a matching customer booking flow and partner eligibility/registration.
3. Make service-area coverage and category availability accurate.
4. Implement and test category-specific dispatch, wallet, pricing, safety and admin workflows.
5. Validate each vertical end-to-end before advertising it as available.
