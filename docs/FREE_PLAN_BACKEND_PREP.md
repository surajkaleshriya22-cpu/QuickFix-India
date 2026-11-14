# QuickFix India — Free-plan backend preparation

This document records work that can be completed without enabling Firebase billing.

## Current verified boundary

- Firebase project is on the Spark (no-cost) plan.
- `firebase.json` currently deploys Firestore rules only; there is no Functions deployment configured.
- The current Firestore rules intentionally keep booking assignment, OTP issuance/verification, wallet/ledger, payouts, refunds, and other sensitive writes server-owned.
- The web OTP flow currently reports that secure Firebase phone verification is not connected; it must not pretend an SMS was sent.
- The Android client contains Firebase Phone Auth integration, but real SMS delivery still requires physical-device testing.
- Payout confirmation is intentionally fail-closed while a verified payment-provider webhook is not configured.

## Work allowed on Spark

1. Keep Firestore rules restrictive. Never open broad client writes to make screens appear functional.
2. Keep UI messages honest: distinguish demo/local state from a real account, booking, OTP, payment, or payout.
3. Run and fix repository-only checks (TypeScript, Vite build, Android compile, rules syntax/tests where available).
4. Prepare backend source and tests on a separate branch, but do not deploy Cloud Functions or activate billing.
5. Document exact manual device tests for Firebase Phone Auth and booking flows.

## Backend implementation plan (not deployed)

When a parent/guardian has reviewed the billing implications and the project owner explicitly authorizes a suitable deployment plan, implement and deploy server-side functions for:

- Authenticated booking assignment using a Firestore transaction.
- Server-generated, short-lived start OTPs; store only a secure hash and expiry.
- Server-side OTP verification and booking state transitions.
- Atomic wallet/ledger changes with idempotency keys.
- Admin-only actions protected by verified Firebase custom claims.
- Payment-provider webhooks with signature verification and replay protection.

Do not implement real money collection, refunds, or payouts until a payment provider, its compliance requirements, and secure secret handling have been reviewed. Never fabricate payment references or settlement status.

## Release gates

- [ ] Web TypeScript check passes.
- [ ] Web production build passes.
- [ ] Android debug build passes on the latest source commit.
- [ ] Firestore rules tests prove cross-user access is denied.
- [ ] Admin authorization tests prove ordinary users cannot call admin actions.
- [ ] Booking/OTP transaction tests cover duplicate and expired requests.
- [ ] Physical Android device confirms real Firebase SMS OTP delivery.
- [ ] No payment or payout is marked successful without a verified provider response.
- [ ] Deployment and any possible charges are explicitly approved by a parent/guardian before a paid plan is enabled.

**Important:** A successful CI build does not mean live SMS, booking assignment, or payments have been verified.
