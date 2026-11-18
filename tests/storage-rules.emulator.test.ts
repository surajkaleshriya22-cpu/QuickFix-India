import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import {
  deleteApp,
  initializeApp,
} from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithCustomToken,
  signOut,
} from 'firebase/auth';
import {
  connectStorageEmulator,
  deleteObject,
  getBytes,
  getStorage,
  listAll,
  ref,
  uploadBytes,
} from 'firebase/storage';

const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const storageEmulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const emulatorEnabled = Boolean(authEmulator && storageEmulator);

test('Storage rules keep Channel Partner KYC files private and immutable for clients', {
  skip: !emulatorEnabled && 'Requires Firebase Auth and Storage emulators; never run against production.',
}, async () => {
  assert.ok(authEmulator && storageEmulator);
  const projectId = process.env.GCLOUD_PROJECT || 'demo-quickfix-india';
  process.env.GCLOUD_PROJECT = projectId;

  const adminApp = getAdminApps()[0];
  assert.ok(adminApp, 'Firebase Admin app must be initialized by the emulator test environment');
  const adminAuth = getAdminAuth(adminApp);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 18);
  const ownerUid = `kyc-owner-${suffix}`;
  const otherUid = `kyc-other-${suffix}`;
  const filePath = `partner-kyc/${ownerUid}/${suffix}.pdf`;
  const createdUids: string[] = [];
  const app = initializeApp({
    apiKey: 'fake-api-key',
    authDomain: 'localhost',
    projectId,
    storageBucket: `${projectId}.appspot.com`,
  }, `storage-rules-${suffix}`);
  const clientAuth = getAuth(app);
  const storage = getStorage(app);
  const [authHost] = authEmulator.split(':');
  const [storageHost, storagePortText] = storageEmulator.split(':');
  connectAuthEmulator(clientAuth, `http://${authEmulator}`, { disableWarnings: true });
  connectStorageEmulator(storage, storageHost, Number(storagePortText || 9199));

  const signInAs = async (uid: string, phoneNumber: string) => {
    await adminAuth.createUser({ uid, phoneNumber });
    createdUids.push(uid);
    const customToken = await adminAuth.createCustomToken(uid);
    await signInWithCustomToken(clientAuth, customToken);
  };

  try {
    await signInAs(ownerUid, `+1555${suffix.slice(0, 7)}`);
    const ownerFile = ref(storage, filePath);
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    await uploadBytes(ownerFile, bytes, { contentType: 'application/pdf' });
    assert.deepEqual(Array.from(await getBytes(ownerFile)), Array.from(bytes),
      'The owner must be able to read their uploaded KYC document');

    await signOut(clientAuth);
    const customToken = await adminAuth.createCustomToken(otherUid);
    await adminAuth.createUser({ uid: otherUid, phoneNumber: `+1556${suffix.slice(0, 7)}` });
    createdUids.push(otherUid);
    await signInWithCustomToken(clientAuth, customToken);

    await assert.rejects(() => getBytes(ref(storage, filePath)),
      'A different partner must not read another partner KYC file');
    await assert.rejects(() => listAll(ref(storage, `partner-kyc/${ownerUid}`)),
      'Clients must not list KYC documents');
    await assert.rejects(() => uploadBytes(ref(storage, filePath), bytes, { contentType: 'application/pdf' }),
      'A client must not overwrite an existing KYC file');
    await assert.rejects(() => deleteObject(ref(storage, filePath)),
      'A client must not delete a KYC file');
  } finally {
    await signOut(clientAuth).catch(() => undefined);
    await deleteApp(app).catch(() => undefined);
    await Promise.all(createdUids.map((uid) => adminAuth.deleteUser(uid).catch(() => undefined)));
  }
});
