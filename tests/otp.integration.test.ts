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
});
