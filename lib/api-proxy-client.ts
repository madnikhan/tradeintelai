/**
 * API Proxy Client
 * Helper functions to call secure API proxy routes
 * Requires Firebase authentication
 */

import { getAuthInstance } from '@/lib/firebase/config';

/**
 * Get Firebase auth token for API requests
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const auth = getAuthInstance();
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (error) {
    console.warn('Failed to get auth token:', error);
  }
  return null;
}

/**
 * Call an API proxy route with authentication
 */
export async function callProxyAPI(
  service: 'finnhub' | 'twelve-data' | 'newsdata',
  endpoint: string,
  params: Record<string, string> = {}
): Promise<Response> {
  const authToken = await getAuthToken();
  
  if (!authToken) {
    throw new Error('Authentication required. Please sign in.');
  }

  const searchParams = new URLSearchParams({
    endpoint,
    ...params,
  });

  const url = `/api/proxy/${service}?${searchParams.toString()}`;
  
  return fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
}

