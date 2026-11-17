# Booking OTP staging integration test plan

This plan is intentionally separate from the existing helper unit tests. The current `tests/booking-otp.test.ts` tests pure validation and OTP-visibility helpers; it does not start Express, verify Firebase ID tokens, or execute Firestore transactions.

## Safe test environment

- Use a dedicated Firebase Emulator Suite project ID, never the production `quickfix-india` project.
- Run Auth and Firestore emulators locally or in an isolated CI job.
- Set `FIREBASE_AUTH_EMULATOR_HOST` and `FIRESTORE_EMULATOR_HOST` only for the test process.
- Initialize Firebase Admin against the emulator project; do not provide a production service-account key.
- Use synthetic customer, partner, and unrelated-user identities. Give each test a fresh booking ID and clear emulator data between suites.
- Do not use real phone numbers, real OTP SMS, payment credentials, wallet funds, or production customer data.

## Required test fixtures

Create emulator users for:
- customer A (authenticated customer profile)
- customer B (different authenticated customer)
- partner A (authenticated assigned partner)
- partner B (authenticated unrelated partner)
- an unauthenticated request (no bearer token)

Seed a booking document and its matching `booking_private/{bookingId}` document only through test setup. Keep the six-digit OTP in the private document, never in the public booking fixture.

## HTTP and Firestore integration matrix

| Area | Scenario | Expected result |
|---|---|---|
| Authentication | Missing bearer token on customer feed | HTTP 401; no booking data |
| Authentication | Invalid or revoked Firebase ID token | HTTP 401; no booking data |
| Customer feed | Customer A requests own requested booking | Booking returned; no OTP |
| Customer feed | Customer B requests Customer A's booking | Booking absent from response |
| Customer feed | Customer A has assigned booking and matching private record | Six-digit OTP returned |
| Customer feed | Private record customer or partner UID mismatches booking | Empty OTP |
| Customer feed | Booking is requested, unassigned, in progress, completed, or cancelled | Empty OTP |
| Partner start | Missing/invalid token | HTTP 401 |
| Partner start | Partner B submits correct OTP for Partner A's booking | HTTP 403; booking and OTP unchanged |
| Partner start | Assigned Partner A submits wrong/malformed OTP | HTTP 400; booking and OTP unchanged |
| Partner start | Assigned Partner A starts an assigned booking with correct OTP | HTTP 200; status becomes in_progress; private OTP is consumed |
| Partner start | Two concurrent correct start requests | Exactly one succeeds; OTP is consumed once; one start audit event |
| Partner start | Reuse OTP after successful start | Rejected; no second transition or audit event |
| Partner start | Missing private record or ownership metadata | Rejected; no status change |
| Partner completion | Unassigned partner or non-in_progress booking | Rejected; no status change |
| Partner completion | Assigned partner completes in_progress booking | HTTP 200; status becomes completed |
| Financial isolation | Completion endpoint called | No wallet, commission, payout, refund, or payment-settlement document is created or changed |

## Assertions that matter

1. Read the public booking and private OTP documents directly from the emulator after every mutation.
2. Verify the booking status transition and private OTP consumption occur together.
3. For concurrency, assert one successful response and one audit record, not merely that both requests return.
4. Verify customer feed results are scoped by the verified Firebase UID, not a request-body UID.
5. Verify the partner start endpoint never returns the OTP.
6. Verify completion changes service status only and does not imply payment settlement.

## Current implementation boundary

The draft PR implements authenticated customer booking feed, private OTP lookup, partner OTP start, and partner completion handlers. The current helper tests cover validation rules only. These integration scenarios remain **not yet executed** until the app can be started against Auth and Firestore emulators with an injectable test server.

Do not mark this checklist passed based on TypeScript, Vite build, or helper unit-test success. Do not run this plan against production Firebase.
