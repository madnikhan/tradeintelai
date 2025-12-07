import { NextResponse } from 'next/server';
import { httpBridge } from '@/lib/http-bridge-connector';

export async function GET() {
  try {
    // For now, return empty - we'll need to add history endpoint to bridge
    // In the future, this would fetch from MT5 via the bridge
    return NextResponse.json({
      success: true,
      trades: [],
      message: 'Trade history endpoint - integration with MT5 coming soon'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trade history' },
      { status: 500 }
    );
  }
}

