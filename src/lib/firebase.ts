import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every(Boolean);

const app = firebaseConfigured
  ? (getApps()[0] ?? initializeApp(config))
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

export function toAppUser(user: FirebaseUser) {
  return {
    id: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    avatar: user.photoURL || undefined,
    plan: 'free' as const,
  };
}

export function requireFirebaseAuth(): Auth {
  if (!auth) {
    throw new Error('Firebase is not configured yet. Add the VITE_FIREBASE_* values in Render and redeploy.');
  }
  return auth;
}
