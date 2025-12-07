import { NextRequest, NextResponse } from 'next/server';
import { fileBridge } from '@/lib/file-bridge-connector';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'EURUSD';
    
    console.log('📊 Fetching market data via file bridge:', symbol);
    
    const result = await fileBridge.getMarketData(symbol);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Market data fetch failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Market data fetch failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
