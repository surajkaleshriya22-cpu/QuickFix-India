import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST;
const emulatorEnabled = Boolean(authEmulator && firestoreEmulator);

test('booking OTP API enforces identity, customer isolation and one-time transactional start', {
  skip: !emulatorEnabled && 'Requires Firebase Auth and Firestore emulators; never run against production.',
}, async (t) => {
  assert.ok(authEmulator && firestoreEmulator, 'Both Firebase emulator hosts must be configured');
  process.env.GCLOUD_PROJECT ||= 'demo-quickfix-india';

  // Import only after emulator environment variables are present so server.ts
  // initializes Admin SDK against the isolated emulator project.
  const { app } = await import('../server.ts');
  const adminApp = getApps()[0];
  assert.ok(adminApp, 'Firebase Admin app should be initialized');
  const auth = getAuth(adminApp);
  const db = getFirestore(adminApp);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 18);
  const ids = {
    customerA: `customer-${suffix}`,
    customerB: `customer-b-${suffix}`,
    partnerA: `partner-${suffix}`,
    partnerB: `partner-b-${suffix}`,
    revokedUser: `revoked-${suffix}`,
  };
  const bookingId = `booking-${suffix}`;
  const otp = '482619';
  const createdUids: string[] = [];
  let revokedUserToken = '';
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const createToken = async (uid: string, phoneNumber: string) => {
    await auth.createUser({ uid, phoneNumber });
    createdUids.push(uid);
    const customToken = await auth.createCustomToken(uid);
    const response = await fetch(`http://${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    });
    assert.equal(response.status, 200, 'Auth emulator should exchange the custom token');
    const payload = await response.json() as { idToken?: string };
    assert.ok(payload.idToken);
    return payload.idToken;
  };

  const request = (path: string, token?: string, body?: unknown) => fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  try {
    const [customerAToken, customerBToken, partnerAToken, partnerBToken, revokedUserTokenValue] = await Promise.all([
      createToken(ids.customerA, `+1555${suffix.slice(0, 7)}`),
      createToken(ids.customerB, `+1556${suffix.slice(0, 7)}`),
      createToken(ids.partnerA, `+1557${suffix.slice(0, 7)}`),
      createToken(ids.partnerB, `+1558${suffix.slice(0, 7)}`),
      createToken(ids.revokedUser, `+1559${suffix.slice(0, 7)}`),
    ]);
    revokedUserToken = revokedUserTokenValue;

    await db.collection('bookings').doc(bookingId).set({
      id: bookingId,
      customerUid: ids.customerA,
      technicianUid: ids.partnerA,
      technicianId: ids.partnerA,
      technicianName: 'Synthetic Partner',
      status: 'assigned',
      serviceTitle: 'Synthetic electrician booking',
      category: 'electrician',
      scheduledDate: '2026-12-01',
      scheduledTimeSlot: '10:00-11:00',
      customerAddress: 'Synthetic test address',
    });
    await db.collection('booking_private').doc(bookingId).set({
      bookingId,
      customerUid: ids.customerA,
      partnerUid: ids.partnerA,
      startOtp: otp,
    });

    const unauthenticated = await request('/api/customer/bookings');
    assert.equal(unauthenticated.status, 401, 'Customer feed must reject missing bearer token');
    const invalidToken = await request('/api/customer/bookings', 'not-a-valid-firebase-token');
    assert.equal(invalidToken.status, 401, 'Customer feed must reject an invalid bearer token');

    await auth.revokeRefreshTokens(ids.revokedUser);
    const revokedToken = await request('/api/customer/bookings', revokedUserToken);
    assert.equal(revokedToken.status, 401, 'Customer feed must reject a revoked Firebase ID token');

    await db.collection('booking_private').doc(bookingId).update({ customerUid: ids.customerB });
    const mismatchedCustomerFeed = await request('/api/customer/bookings', customerAToken);
    const mismatchedCustomerPayload = await mismatchedCustomerFeed.json() as { bookings: Array<{ id: string; startOtp: string }> };
    assert.equal(mismatchedCustomerPayload.bookings.find((booking) => booking.id === bookingId)?.startOtp, '',
      'The customer feed must hide OTP when private customer ownership does not match');

    await db.collection('booking_private').doc(bookingId).update({ customerUid: ids.customerA, partnerUid: ids.partnerB });
    const mismatchedPartnerFeed = await request('/api/customer/bookings', customerAToken);
    const mismatchedPartnerPayload = await mismatchedPartnerFeed.json() as { bookings: Array<{ id: string; startOtp: string }> };
    assert.equal(mismatchedPartnerPayload.bookings.find((booking) => booking.id === bookingId)?.startOtp, '',
      'The customer feed must hide OTP when private partner ownership does not match');

    await db.collection('booking_private').doc(bookingId).update({ partnerUid: ids.partnerA });
    const ownFeed = await request('/api/customer/bookings', customerAToken);
    assert.equal(ownFeed.status, 200);
    const ownPayload = await ownFeed.json() as { bookings: Array<{ id: string; startOtp: string }> };
    assert.equal(ownPayload.bookings.find((booking) => booking.id === bookingId)?.startOtp, otp);

    const otherFeed = await request('/api/customer/bookings', customerBToken);
    assert.equal(otherFeed.status, 200);
    const otherPayload = await otherFeed.json() as { bookings: Array<{ id: string }> };
    assert.equal(otherPayload.bookings.some((booking) => booking.id === bookingId), false,
      'A different customer must not see the booking');

    const wrongPartner = await request(`/api/partners/bookings/${bookingId}/start`, partnerBToken, { otp });
    assert.equal(wrongPartner.status, 403, 'An unrelated partner must not start the booking');

    await db.collection('booking_private').doc(bookingId).update({ customerUid: ids.customerB });
    const wrongPrivateCustomer = await request(`/api/partners/bookings/${bookingId}/start`, partnerAToken, { otp });
    assert.equal(wrongPrivateCustomer.status, 400,
      'Partner start must reject a private OTP record owned by another customer');

    await db.collection('booking_private').doc(bookingId).update({ customerUid: ids.customerA, partnerUid: ids.partnerB });
    const wrongPrivatePartner = await request(`/api/partners/bookings/${bookingId}/start`, partnerAToken, { otp });
    assert.equal(wrongPrivatePartner.status, 400,
      'Partner start must reject a private OTP record assigned to another partner');
    await db.collection('booking_private').doc(bookingId).update({ partnerUid: ids.partnerA });

    const [firstStart, secondStart] = await Promise.all([
      request(`/api/partners/bookings/${bookingId}/start`, partnerAToken, { otp }),
      request(`/api/partners/bookings/${bookingId}/start`, partnerAToken, { otp }),
    ]);
    const startStatuses = [firstStart.status, secondStart.status];
    assert.equal(startStatuses.filter((status) => status === 200).length, 1,
      'Exactly one concurrent request may consume the OTP');
    assert.ok(startStatuses.every((status) => status === 200 || status === 400 || status === 409),
      `Unexpected concurrent start statuses: ${startStatuses.join(', ')}`);

    const [bookingAfter, privateAfter, auditAfter] = await Promise.all([
      db.collection('bookings').doc(bookingId).get(),
      db.collection('booking_private').doc(bookingId).get(),
      db.collection('partner_job_audit_logs').where('bookingId', '==', bookingId).get(),
    ]);
    assert.equal(bookingAfter.data()?.status, 'in_progress');
    assert.equal(privateAfter.data()?.startOtp, '', 'OTP must be consumed in the same transaction');
    assert.equal(auditAfter.size, 1, 'Exactly one start audit event must be written');

    const replay = await request(`/api/partners/bookings/${bookingId}/start`, partnerAToken, { otp });
    assert.ok([400, 409].includes(replay.status),
      `OTP replay must be rejected; received HTTP ${replay.status}`);

    const wrongCompleter = await request(`/api/partners/bookings/${bookingId}/complete`, partnerBToken, {});
    assert.equal(wrongCompleter.status, 403, 'An unrelated partner must not complete the booking');

    const completion = await request(`/api/partners/bookings/${bookingId}/complete`, partnerAToken, {});
    assert.equal(completion.status, 200, 'The assigned partner may complete an in-progress booking');
    const completionPayload = await completion.json() as { status: string; paymentSettled: boolean };
    assert.equal(completionPayload.status, 'completed');
    assert.equal(completionPayload.paymentSettled, false,
      'Completing a service must not claim that payment or payout was settled');

    const duplicateCompletion = await request(`/api/partners/bookings/${bookingId}/complete`, partnerAToken, {});
    assert.equal(duplicateCompletion.status, 409, 'A completed booking must not be completed again');

    const [completedBooking, finalAudit] = await Promise.all([
      db.collection('bookings').doc(bookingId).get(),
      db.collection('partner_job_audit_logs').where('bookingId', '==', bookingId).get(),
    ]);
    assert.equal(completedBooking.data()?.status, 'completed');
    assert.equal(finalAudit.size, 2, 'Exactly one start and one completion audit event must exist');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all([
      db.collection('bookings').doc(bookingId).delete().catch(() => undefined),
      db.collection('booking_private').doc(bookingId).delete().catch(() => undefined),
    ]);
    const audit = await db.collection('partner_job_audit_logs').where('bookingId', '==', bookingId).get();
    await Promise.all(audit.docs.map((doc) => doc.ref.delete()));
    await Promise.all(createdUids.map((uid) => auth.deleteUser(uid).catch(() => undefined)));
  }
});
