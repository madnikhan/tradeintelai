/**
 * Finnhub API Proxy Route
 * Server-side proxy for Finnhub API calls
 * Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { serverAPIKeyManager } from '@/lib/server-api-keys';

const BASE_URL = 'https://finnhub.io/api/v1';

export async function GET(request: NextRequest) {
  // Verify authentication
  const auth = await verifyApiAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Get API key from server-side environment
    const apiKey = serverAPIKeyManager.getKey('FINNHUB');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Finnhub API key not configured' },
        { status: 500 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint') || 'calendar/economic';
    const params = new URLSearchParams();
    
    // Copy all query params except 'endpoint'
    searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        params.append(key, value);
      }
    });
    
    // Add API key
    params.append('token', apiKey);

    // Make request to Finnhub
    const url = `${BASE_URL}/${endpoint}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Record failure for rate limiting
      serverAPIKeyManager.recordFailure('FINNHUB', apiKey);
      return NextResponse.json(
        { error: data.error || 'Finnhub API error', status: response.status },
        { status: response.status }
      );
    }

    // Record success
    serverAPIKeyManager.recordSuccess('FINNHUB', apiKey);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Finnhub proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

