/**
 * TwelveData API Proxy Route
 * Server-side proxy for TwelveData API calls
 * Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { serverAPIKeyManager } from '@/lib/server-api-keys';

const BASE_URL = 'https://api.twelvedata.com';

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
    const apiKey = serverAPIKeyManager.getKey('TWELVE_DATA');
    if (!apiKey) {
      // In dev/test, return empty data instead of error
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        return NextResponse.json({ values: [] });
      }
      return NextResponse.json(
        { error: 'TwelveData API key not configured' },
        { status: 500 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint') || 'time_series';
    const params = new URLSearchParams();
    
    // Copy all query params except 'endpoint'
    searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        params.append(key, value);
      }
    });
    
    // Add API key
    params.append('apikey', apiKey);

    // Make request to TwelveData
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
      serverAPIKeyManager.recordFailure('TWELVE_DATA', apiKey);
      return NextResponse.json(
        { error: data.message || 'TwelveData API error', status: response.status },
        { status: response.status }
      );
    }

    // Record success
    serverAPIKeyManager.recordSuccess('TWELVE_DATA', apiKey);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('TwelveData proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

