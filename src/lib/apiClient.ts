import { auth } from './firebase';

export async function firebaseJsonHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in with Firebase before calling protected API endpoints.');
  }
  const idToken = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
}
