/**
 * Firebase Configuration
 * Initialize Firebase App, Firestore, and Auth
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Check if Firebase is properly configured
export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

// Initialize Firebase (only if configured)
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

// Initialize Firebase App (lazy - only when needed)
function initializeFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured - check environment variables');
  }
  
  if (app) {
    return app;
  }
  
  try {
    // Initialize Firebase App (only if not already initialized)
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    return app;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    throw error;
  }
}

// Export Firestore instance (with fallback check)
export function getDb(): Firestore {
  if (!db) {
    const firebaseApp = initializeFirebaseApp();
    db = getFirestore(firebaseApp);
  }
  return db;
}

// Export Auth instance (lazy initialization)
export function getAuthInstance(): Auth {
  if (!auth) {
    const firebaseApp = initializeFirebaseApp();
    try {
      auth = getAuth(firebaseApp);
    } catch (error) {
      console.error('❌ Firebase Auth initialization error:', error);
      throw error;
    }
  }
  return auth;
}

// Export app getter (lazy initialization)
export function getApp(): FirebaseApp | null {
  if (!app && isFirebaseConfigured()) {
    try {
      return initializeFirebaseApp();
    } catch (error) {
      return null;
    }
  }
  return app;
}

// For backward compatibility
export { getApp as app, getDb as db, getAuthInstance as auth };
