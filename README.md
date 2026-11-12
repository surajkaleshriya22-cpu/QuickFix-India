# QuickFix India — PWA staging

QuickFix is a home-services marketplace with three role-based experiences:

- Customer: browse home services, book a service, view booking status and reviews.
- Technician partner: manage partner profile, service requests and work status.
- Admin: review marketplace operations, technicians, bookings and commission information.

This repository preserves the existing React + Vite application and Android source tree while adding installable PWA support. It is a staging build, not a production-ready payments release.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env
# Fill in the Firebase Web App values for the intended QuickFix Firebase project.
# Add GEMINI_API_KEY only if using the server-side Gemini endpoints.
npm run dev
```

Open the local URL printed by the server. PWA installability/service-worker registration is enabled in production builds over HTTPS (localhost is also treated as secure by browsers).

## Build

```bash
npm run build
npm start
```

The Express server serves the Vite `dist` output and retains the existing `/api/*` routes. Render deployment settings are provided in `render.yaml`.

## Firebase configuration

Set the `VITE_FIREBASE_*` and `VITE_FIRESTORE_DATABASE_ID` variables listed in `.env.example` using the Web App configuration from the correct QuickFix Firebase project. Do not use the AI Studio preview project's old config. For native Android builds, add the matching `android/app/google-services.json` for package `com.quickfix.app`; it is intentionally excluded from this public-ready archive because the file in the source archive belonged to a different package/project.

## Security and release blockers

- `firestore.rules` currently denies all client reads/writes as a fail-closed staging safeguard. Firebase-backed workflows will not function until role-scoped rules and trusted backend functions are implemented and tested.
- The payout webhook deliberately returns HTTP 503 and never marks payouts as settled. No automated payouts are live.
- Do not expose service-account JSON, private API credentials, Razorpay keys, webhook secrets, or `.env` files in GitHub.
- Replace any demo/test authentication flows and hardcoded demo credentials before launch. Use Firebase Auth and server-issued custom claims for admin authorization.
- Test customer/technician/admin permissions, bookings, maps, offline behavior, mobile installation, and all payment paths before public launch.

See [PWA-SETUP.md](PWA-SETUP.md) for repository and hosting steps



