# QuickFix India — security and deployment status

This repository now contains safer authentication and booking flows, but it is **not yet a production-ready marketplace**. Do not collect customer payments or promise technician payouts until the remaining server-side payment and partner workflows are deployed.

## Implemented in the current source

- Android admin access now requires a signed-in Firebase account with the Admin SDK-issued `admin: true` custom claim. The old client-side passcode/PIN is no longer accepted.
- Browser local storage is no longer treated as proof of an authenticated web session.
- Android customer profiles are created/read under the signed-in Firebase UID.
- Customers can create a Firestore booking request with status `requested`, payment status `pending`, no technician assignment and no start OTP.
- Customers can read their own bookings and cancel only a request that is still `requested`.
- Admins with the custom claim can read user and booking lists and manage `system` configuration.
- Service zones are public read-only; only admins can edit them.
- Wallet, payout, refund and ledger collections remain closed to client access.
- Client-side code no longer fabricates payout UTRs, marks refunds as paid, or reports a fake Firestore connection.
- Debug APK and web TypeScript/Vite build have passed GitHub Actions after the code changes.

## Deploy Firestore rules

The rules in `firestore.rules` are not active in Firebase until they are published.

From a PC with Firebase CLI installed and signed in:

```bash
firebase login
firebase use quickfix-india
firebase deploy --only firestore:rules
```

The root `firebase.json` points Firebase CLI to `firestore.rules`. Check the Firebase Console after deployment and confirm the published rules match this file.

## Required before production

1. Provision the real administrator account with an Admin SDK custom claim `admin: true`. Never set this claim from the browser or Android client. Keep the service-account key off GitHub and out of the APK.
2. Implement trusted backend endpoints for technician registration review, job acceptance/assignment, OTP creation/verification, SLA enforcement, and partner status updates.
3. Implement atomic server-side wallet ledger transactions, deposit reservation, payout approval/reversal, and idempotency protection.
4. Connect a real payment provider. Verify webhook signatures using the raw request body and a server-only secret; deduplicate provider event IDs. Never mark payment paid/refunded or payout settled from a client.
5. Add real-time Firestore listeners and role-scoped rules for partner bookings and admin operations as those server workflows are introduced.
6. Add Firebase Emulator tests for profile access, booking ownership, cancellation, admin claims, and denied financial writes.
7. Configure Firebase Phone Auth SHA-1/SHA-256 fingerprints, authorized domains, reCAPTCHA/Play Integrity and SMS settings in Firebase Console.

## Important limits

- The current Spark Firebase plan does not provide deployable Cloud Functions. A trusted backend can be hosted separately (for example, on the existing server host), but it must use a server-only service account and verify Firebase ID tokens.
- The app does not currently send or settle real payouts/refunds. Wallet top-ups and withdrawals are deliberately disabled rather than showing fake success.
- A successful APK build proves compilation only; it does not prove SMS delivery, Firestore rule deployment, production authentication, or payment-provider operation.

## Secrets

Never commit Razorpay keys, webhook secrets, Firebase service-account JSON, admin private credentials, or payment-provider tokens to GitHub. Store them only as server-side environment secrets.
