import fs from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const uid = process.argv[2];

if (!serviceAccountPath) {
  throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a local Firebase service-account JSON file.');
}
if (!uid) {
  throw new Error('Usage: node scripts/grant-admin-claim.mjs <firebase-user-uid>');
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const adminAuth = getAuth(app);
const user = await adminAuth.getUser(uid);

const authorizedEmails = [
  'surajkaleshriya22@gmail.com',
  'ops.admin@quickfix.in'
];
const email = user.email?.trim().toLowerCase();

if (!email || !user.emailVerified || !authorizedEmails.includes(email)) {
  throw new Error('Refusing to grant admin: the Firebase user must have a verified, explicitly authorized email address.');
}

const existingClaims = user.customClaims ?? {};
await adminAuth.setCustomUserClaims(uid, { ...existingClaims, admin: true });

console.log('Admin claim granted to the verified authorized Firebase user:', email);
console.log('Ask the user to sign out and sign in again so Firebase refreshes the ID token.');
