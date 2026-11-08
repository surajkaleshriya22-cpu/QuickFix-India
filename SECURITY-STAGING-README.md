# QuickFix security staging patch

This patch is intentionally **not a complete deployable payment integration**.

## Included safeguards
- Replaces the fake payout webhook response with HTTP 503 and `verified: false`.
- Replaces permissive Firestore client rules with fail-closed rules. This prevents client-side reads/writes until a properly authorized backend is deployed.

## Important impact
- The app's Firestore-backed screens will not be able to read or write data while these staging rules are active. This is deliberate: the current rules allow unauthenticated writes to technician balances, bookings, payouts and wallet transactions.
- Do not deploy this patch as a production release expecting the app to continue working.

## Required implementation before reopening access
1. Configure Firebase Admin SDK in trusted Cloud Functions / backend runtime.
2. Assign the `admin: true` custom claim only from a trusted administrative process; do not derive it from an email typed into the UI.
3. Move payout approval, rejection/refund, balance reservation/restoration and ledger writes into server transactions with idempotency keys.
4. Verify Razorpay webhook signatures against the raw request body using a server-only secret; persist event IDs and reject duplicates.
5. Verify payout status with Razorpay's server API before marking a payout settled.
6. Add narrowly scoped Firestore read rules for each role and keep all financial writes server-only.
7. Remove hardcoded Admin passcodes/PINs from `src/components/admin/AdminLoginScreen.tsx`; authenticate with Firebase Auth and verify server-issued claims.
8. Add emulator tests for unauthorized reads/writes, duplicate webhook delivery, concurrent payout rejection/settlement, and refund retries.

## Secrets
Never commit Razorpay keys, webhook secrets, service-account JSON, or private credentials to GitHub or this ZIP. Configure them as server-side environment secrets.
