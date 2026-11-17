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
- The draft PR #38 adds server-side partner booking acceptance with private OTP creation, authenticated customer OTP visibility, assigned-partner one-time OTP verification/start, and partner completion. These routes are implemented in source but still require Auth/Firestore Emulator integration testing and staging validation.
- Private Storage rules for `partner-kyc/{partnerUid}/{fileName}` are present. They permit an owner to create/read their own bounded image/PDF files and an admin-claimed account to read/delete an individual file; directory listing, overwrites and all other paths are denied. **A KYC upload UI and admin document-review flow are not implemented yet.**
- Debug APK and web TypeScript/Vite build have passed GitHub Actions after the code changes.

## Deploy Firestore and Storage rules

The rules in `firestore.rules` and `storage.rules` are not active in Firebase until they are published. The root `firebase.json` now declares both files so Firebase CLI can deploy them.

From a trusted PC with Firebase CLI installed and signed in:

```bash
firebase login
firebase deploy --only firestore:rules,storage --project quickfix-india
```

Check Firebase Console → Firestore Database → Rules and Storage → Rules after deployment and confirm the published rules match these files. Do not upload real KYC documents until the Storage rules have been deployed and independently checked.

## Grant the first administrator claim (one-time trusted PC step)

The Android and web admin screens now require a Firebase ID token containing `admin: true`. A typed email or passcode cannot create this claim.

1. In Firebase Console, open Project settings → Service accounts and create a private service-account JSON key for the `quickfix-india` project.
2. Save that file only on your trusted PC. Never upload it to this repository, the APK, or this chat.
3. In the project folder, install the Admin SDK temporarily:

   ```bash
   npm install --no-save --package-lock=false firebase-admin
   ```

4. Find the Firebase Authentication UID of the verified authorized admin account.
5. Run the script with the service-account path and UID.

   **Windows PowerShell:**
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\private\\quickfix-service-account.json"
   node .\\scripts\\grant-admin-claim.mjs YOUR_FIREBASE_UID
   Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS
   ```

   **macOS/Linux:**
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/private/quickfix-service-account.json"
   node scripts/grant-admin-claim.mjs YOUR_FIREBASE_UID
   unset GOOGLE_APPLICATION_CREDENTIALS
   ```

The script refuses users without a verified email in the explicit admin allowlist. After it succeeds, sign out and sign in again in the app so Firebase refreshes the ID token. Delete the local service-account key when finished.

## Required before production

1. Provision the real administrator account with an Admin SDK custom claim `admin: true`. Never set this claim from the browser or Android client. Keep the service-account key off GitHub and out of the APK.
2. Complete staging validation of the trusted booking endpoints in draft PR #38: verify authenticated customer feed scoping, private OTP ownership, atomic partner acceptance, one-time OTP consumption, concurrent start attempts, and completion. The current pure unit tests do not exercise HTTP authentication or Firestore transactions. The isolated test matrix is in `tests/booking-otp-integration-plan.md`.
3. Implement the private KYC upload UI and admin document-review flow. Do not store Aadhaar/PAN numbers, UPI IDs, or uploaded KYC files in public profile documents.
4. Implement atomic server-side wallet ledger transactions, deposit reservation, payout approval/reversal, and idempotency protection.
5. Connect a real payment provider. Verify webhook signatures using the raw request body and a server-only secret; deduplicate provider event IDs. Never mark payment paid/refunded or payout settled from a client.
6. Add real-time Firestore listeners and role-scoped rules for partner bookings and admin operations as those server workflows are introduced.
7. Add and execute Firebase Emulator tests for profile access, booking ownership, cancellation, admin claims, denied financial writes, and all scenarios in `tests/booking-otp-integration-plan.md`. Do not mark these tests passed until they run against Auth and Firestore emulators.
8. Configure Firebase Phone Auth SHA-1/SHA-256 fingerprints, authorized domains, reCAPTCHA/Play Integrity and SMS settings in Firebase Console.

## Important limits

- The current Spark Firebase plan does not provide deployable Cloud Functions. A trusted backend can be hosted separately (for example, on the existing server host), but it must use a server-only service account and verify Firebase ID tokens.
- The app does not currently send or settle real payouts/refunds. Wallet top-ups and withdrawals are deliberately disabled rather than showing fake success.
- A successful APK build proves compilation only; it does not prove SMS delivery, Firestore/Storage rule deployment, production authentication, or payment-provider operation.

## Secrets

Never commit Razorpay keys, webhook secrets, Firebase service-account JSON, admin private credentials, or payment-provider tokens to GitHub. Store them only as server-side environment secrets.
