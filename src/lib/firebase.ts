import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
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
    console.warn('Firestore connection check failed:', err);
    return false;
  }
}
