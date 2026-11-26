# Booking-linked SOS intake test plan

## Implemented API

`POST /api/bookings/:bookingId/sos`

The endpoint requires a Firebase ID token with a verified phone number. Only the booking customer or assigned Channel Partner may report, and only while the booking is `assigned`, `technician_en_route`, or `in_progress`. Incidents are written by the server using Firebase Admin SDK to `safety_incidents`; deterministic IDs make retries idempotent. Client Firestore access remains denied by the catch-all rule.

## Automated unit coverage

Run with `npm test`. `tests/sosIncident.test.ts` checks accepted incident types, malformed IDs, invalid/oversized messages, active booking states, and reporter identity.

## Emulator / integration cases still required before release

- Missing, invalid, revoked, or unverified-phone Firebase token: reject; write no incident.
- Customer reporting their own active booking: accept exactly one incident.
- Assigned Channel Partner reporting that active booking: accept exactly one incident.
- Unrelated customer or partner: reject; write no incident.
- Missing booking: 404.
- Requested, completed, cancelled, or otherwise inactive booking: 409.
- Invalid IDs, unknown incident type, non-string or over-500-character message: 400.
- Retry with same request ID: return duplicate; do not create another document.
- Client SDK read/write to `safety_incidents`: denied by Firestore rules.

## Release limitations

This endpoint only records a report in QuickFix. It does not dispatch police/ambulance, call 112, or notify emergency contacts. The UI must keep this disclosure visible. Production endpoint and real-device verification remain required before release.
