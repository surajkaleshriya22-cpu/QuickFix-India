# Emergency contacts security test plan

## API and ownership
- Unauthenticated requests to list, send OTP, verify OTP, and delete return 401.
- A signed-in account without a Firebase-verified phone cannot add or verify a contact.
- A user can read, add, verify, and delete only contacts under their own UID.
- Invalid E.164 numbers, the user's own number, invalid relationship values, and missing owner consent are rejected.
- The API returns masked phone numbers only; raw phone numbers and OTP challenges are never exposed to clients.
- Firestore client reads/writes to `users/{uid}/emergency_contacts`, `emergency_contact_otp`, `emergency_contact_otp_phone_limits`, and `emergency_contact_otp_limits` remain denied by the catch-all rule.

## OTP lifecycle and abuse limits
- With Twilio unconfigured, send/verify fail closed and no contact is marked verified.
- A successful send stores only an HMAC-SHA256 OTP hash, salted per challenge; raw OTP is not stored.
- OTP expires after 5 minutes and is accepted only for the same UID and phone.
- Five incorrect attempts lock the challenge; the sixth attempt cannot verify it.
- Resend is blocked for 60 seconds; maximum 3 sends per phone per hour and 5 per account per hour.
- Per-phone and per-account rate limits persist after verification, challenge expiry, and contact deletion.
- A user cannot store more than 3 pending or verified contacts.
- A failed/rejected Twilio request leaves the contact unverified and the challenge unusable.
- Deleting a contact removes its contact record and any active OTP challenge, but does not erase rate-limit history.

## SOS notification
- Only verified contacts with explicit owner consent receive an SMS attempt.
- Unverified, unconsented, deleted, malformed, and unrelated users' contacts receive no SMS.
- Only the first successful incident creation triggers contact SMS attempts; duplicate request IDs do not resend.
- SMS content contains an incident reference, incident type, and 112 guidance only; it excludes reporter phone, address, free-text report, OTP, and identity documents.
- Provider acceptance is not proof of handset delivery.
- No police, ambulance, or other emergency-service dispatch is performed by QuickFix. Call 112 directly in immediate danger.

## Release gate
Run the API/emulator scenarios above in addition to the repository's TypeScript, web, and Android CI. This document is a test plan, not evidence that the integration scenarios have already passed. Configure Twilio secrets in Render only after reviewing the provider account and sender number; never commit secrets to Git or paste them into chat.
