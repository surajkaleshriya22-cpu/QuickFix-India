import { cert, deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const expectedProjectId = 'quickfix-india';
const uid = process.env.QUICKFIX_ADMIN_UID;
const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!uid) throw new Error('QUICKFIX_ADMIN_UID is required.');
if (!rawServiceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required.');
if (getApps().length) throw new Error('Unexpected pre-initialized Firebase Admin app.');

const serviceAccount = JSON.parse(rawServiceAccount);
if (serviceAccount.project_id !== expectedProjectId) {
  throw new Error(`Wrong Firebase project. Expected ${expectedProjectId}; received ${serviceAccount.project_id || 'unknown'}.`);
}

const app = initializeApp({ credential: cert(serviceAccount), projectId: expectedProjectId });
const auth = getAuth(app);
const user = await auth.getUser(uid);
const existingClaims = user.customClaims || {};
await auth.setCustomUserClaims(uid, { ...existingClaims, admin: true });

const verifiedUser = await auth.getUser(uid);
if (verifiedUser.customClaims?.admin !== true) {
  throw new Error('Custom claim verification failed.');
}

console.log(`Admin custom claim successfully set and verified for UID ${uid} in project ${expectedProjectId}.`);
await deleteApp(app);
