/**
 * API Proxy Client
 * Helper functions to call secure API proxy routes
 * Supports Firebase authentication with fallback for test/dev environments
 */

import { getAuthInstance } from '@/lib/firebase/config';

/**
 * Check if Firebase is configured
 */
function isFirebaseConfigured(): boolean {
  try {
    const auth = getAuthInstance();
    return auth !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Check if we're in a test or development environment
 */
function isTestOrDevEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || 
         process.env.NODE_ENV === 'development' ||
         typeof window === 'undefined'; // Server-side
}

/**
 * Get Firebase auth token for API requests
 * Returns null if Firebase is not configured (allows fallback)
 */
async function getAuthToken(): Promise<string | null> {
  try {
    if (!isFirebaseConfigured()) {
      if (isTestOrDevEnvironment()) {
        // In test/dev, allow proceeding without auth (fallback mode)
        return null;
      }
      return null;
    }
    
    const auth = getAuthInstance();
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (error) {
    // In test/dev, don't throw - allow fallback
    if (isTestOrDevEnvironment()) {
      console.warn('Firebase auth not available (test/dev mode):', error);
      return null;
    }
    console.warn('Failed to get auth token:', error);
  }
  return null;
}

/**
 * Call an API proxy route with authentication
 * Falls back gracefully in test/dev environments when Firebase is not configured
 */
export async function callProxyAPI(
  service: 'finnhub' | 'twelve-data' | 'newsdata',
  endpoint: string,
  params: Record<string, string> = {}
): Promise<Response> {
  const authToken = await getAuthToken();

  const searchParams = new URLSearchParams({
    endpoint,
    ...params,
  });

  // Handle absolute URL for server-side/test contexts
  let baseUrl = '/api/proxy';
  if (typeof window === 'undefined') {
    // Server-side or test context - need absolute URL
    const protocol = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') ? 'https' : 'http';
    const host = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'localhost:3000';
    baseUrl = `${protocol}://${host}/api/proxy`;
  }

  const url = `${baseUrl}/${service}?${searchParams.toString()}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Only add auth header if token is available
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else if (!isTestOrDevEnvironment()) {
    // In production, require auth
    throw new Error('Authentication required. Please sign in.');
  }
  // In test/dev, proceed without auth (API route should handle gracefully)
  
  return fetch(url, {
    method: 'GET',
    headers,
  });
}

