# QuickFix India — staging application

QuickFix India is a home-services marketplace with customer, Channel Partner, and admin experiences.

- Customer: browse services, create service requests, and view booking information.
- Channel Partner: manage partner details and service work.
- Admin: review marketplace operations and partner activity.

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
