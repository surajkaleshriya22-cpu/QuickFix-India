# Optional QuickFix Admin SMS for SOS

The SOS API saves an incident first. It then makes one best-effort SMS request to the configured QuickFix operations number. It does not contact police, ambulance, customers' or partners' emergency contacts, or a call centre.

## Render environment variables

Set these only as encrypted environment variables on the existing QuickFix-India Render service:

- `TWILIO_ACCOUNT_SID`: Twilio Account SID (starts with `AC`).
- `TWILIO_AUTH_TOKEN`: Twilio Auth Token. Keep it secret.
- `TWILIO_FROM_NUMBER`: SMS-capable Twilio sender in E.164 format.
- `SOS_ADMIN_ALERT_TO`: authorized QuickFix operations number in E.164 format.

If any variable is missing, the incident is still saved and `adminSmsStatus` is `not_configured`. Invalid settings, provider rejection, or network failure produce `failed`. `sent` means only that Twilio accepted the API request; it does not prove handset delivery.

## Privacy and duplicate handling

The SMS includes the incident ID, booking ID, reporter role, incident type, and 112 guidance. It excludes reporter phone number, full address, free-text report, OTP, and identity documents. The server attempts SMS only when a new idempotent incident is created; a duplicate request does not send another message.

The admin incident inbox shows only the SMS request status. It does not expose phone numbers or private report text.

## Not provided

This is not emergency dispatch. It does not call 112, police, or ambulance; it does not notify a user's emergency contact; it has no delivery receipt or retry queue. The SOS screen must continue to tell users to call 112 directly in immediate danger.

Before enabling, configure the four Render secrets, verify the sender is permitted for the destination country, test a real authorized admin handset, and test missing-secret and provider-failure cases. Do not put Twilio credentials in Android, browser code, GitHub, or Firestore.
