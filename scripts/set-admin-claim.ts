import { cert, deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const expectedProjectId = 'quickfix-india';
const authorizedEmails = (process.env.QUICKFIX_ADMIN_ALLOWED_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

if (authorizedEmails.length === 0) {
  throw new Error('QUICKFIX_ADMIN_ALLOWED_EMAILS must contain at least one explicitly authorized email.');
}
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
const email = user.email?.trim().toLowerCase();

if (!email || !user.emailVerified || !authorizedEmails.includes(email)) {
  throw new Error('Refusing to grant admin: Firebase user must have a verified, explicitly authorized email address.');
}

const existingClaims = user.customClaims || {};
await auth.setCustomUserClaims(uid, { ...existingClaims, admin: true });

const verifiedUser = await auth.getUser(uid);
const verifiedEmail = verifiedUser.email?.trim().toLowerCase();
if (
  verifiedUser.customClaims?.admin !== true ||
  !verifiedUser.emailVerified ||
  !verifiedEmail ||
  !authorizedEmails.includes(verifiedEmail)
) {
  throw new Error('Custom claim or authorized account verification failed.');
}

console.log('Admin custom claim successfully set and verified for an authorized account in project quickfix-india.');
await deleteApp(app);
