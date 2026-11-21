# Two-sided SOS backend test plan

## Implemented endpoint (staging code only)

`POST /api/bookings/:bookingId/sos`

Requires a valid Firebase ID token with a verified phone number. The caller must be the booking's customer or assigned Channel Partner, and the booking must be in `assigned`, `technician_en_route`, or `in_progress`.

Request JSON:

```json
{
  "requestId": "client-generated-unique-id",
  "incidentType": "safety_concern",
  "message": "Optional short description"
}
```

Allowed incident types: `safety_concern`, `medical_emergency`, `harassment`, `other`.

The endpoint writes to the server-owned `safety_incidents` collection. The deterministic incident ID makes retries with the same booking, caller, and request ID idempotent. Firestore's catch-all client rule denies direct client reads and writes to this collection.

## Emulator integration cases required before release

- No bearer token: 401 and no incident document.
- Invalid/revoked token: 401 and no incident document.
- Authenticated account without verified phone: 403 and no incident document.
- Customer reporting own active booking: 202 and exactly one incident document.
- Assigned Channel Partner reporting same active booking: 202 and exactly one incident document.
- Unrelated customer or unrelated partner: 403 and no incident document.
- Booking not found: 404.
- Requested, completed, cancelled, or otherwise inactive booking: 409.
- Malformed booking ID, request ID, incident type, or oversized message: 400.
- Retry same request ID: 200 with duplicate=true and no second incident.
- Concurrent duplicate requests: exactly one incident document.
- Client Firestore read/write to safety_incidents: denied.
- Server/Admin SDK incident creation succeeds and contains no OTP, full address, or government-ID data.

## Explicit current limitations

- This endpoint records an incident in QuickFix only.
- `emergencyDispatchConfigured` is false. No SMS, push notification, call centre, police, ambulance, or emergency contact notification is wired by this change.
- The endpoint does not expose emergency contacts or live location to either party.
- No customer or partner SOS button has been connected to this endpoint yet.
- Do not advertise SOS as a live emergency-response service until notification delivery, UI, consent, monitoring, and physical-device tests are complete.
- Run the emulator integration cases above and TypeScript/Web/Android CI before merge. No test pass is claimed by this plan.
