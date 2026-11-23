# QuickFix-India — one app, many services

**Product vision:** QuickFix-India is one unified India-wide services and everyday-work platform. Customers should not need a separate app for each kind of work. One QuickFix-India app should let them discover, book, track, and pay for supported services through a consistent, simple experience.

The platform brings many service verticals together under one product and one account system:
- **Home repair:** electrician, plumber, AC, refrigerator and appliance repair.
- **Home and daily help:** cleaning, cooking, laundry, carpenter, painter, gardening and pest control.
- **Mobility and delivery:** QuickFix Bike Taxi Captain, driver and future delivery/rider services.
- **Local expertise and projects:** mechanic, welder/fabricator, tourist guide, contractor, house shifting and additional verified services.
- **Future categories:** new work types can be added to the same service catalogue without creating a separate QuickFix app for each vertical.

One shared platform should provide customer accounts, Channel Partner accounts, service discovery, location and service zones, booking, safety, support, payments and Admin operations. Each service category may have its own workflow, pricing, partner qualifications and wallet rules, while remaining inside the single QuickFix-India app.

- Customer: one place to discover and request all supported services.
- Channel Partner: one partner app experience with category-specific work, availability, earnings and wallet.
- Admin: one control centre for categories, coverage, verification, rates, safety and marketplace operations.

This repository contains the existing React + Vite application and Android source tree. It is a **staging build**, not a production-ready release. A successful build does not prove that live OTP delivery, booking assignment, payments, or payouts work end to end.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env
# Fill in the Firebase Web App values for the intended QuickFix Firebase project.
# Add GEMINI_API_KEY only if using the server-side Gemini endpoints.
npm run dev
```

Open the local URL printed by the server.

## Build

```bash
npm run lint
npm run build
npm start
```

The Express server serves the Vite `dist` output and retains the existing `/api/*` routes. Render deployment settings are provided in `render.yaml`.

## Firebase configuration

- Web: set the `VITE_FIREBASE_*` and `VITE_FIRESTORE_DATABASE_ID` variables listed in `.env.example` using the Web App configuration from the intended Firebase project.
- Android: provide the matching `android/app/google-services.json` for package `com.quickfix.app`. The file is intentionally excluded from this repository.
- Never commit service-account JSON, private API credentials, payment keys, webhook secrets, or `.env` files.

## Current Firebase / free-plan limitations

The Firebase project is being kept on the Spark (no-cost) plan. No paid plan or billing is enabled by this repository work.

- Firestore rules are role-scoped and restrictive; they are **not** deny-all. They permit limited owner profile operations and safe customer booking-request creation. Sensitive booking transitions and financial collections remain server-owned.
- The web OTP flow currently reports that secure Firebase phone verification is not connected; it must not claim an SMS was sent.
- Android source includes Firebase Phone Auth, but real SMS delivery still needs testing on a physical device.
- Booking assignment, server-issued start OTP validation, atomic wallet/ledger operations, refunds, and payouts require trusted backend functions that are not currently deployed.
- The payout webhook deliberately returns HTTP 503 until a verified provider integration exists. No payout is represented as settled.
- Do not loosen Firestore rules or simulate real payments to make the interface appear functional.

See `docs/FREE_PLAN_BACKEND_PREP.md` for the free-plan preparation, security boundaries, and release checklist. See `PWA-SETUP.md` for repository and hosting setup.

## Release checklist

Before production release, verify web and Android builds, test Firestore rules against cross-user access, test admin custom-claim authorization, validate booking and OTP flows with trusted backend transactions, and perform physical-device SMS testing. Any billing or paid deployment decision must be reviewed and explicitly approved by a parent/guardian before enabling it.
