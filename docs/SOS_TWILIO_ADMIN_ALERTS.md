# QuickFix SOS: optional Twilio Admin SMS alert

This integration sends a short SMS to **one operator-controlled admin number** after an authenticated SOS incident is saved. It is not an emergency dispatch integration and does not notify police, ambulance, customers' emergency contacts, or partners' emergency contacts.

## Required Render environment variables

Configure these as secrets/environment variables on the existing QuickFix India server service:

- `TWILIO_ACCOUNT_SID`: Twilio Account SID.
- `TWILIO_AUTH_TOKEN`: Twilio Auth Token. Keep this secret; never put it in Android, web client code, GitHub, or Firestore.
- `TWILIO_FROM_NUMBER`: Twilio-enabled sender number in E.164 format, for example `+1...`.
- `SOS_ADMIN_ALERT_TO`: the authorized QuickFix operations/admin phone in E.164 format.

All four values must be present and both phone numbers must pass E.164 validation. If any are missing, the SOS incident is still saved and its `adminSmsStatus` is `not_configured`. A provider rejection/network error records `failed`; a successful Twilio API acceptance records `sent`. This is provider acceptance, not proof that a handset received/read the SMS.

## Configure and verify

1. Create/verify a Twilio account and an SMS-capable sender permitted for the destination country.
2. Complete any applicable India sender registration, DLT/template, destination, and account restrictions required by Twilio.
3. Add the four variables above to the existing Render web service. Do not add credentials to this repository.
4. Deploy the server and submit an SOS from a verified test customer or assigned Channel Partner on an active test booking.
5. Confirm the incident appears in the server-only `safety_incidents` collection and check `adminSmsStatus` (`sent`, `failed`, or `not_configured`).
6. Confirm the authorized admin handset receives the message. Test provider failure and missing-variable cases too.

The SMS deliberately contains only the incident ID, booking ID, reporter role, and incident type. It excludes full address, phone number, report text, OTP, and government identity data.

## Admin incident inbox

The Admin Dashboard includes a **Safety & SOS** tab backed by server-verified admin endpoints:

- `GET /api/admin/safety-incidents` lists up to 100 recent incidents with minimum operational fields only.
- `PATCH /api/admin/safety-incidents/:incidentId` supports `acknowledged`, `under_review`, and `resolved`.
- Status changes are recorded in the server-only `safety_incident_audit` collection.
- The browser never reads the `safety_incidents` collection directly. The endpoints require a valid Firebase ID token with the server-side `admin` custom claim.

The Admin Dashboard intentionally does not display reporter phone numbers, full addresses, government IDs, or the free-text incident message.

## Not implemented by this integration

- Emergency contact capture, consent, phone verification, or contact SMS.
- Admin Dashboard incident inbox / acknowledgement workflow.
- Police/ambulance dispatch, call-centre escalation, or automatic 112 calling.
- Delivery receipts or retry queue for messages accepted/rejected by Twilio.

Until those features and real-device tests are complete, the SOS UI must continue to tell users to call **112 directly** in immediate danger and must not claim that emergency services were notified.

CI note: this change must pass the repository's Vite/Web CI and Android Debug APK workflows before the stacked SOS changes are merged to `main`.
