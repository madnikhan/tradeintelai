/**
 * Test Firebase Connection
 * Quick utility to verify Firebase is properly configured
 */

import { getDb, isFirebaseConfigured } from './config';
import { collection, getDocs } from 'firebase/firestore';

/**
 * Test Firebase connection
 */
export async function testFirebaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  // Check if configured
  if (!isFirebaseConfigured()) {
    return {
      configured: false,
      connected: false,
      error: 'Firebase not configured - check environment variables',
    };
  }

  try {
    // Try to read from Firestore (this will fail if not connected)
    // We'll try to access a collection that might not exist, which is fine
    const testCollection = collection(getDb(), '_test');
    await getDocs(testCollection);
    
    return {
      configured: true,
      connected: true,
    };
  } catch (error: any) {
    // If it's a permission error, that's actually good - it means we're connected
    // If it's a network error, that's bad
    if (error?.code === 'permission-denied') {
      return {
        configured: true,
        connected: true,
        error: 'Connected but permission denied (check security rules)',
      };
    }
    
    return {
      configured: true,
      connected: false,
      error: error?.message || String(error),
    };
  }
}

/**
 * Log Firebase configuration status (for debugging)
 */
export function logFirebaseStatus(): void {
  console.log('🔥 Firebase Configuration Status:');
  console.log('  Configured:', isFirebaseConfigured());
  console.log('  API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('  Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '❌ Missing');
  console.log('  Auth Domain:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '❌ Missing');
}

