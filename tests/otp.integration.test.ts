import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = 'quickfix-india';
const baseUrl = 'http://127.0.0.1:3439';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
let server: ChildProcess | undefined;
let adminApp: ReturnType<typeof initializeApp> | undefined;
let db: ReturnType<typeof getFirestore>;
const tokens = new Map<string, string>();

const createEmulatorUser = async (email: string) => {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'QuickFix-test-123!', returnSecureToken: true })
  });
  const body = await response.json() as { idToken?: string; localId?: string; error?: { message?: string } };
  assert.equal(response.ok, true, body.error?.message || 'Auth emulator user creation failed');
  assert.ok(body.idToken && body.localId);
  tokens.set(email, body.idToken);
  return { uid: body.localId, token: body.idToken };
};



const createPhoneEmulatorUser = async (phoneNumber: string) => {
  const sent = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, recaptchaToken: 'fake-recaptcha-token' })
  });
  const sentBody = await sent.json() as { sessionInfo?: string; error?: { message?: string } };
  assert.equal(sent.ok, true, sentBody.error?.message || 'Auth emulator did not issue a phone verification session');
  assert.ok(sentBody.sessionInfo);

  const codesResponse = await fetch(`http://${authHost}/emulator/v1/projects/${projectId}/verificationCodes`);
  assert.equal(codesResponse.ok, true, 'Auth emulator SMS-code endpoint must be available');
  const codesBody = await codesResponse.json() as { verificationCodes?: Array<{ phoneNumber: string; code: string }> };
  const verification = codesBody.verificationCodes?.find(item => item.phoneNumber === phoneNumber);
  assert.ok(verification?.code, 'Auth emulator must expose the generated SMS verification code');

  const signedIn = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionInfo: sentBody.sessionInfo, code: verification.code, returnSecureToken: true })
  });
  const signedInBody = await signedIn.json() as { idToken?: string; localId?: string; error?: { message?: string } };
  assert.equal(signedIn.ok, true, signedInBody.error?.message || 'Auth emulator phone verification failed');
  assert.ok(signedInBody.idToken && signedInBody.localId);
  return { uid: signedInBody.localId, token: signedInBody.idToken };
};

const request = async (path: string, token: string, method = 'GET', body?: unknown) => {
  const response = await fetch(baseUrl + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json() as Record<string, any> };
};

const seedBooking = async (id: string, customerUid: string, partnerUid: string, code: string, expiresAt: string, status = 'assigned') => {
  await db.collection('bookings').doc(id).set({
    id, customerUid, technicianUid: partnerUid, status, serviceTitle: 'OTP integration test',
    category: 'electrician', customerAddress: 'Test address', city: 'Indore',
    createdAt: new Date().toISOString()
  });
  await db.collection('booking_start_otps').doc(id).set({
    bookingId: id, customerUid, partnerUid, code, expiresAt
  });
};

test('Firebase Emulator verifies customer OTP ownership and atomic partner start lifecycle', { skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST }, async (t) => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Run this test inside Firebase Firestore Emulator');
  assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Run this test inside Firebase Auth Emulator');

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const serviceAccount = {
    project_id: projectId,
    client_email: 'quickfix-emulator@quickfix-india.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  };

  adminApp = initializeApp({ projectId }, 'quickfix-otp-integration');
  db = getFirestore(adminApp);
  db.settings({ host: firestoreHost.split(':')[0], port: Number(firestoreHost.split(':')[1]), ssl: false });

  server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3439',
      GCLOUD_PROJECT: projectId,
      FIREBASE_CONFIG: JSON.stringify({ projectId }),
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount),
      KYC_PRIVACY_NOTICE_VERSION: '',
      KYC_RETENTION_DAYS: '',
      FIREBASE_STORAGE_BUCKET: ''
    },
    stdio: 'ignore'
  });

  t.after(async () => {
    if (server && server.exitCode === null) server.kill('SIGTERM');
    if (adminApp) await deleteApp(adminApp);
  });

  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(baseUrl + '/healthz');
      if (response.ok) { ready = true; break; }
    } catch { /* server is still starting */ }
    await delay(300);
  }
  assert.equal(ready, true, 'QuickFix API server did not start against Firebase Emulator');

  const customer = await createEmulatorUser('customer-otp@example.test');
  const otherCustomer = await createEmulatorUser('other-customer-otp@example.test');
  const partner = await createEmulatorUser('partner-otp@example.test');
  const otherPartner = await createEmulatorUser('other-partner-otp@example.test');

  await db.collection('users').doc(partner.uid).set({
    uid: partner.uid, role: 'CHANNEL_PARTNER', approvalStatus: 'approved', isVerified: true,
    isOnline: true, isSuspended: false, securityDepositPaid: true, walletBalance: 2000,
    city: 'Indore', trades: ['electrician'], dispatchRadiusKm: 5,
    dispatchLocation: { latitude: 22.7196, longitude: 75.8577 }
  });
  const testFcmToken = 'quickfix-fcm-test-token-' + 'x'.repeat(120);
  const tokenRegistration = await request('/api/partners/notifications/token', partner.token, 'POST', { token: testFcmToken });
  assert.equal(tokenRegistration.status, 200, 'authenticated Channel Partner can register an Android notification token');
  const registeredTokens = await db.collection('users').doc(partner.uid).collection('notificationTokens').get();
  assert.equal(registeredTokens.size, 1, 'server stores the registered FCM token under the owning partner profile');
  assert.equal(registeredTokens.docs[0].data().token, testFcmToken);
  const customerTokenRegistration = await request('/api/partners/notifications/token', otherCustomer.token, 'POST', { token: testFcmToken });
  assert.equal(customerTokenRegistration.status, 403, 'customer accounts cannot register Channel Partner notification tokens');
  const crossAccountTokenRemoval = await request('/api/partners/notifications/token', otherCustomer.token, 'DELETE', { token: testFcmToken });
  assert.equal(crossAccountTokenRemoval.body.removed, false, 'another account cannot remove a partner device token');
  assert.equal((await db.collection('users').doc(partner.uid).collection('notificationTokens').get()).size, 1);
  const tokenRemoval = await request('/api/partners/notifications/token', partner.token, 'DELETE', { token: testFcmToken });
  assert.equal(tokenRemoval.status, 200, 'partner can unregister their own notification token');
  assert.equal(tokenRemoval.body.removed, true);
  assert.equal((await db.collection('users').doc(partner.uid).collection('notificationTokens').get()).size, 0);


  await db.collection('bookings').doc('otp-valid').set({
    id: 'otp-valid', customerUid: customer.uid, status: 'requested', serviceTitle: 'OTP integration test',
    category: 'electrician', customerAddress: 'Test address', city: 'Indore',
    customerLocation: { latitude: 22.7196, longitude: 75.8577 },
    createdAt: new Date().toISOString()
  });

  const kycConfig = await request('/api/partners/kyc-config', partner.token);
  assert.equal(kycConfig.status, 503, 'KYC policy must not be advertised as ready without privacy, retention and Storage configuration');

  // KYC remains fail-closed until the reviewed privacy notice, retention policy,
  // private Storage bucket and deployed server configuration are explicitly set.
  const kycId = '550e8400-e29b-41d4-a716-446655440000';
  const kycBlocked = await request('/api/partners/kyc-submissions', partner.token, 'POST', {
    submissionId: kycId,
    documentType: 'identity_proof',
    objectPath: `partner-kyc/${partner.uid}/${kycId}_identity_proof.pdf`,
    privacyNoticeVersion: 'test-notice',
    consentAccepted: true,
    retentionNoticeAccepted: true
  });
  assert.equal(kycBlocked.status, 503, 'KYC submission must remain disabled without configured privacy and retention gates');
  assert.match(String(kycBlocked.body.error), /privacy notice and retention policy/i);
  assert.equal((await db.collection('partner_kyc_submissions').doc(kycId).get()).exists, false,
    'blocked KYC submission must not create a document record');

  const kycStatus = await request('/api/partners/kyc-status', partner.token);
  assert.equal(kycStatus.status, 200, 'authenticated partner may inspect their own KYC status');
  assert.deepEqual(kycStatus.body.submissions, []);

  const partnerCannotReadKycQueue = await request('/api/admin/kyc-submissions', partner.token);
  assert.equal(partnerCannotReadKycQueue.status, 403, 'a partner must not read the admin KYC queue');
  const partnerCannotCreateDocumentLink = await request(`/api/admin/kyc-submissions/${kycId}/document-url`, partner.token);
  assert.equal(partnerCannotCreateDocumentLink.status, 403, 'a partner must not create admin document links');
  const partnerCannotReviewKyc = await request(`/api/admin/kyc-submissions/${kycId}/decision`, partner.token, 'POST', {
    decision: 'approved'
  });
  assert.equal(partnerCannotReviewKyc.status, 403, 'a partner must not approve KYC submissions');

  const accepted = await request('/api/partners/bookings/otp-valid/accept', partner.token, 'POST', {});
  assert.equal(accepted.status, 200, 'eligible partner must be able to accept the test booking');
  assert.equal(accepted.body.status, 'assigned');

  const customerFeed = await request('/api/customer/bookings', customer.token);
  assert.equal(customerFeed.status, 200);
  assert.ok(customerFeed.body.bookings.some((booking: Record<string, unknown>) => booking.id === 'otp-valid'));
  const feedBooking = customerFeed.body.bookings.find((booking: Record<string, unknown>) => booking.id === 'otp-valid');
  assert.equal('technicianUid' in feedBooking, false, 'customer feed must not expose partner UID');
  assert.equal('startOtp' in feedBooking, false, 'customer feed must not expose private OTP in the general feed');

  const ownOtp = await request('/api/customer/bookings/otp-valid/start-otp', customer.token);
  assert.equal(ownOtp.status, 200);
  const issuedOtp = String(ownOtp.body.startOtp || '');
  assert.match(issuedOtp, /^\d{6}$/, 'acceptance must issue a six-digit OTP');

  const otherCustomerRead = await request('/api/customer/bookings/otp-valid/start-otp', otherCustomer.token);
  assert.equal(otherCustomerRead.status, 404, 'another customer must not read the OTP');

  await db.collection('bookings').doc('otp-valid').update({ status: 'technician_en_route' });
  const enRouteOtp = await request('/api/customer/bookings/otp-valid/start-otp', customer.token);
  assert.equal(enRouteOtp.status, 200, 'customer must retain OTP access while partner is en route');

  const wrongCode = issuedOtp === '000000' ? '000001' : '000000';
  const wrongOtp = await request('/api/partners/bookings/otp-valid/start', partner.token, 'POST', { otp: wrongCode });
  assert.equal(wrongOtp.status, 400);
  assert.equal((await db.collection('bookings').doc('otp-valid').get()).data()?.status, 'technician_en_route');
  assert.equal((await db.collection('booking_start_otps').doc('otp-valid').get()).exists, true);

  const wrongPartner = await request('/api/partners/bookings/otp-valid/start', otherPartner.token, 'POST', { otp: issuedOtp });
  assert.equal(wrongPartner.status, 403);

  const started = await request('/api/partners/bookings/otp-valid/start', partner.token, 'POST', { otp: issuedOtp });
  assert.equal(started.status, 200);
  assert.equal(started.body.status, 'in_progress');
  const persistedBooking = await db.collection('bookings').doc('otp-valid').get();
  assert.equal(persistedBooking.data()?.status, 'in_progress');
  assert.ok(persistedBooking.data()?.serviceStartedAt);
  assert.equal((await db.collection('booking_start_otps').doc('otp-valid').get()).exists, false);

  const replay = await request('/api/partners/bookings/otp-valid/start', partner.token, 'POST', { otp: issuedOtp });
  assert.equal(replay.status, 404, 'consumed OTP must not be reusable');

  await seedBooking('otp-expired', customer.uid, partner.uid, '123456', new Date(Date.now() - 60_000).toISOString());
  const expiredRead = await request('/api/customer/bookings/otp-expired/start-otp', customer.token);
  assert.equal(expiredRead.status, 410);
  const expiredStart = await request('/api/partners/bookings/otp-expired/start', partner.token, 'POST', { otp: '123456' });
  assert.equal(expiredStart.status, 410);

  await seedBooking('otp-wrong-state', customer.uid, partner.uid, '123456', new Date(Date.now() + 60_000).toISOString(), 'completed');
  const wrongState = await request('/api/customer/bookings/otp-wrong-state/start-otp', customer.token);
  assert.equal(wrongState.status, 409);

  // Two simultaneous start requests must never consume the same OTP twice.
  await seedBooking('otp-concurrent', customer.uid, partner.uid, '654321', new Date(Date.now() + 60_000).toISOString());
  const concurrentResults = await Promise.all([
    request('/api/partners/bookings/otp-concurrent/start', partner.token, 'POST', { otp: '654321' }),
    request('/api/partners/bookings/otp-concurrent/start', partner.token, 'POST', { otp: '654321' })
  ]);
  assert.deepEqual(
    concurrentResults.map(result => result.status).sort((a, b) => a - b),
    [200, 404],
    'exactly one concurrent request may consume and start a booking OTP'
  );
  const concurrentBooking = await db.collection('bookings').doc('otp-concurrent').get();
  assert.equal(concurrentBooking.data()?.status, 'in_progress');
  assert.equal((await db.collection('booking_start_otps').doc('otp-concurrent').get()).exists, false);
  const startAudits = await db.collection('partner_job_audit_logs')
    .where('bookingId', '==', 'otp-concurrent')
    .where('action', '==', 'service_started')
    .get();
  assert.equal(startAudits.size, 1, 'a concurrent replay must not create a second service-start audit');

  // Booking-linked SOS integration: use real Auth Emulator phone verification so
  // the server receives a genuine phone_number claim in the Firebase ID token.
  const sosCustomer = await createPhoneEmulatorUser('+16505550131');
  const sosPartner = await createPhoneEmulatorUser('+16505550132');
  const unrelatedReporter = await createPhoneEmulatorUser('+16505550133');
  const nonPhoneReporter = await createEmulatorUser('sos-no-phone@example.test');

  await db.collection('bookings').doc('sos-active-booking').set({
    id: 'sos-active-booking', customerUid: sosCustomer.uid, technicianUid: sosPartner.uid,
    status: 'assigned', createdAt: new Date().toISOString()
  });
  await db.collection('bookings').doc('sos-inactive-booking').set({
    id: 'sos-inactive-booking', customerUid: sosCustomer.uid, technicianUid: sosPartner.uid,
    status: 'requested', createdAt: new Date().toISOString()
  });

  const sosPath = '/api/bookings/sos-active-booking/sos';
  const customerRequestId = 'sos-customer-request-001';
  const customerReport = await request(sosPath, sosCustomer.token, 'POST', {
    requestId: customerRequestId, incidentType: 'medical_emergency', message: 'Need urgent help'
  });
  assert.equal(customerReport.status, 202, 'verified customer may report for their own active booking');
  assert.equal(customerReport.body.success, true);
  assert.equal(customerReport.body.duplicate, false);
  assert.equal(customerReport.body.emergencyDispatchConfigured, false);
  const customerIncidentId = String(customerReport.body.incidentId || '');
  assert.ok(customerIncidentId);
  const customerIncidentRef = db.collection('safety_incidents').doc(customerIncidentId);
  const customerIncident = await customerIncidentRef.get();
  assert.equal(customerIncident.exists, true);
  assert.equal(customerIncident.data()?.reporterUid, sosCustomer.uid);
  assert.equal(customerIncident.data()?.reporterRole, 'CUSTOMER');
  assert.equal(customerIncident.data()?.reporterPhoneVerified, true);
  assert.equal(customerIncident.data()?.status, 'received_pending_review');

  const duplicateReport = await request(sosPath, sosCustomer.token, 'POST', {
    requestId: customerRequestId, incidentType: 'medical_emergency', message: 'Retry same request'
  });
  assert.equal(duplicateReport.status, 200);
  assert.equal(duplicateReport.body.duplicate, true);
  assert.equal(duplicateReport.body.incidentId, customerIncidentId);
  const customerIncidents = await db.collection('safety_incidents')
    .where('bookingId', '==', 'sos-active-booking')
    .where('reporterUid', '==', sosCustomer.uid)
    .get();
  assert.equal(customerIncidents.size, 1, 'same request ID must create exactly one incident');

  const partnerReport = await request(sosPath, sosPartner.token, 'POST', {
    requestId: 'sos-partner-request-001', incidentType: 'safety_concern', message: 'Partner safety concern'
  });
  assert.equal(partnerReport.status, 202, 'assigned Channel Partner may report for the active booking');
  const partnerIncident = await db.collection('safety_incidents').doc(String(partnerReport.body.incidentId)).get();
  assert.equal(partnerIncident.data()?.reporterUid, sosPartner.uid);
  assert.equal(partnerIncident.data()?.reporterRole, 'CHANNEL_PARTNER');

  const unrelatedReport = await request(sosPath, unrelatedReporter.token, 'POST', {
    requestId: 'sos-outsider-request-01', incidentType: 'other', message: 'Should be blocked'
  });
  assert.equal(unrelatedReport.status, 403, 'unrelated authenticated user must not report for this booking');
  const unrelatedId = 'sos-active-booking_' + unrelatedReporter.uid + '_sos-outsider-request-01';
  assert.equal((await db.collection('safety_incidents').doc(unrelatedId).get()).exists, false);

  const noPhoneReport = await request(sosPath, nonPhoneReporter.token, 'POST', {
    requestId: 'sos-no-phone-request-01', incidentType: 'other', message: 'No verified phone claim'
  });
  assert.equal(noPhoneReport.status, 403, 'email-only Firebase identity must not submit a safety report');
  const missingToken = await fetch(baseUrl + sosPath, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: 'sos-missing-token-01', incidentType: 'other' })
  });
  assert.equal(missingToken.status, 401);

  const missingBooking = await request('/api/bookings/sos-missing-booking/sos', sosCustomer.token, 'POST', {
    requestId: 'sos-missing-booking-01', incidentType: 'other'
  });
  assert.equal(missingBooking.status, 404);
  const inactiveBooking = await request('/api/bookings/sos-inactive-booking/sos', sosCustomer.token, 'POST', {
    requestId: 'sos-inactive-booking-01', incidentType: 'other'
  });
  assert.equal(inactiveBooking.status, 409);

  const malformedRequest = await request(sosPath, sosCustomer.token, 'POST', {
    requestId: 'short', incidentType: 'unknown_type', message: 'x'.repeat(501)
  });
  assert.equal(malformedRequest.status, 400, 'invalid request ID, incident type and oversized message must be rejected');

  const partnerCannotReadAdminInbox = await request('/api/admin/safety-incidents', sosPartner.token);
  assert.equal(partnerCannotReadAdminInbox.status, 403, 'Channel Partner must not read the admin safety inbox');

  // Firestore client REST requests must be denied by rules even though the server
  // can write the incident through the Admin SDK.
  const firestoreDocumentUrl = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/safety_incidents/${encodeURIComponent(customerIncidentId)}`;
  const clientRead = await fetch(firestoreDocumentUrl, {
    headers: { Authorization: `Bearer ${sosCustomer.token}` }
  });
  assert.equal(clientRead.status, 403, 'customer client token must not read safety incident documents directly');
  const clientWrite = await fetch(firestoreDocumentUrl, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${sosCustomer.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { forged: { booleanValue: true } } })
  });
  assert.equal(clientWrite.status, 403, 'customer client token must not write safety incident documents directly');

});
