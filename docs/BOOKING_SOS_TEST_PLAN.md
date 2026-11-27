# Booking-linked SOS intake test plan

## Implemented API

`POST /api/bookings/:bookingId/sos`

The endpoint requires a Firebase ID token with a verified phone number. Only the booking customer or assigned Channel Partner may report, and only while the booking is `assigned`, `technician_en_route`, or `in_progress`. Incidents are written by the server using Firebase Admin SDK to `safety_incidents`; deterministic IDs make retries idempotent. Client Firestore access remains denied by the catch-all rule.

## Automated unit coverage

Run with `npm test`. `tests/sosIncident.test.ts` checks accepted incident types, malformed IDs, invalid/oversized messages, active booking states, and reporter identity.

## Firebase Emulator integration coverage

Run with:

```bash
npx firebase-tools emulators:exec --project quickfix-india --only auth,firestore "npm run test:otp-integration"
```

The integration test obtains phone-authenticated Firebase ID tokens from the Auth Emulator and verifies:

- Verified-phone customer can report for their own active booking.
- Assigned Channel Partner can report for that active booking.
- An unrelated authenticated user is rejected and no incident is written.
- An email-only identity without a verified phone claim is rejected.
- Missing/invalid authentication is rejected.
- Missing booking and inactive booking states return the expected errors.
- Repeating the same request ID returns the existing incident and does not create a second record.
- Malformed request ID, unsupported incident type and oversized message are rejected.
- A Channel Partner cannot read the admin safety inbox.
- Customer client tokens cannot read or write `safety_incidents` directly through the Firestore Emulator REST API.

## Release limitations

The endpoint only records a report in QuickFix and may request the existing optional Admin SMS integration. It does not dispatch police/ambulance, call 112, or notify emergency contacts. The UI must keep this disclosure visible. Production endpoint and real-device verification remain required before release.
