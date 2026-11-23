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
- Private partner KYC Storage rules are defined in `storage.rules`: an authenticated partner may create/read files only in their own UID folder; only a trusted admin claim may read or delete them; uploads are limited to 10 MB JPEG, PNG or PDF; overwrite and listing are denied.
- Firebase CLI configuration now explicitly includes both Firestore and Storage rules.
- Debug APK and web TypeScript/Vite build have passed GitHub Actions after the code changes.

## Deploy Firestore and Storage rules

The rules in `firestore.rules` and `storage.rules` are source files only. They are **not active in Firebase until published**. Storage uploads must not be enabled in the app until the Storage rules have been reviewed and deployed to the correct Firebase project.

From a trusted PC with Firebase CLI installed and signed in:

```bash
firebase login
firebase deploy --only firestore:rules,storage --project quickfix-india
```

The root `firebase.json` maps Firestore to `firestore.rules` and Storage to `storage.rules`. After deployment, verify the published rules in Firebase Console. Do not upload actual identity documents until the complete KYC submission, consent, retention/deletion, admin review and audit workflow is implemented and tested.

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
2. Implement trusted backend endpoints for technician registration review, job acceptance/assignment, OTP creation/verification, SLA enforcement, and partner status updates.
3. Implement a complete KYC workflow: authenticated document metadata submission, server-side object existence/type/size validation, admin-only review decisions, immutable audit events, consent and retention/deletion handling. The Storage rules alone do not implement KYC review and do not mean KYC is live.
4. Implement atomic server-side wallet ledger transactions, deposit reservation, payout approval/reversal, and idempotency protection.
5. Connect a real payment provider. Verify webhook signatures using the raw request body and a server-only secret; deduplicate provider event IDs. Never mark payment paid/refunded or payout settled from a client.
6. Add real-time Firestore listeners and role-scoped rules for partner bookings and admin operations as those server workflows are introduced.
7. Add Firebase Emulator tests for profile access, booking ownership, cancellation, admin claims, denied financial writes, and private KYC Storage access.
8. Configure Firebase Phone Auth SHA-1/SHA-256 fingerprints, authorized domains, reCAPTCHA/Play Integrity and SMS settings in Firebase Console.

## Important limits

- The current Spark Firebase plan does not provide deployable Cloud Functions. A trusted backend can be hosted separately (for example, on the existing server host), but it must use a server-only service account and verify Firebase ID tokens.
- The app does not currently send or settle real payouts/refunds. Wallet top-ups and withdrawals are deliberately disabled rather than showing fake success.
- A successful APK build proves compilation only; it does not prove SMS delivery, Firestore/Storage rule deployment, production authentication, or payment-provider operation.

## Secrets

Never commit Razorpay keys, webhook secrets, Firebase service-account JSON, admin private credentials, or payment-provider tokens to GitHub. Store them only as server-side environment secrets.


## Approved KYC policy choices (configuration remains disabled)

- Privacy contact for questions, correction and deletion requests: **surajkaleshriya22@gmail.com**.
- Maximum retention period selected for uploaded KYC document files: **180 days from submission**.
- While a Channel Partner or customer account remains active, retain the account/profile, verification decision and audit history, bookings/service history, and safety-related records needed to operate and protect the marketplace. These records are distinct from the uploaded identity-document file and must not be automatically erased with that file.
- If an expired document is still legally or operationally required to verify an active partner, request a refreshed document or apply a documented legal hold; do not silently treat an expired file as current proof.
- Privacy notice version to use when the complete notice and deletion workflow are ready: **quickfix-kyc-v2**.
- These are policy choices, not proof that deletion is operational. Do not set `KYC_PRIVACY_NOTICE_VERSION` or `KYC_RETENTION_DAYS` on the live server and do not collect real identity documents until separate document-file expiry and active-account record-retention behavior are implemented, tested, and audited. Also verify the exact Firebase Storage bucket and deploy reviewed Storage rules first.


## Partner KYC API implementation (not yet enabled in production)

The server source now includes authenticated routes for:
- Partner submission metadata after a private Storage upload is confirmed to exist.
- Partner-only status lookup.
- Admin-only pending review queue and five-minute signed document viewing links.
- Admin-only approve/reject/request-resubmission decisions with server-timestamped audit events.

KYC approval deliberately leaves `isVerified=false`; it does not approve the partner's basic profile, activate duty, or permit job acceptance. Client Firestore access to the KYC submission and audit collections remains denied by the default-deny rule.

The submission endpoint fails closed until the hosting environment has all of these server-only settings:
- `FIREBASE_STORAGE_BUCKET`: exact bucket name for the `quickfix-india` project.
- `KYC_PRIVACY_NOTICE_VERSION`: version identifier of the actual privacy notice shown to the partner.
- `KYC_RETENTION_DAYS`: approved retention period as an integer from 1 to 3650.

Do not set these values until the notice states the purpose, document categories, who can review, retention/deletion process, and a contact for privacy requests. The API checks consent booleans and the notice version; that is not a substitute for a legally reviewed notice or a deployed upload UI. The current API accepts only JPEG, PNG, or PDF objects up to 10 MB and document categories `identity_proof`, `address_proof`, `qualification_certificate`, and `profile_photo`. It does not specifically request Aadhaar or PAN.

These routes are source code only until the updated server is deployed with a trusted Firebase Admin service account and the Storage rules are published. No KYC upload, review or activation is live merely because this code is merged. A scheduled retention/deletion worker, partner upload UI, Firebase Emulator tests, and a formal privacy/legal review are still required before collecting real identity documents.
