# QuickFix India — AI Studio / Repository Feature Parity Audit

Audit date: 2026-11-15  
Target repository: `surajkaleshriya22-cpu/QuickFix-India` (default branch: `main`)  
Comparison repository: `surajkaleshriya22-cpu/QuickFix`

## Scope and important limitation

This audit compares the two GitHub repositories currently accessible through the connected GitHub account. It does **not** claim to inspect the live Google AI Studio workspace: no authenticated AI Studio project connector or project export was available during this audit. The older `QuickFix` repository is treated as a comparison snapshot, not as proof of the exact current AI Studio state.

## Repository inventory

- `QuickFix-India`: 78 tracked files in the inspected recursive tree.
- `QuickFix`: 45 tracked files in the inspected recursive tree.
- The target repository contains both a React/Vite web app and an Android Kotlin source tree.
- The target's README explicitly describes it as a staging build, not a production-ready release.

## Feature areas found in QuickFix-India

### Customer experience
- Customer home and service discovery
- Customer authentication/profile and address drawer
- Service booking sheet with price/tax/discount calculation and voice-note recording support
- Booking information and live-tracking sheet
- Reviews
- Nearby hardware stores
- Place autocomplete and maps

### Channel Partner experience
- Partner portal and partner registration/profile
- Trade/service categories
- Online/offline status and service-zone radius controls
- Qualification and KYC approval/rejection flows
- Job acceptance with SLA countdown
- Start-job OTP gate and job completion flow
- Partner wallet, top-up, reserve/deposit and withdrawal eligibility UI
- Payout state display (pending, processing, held, settled, rejected)

### Admin experience
- Admin login/dashboard
- Customer, partner, booking, payment and transaction views
- Partner KYC/qualification decisions
- Per-partner and category commission settings
- Master payment configuration
- Payout approve/hold/reject controls
- Refund action
- Review reply and moderation controls
- Service-zone and operational views

### Platform / backend / Android
- Firebase web client configuration
- Express server with API routes
- Firebase Admin dependency and admin-claim helper script
- Firestore rules file
- Google Maps integration components and geofence service
- Android Kotlin screens for customer, partner, admin, booking and live tracking
- PWA manifest/service worker

## Differences observed against the older QuickFix repository

The current `QuickFix-India` source is materially larger in several important areas:

- `QuickFixContext.tsx`: 49,270 characters vs 26,774; includes Firebase customer authentication, verified-admin authentication, service-zone controls, qualification decisions, per-partner commission, payment configuration, wallet top-up, payout approve/hold/reject, settlement-webhook confirmation, refund action, SLA/deposit/commission calculations.
- `TechnicianPortal.tsx`: 71,112 characters vs 22,336; adds SLA countdown, job acceptance handling, wallet/top-up/withdrawal handling and payout-state presentation.
- `AdminDashboard.tsx`: 171,621 characters vs 132,340; adds AC/fridge partner counts, category commission settings, additional controls and online-partner reporting.
- `types/index.ts`: 7,823 characters vs 3,758; adds wallet transaction, service zone, geofence result, master payment configuration and admin authorization types.
- The current repository also contains additional dedicated components not present in the older tree, including nearby stores, geofence radius map/modal, technician route map, place autocomplete, review modal, pending payouts section and service-zone/hardware-store data.

This suggests the target repository has already gained multiple features beyond the older repository snapshot. It does **not** prove that every feature in the live AI Studio workspace has been carried over.

## Known release blockers (from repository documentation and code structure)

- Web phone OTP is not connected to secure Firebase phone verification; do not report that SMS was sent.
- Android Firebase Phone Auth still needs physical-device SMS testing.
- Trusted backend booking assignment and server-issued OTP validation are not yet deployed.
- Atomic wallet/ledger operations, refunds and real payouts require trusted backend/provider integration.
- Payout webhook is intentionally unavailable until a verified provider integration exists; do not mark payouts settled without provider confirmation.
- Firebase service-account credentials must remain in Render secret environment variables and must never be committed.
- Admin custom-claim provisioning and Firestore rule deployment/verification must be checked against the intended Firebase project.
- A successful web build is not proof of end-to-end app functionality.

## Safe next steps

1. Obtain a fresh export or GitHub sync of the **current live AI Studio project** (same project/version), so its exact source tree can be compared rather than guessing from the older repository.
2. Generate a file-by-file and feature-by-feature diff against `QuickFix-India`.
3. Port only verified missing features into a separate branch, preserving the existing target app and its security rules.
4. Run web lint/build and Android build, then test authentication, booking, partner SLA/OTP, admin authorization and payment/payout flows.
5. Keep all paid services and billing disabled unless explicitly approved; do not simulate real money movement.

## Conclusion

The available GitHub evidence does **not** support the claim that QuickFix-India is simply a reduced copy of the older QuickFix repository. In fact, the target repository contains substantial additions. The remaining gap is an authoritative comparison with the current live AI Studio project, followed by end-to-end verification of backend-dependent features.
