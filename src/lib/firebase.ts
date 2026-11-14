import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAg4mWAkvOtU9AEd2-4DFx2wRFsBEaGJSA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'quickfix-india.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'quickfix-india',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'quickfix-india.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '731570128431',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:731570128431:web:0c7d5c97bf85dce83568da',
  firestoreDatabaseId: import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

// Keep the UI bootable in local preview mode when Firebase env vars have not
// been configured. Firebase-backed actions should remain disabled until real
// QuickFix project values are supplied through environment variables.
const appConfig = isFirebaseConfigured
  ? firebaseConfig
  : {
      apiKey: 'not-configured',
      authDomain: 'localhost',
      projectId: 'quickfix-not-configured',
      storageBucket: '',
      messagingSenderId: '',
      appId: 'not-configured',
    };

const app = getApps().length > 0 ? getApp() : initializeApp(appConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export async function testFirestoreConnection(): Promise<boolean> {
  if (!isFirebaseConfigured) return false;
  try {
    await getDocFromServer(doc(db, '_quickfix_health', 'ping'));
    return true;
  } catch (err) {
    // Permission errors, missing configuration, and network failures must never
    // be reported as a successful connection.
    console.warn('Firestore health check failed:', err);
    return false;
  }
}
