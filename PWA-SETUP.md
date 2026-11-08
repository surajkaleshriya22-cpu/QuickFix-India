# QuickFix India PWA setup (staging)

This archive keeps the existing React/Vite QuickFix customer, technician and admin interfaces and adds installable Progressive Web App support.

## PWA files added
- `public/manifest.webmanifest` — install metadata and app icons.
- `public/sw.js` — conservative same-origin app-shell caching; `/api/*` and cross-origin requests are never cached.
- `public/icons/` — 192px and 512px install icons.
- `src/main.tsx` — registers the service worker in production builds.
- `render.yaml` — starter Render web-service configuration for the existing Express API + Vite static build.

## Create the new GitHub repository
1. On GitHub, create a repository named `QuickFix-India`.
2. Upload/push the *contents* of this archive to the repository root; do not upload the ZIP as a single file.
3. Import the repository into Render using the included `render.yaml`.
4. Set the required environment variables in Render. Never commit `.env` files, service-account JSON, Razorpay secrets or webhook secrets.

## Important staging limitations
- `firestore.rules` intentionally denies all client reads and writes as a temporary fail-closed security patch. Firebase-backed live workflows will remain unavailable until proper role-scoped rules and trusted backend functions are implemented and tested.
- `/api/webhooks/payout-confirmation` intentionally returns HTTP 503 and does not settle payouts. Do not advertise automated payouts as live.
- The archived Firebase web config points to an AI Studio-generated Firebase project, not necessarily the intended QuickFix production project. Verify and replace it with the correct QuickFix Firebase web-app configuration before deployment.
- The Android `google-services.json` was removed because the archived copy identified a different Android package/project. Add the correct file for `com.quickfix.app` only when resuming native Android builds.
- This is a PWA staging conversion, not a production launch certification. Test authentication, bookings, data permissions, maps, offline behavior and mobile installation before public launch.
