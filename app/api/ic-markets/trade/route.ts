import { NextRequest, NextResponse } from 'next/server';
import { fileBridge } from '@/lib/file-bridge-connector';

export async function POST(request: NextRequest) {
  try {
    const trade = await request.json();
    
    console.log('📤 Executing trade via file bridge:', trade);
    
    const result = await fileBridge.executeTrade(trade);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Trade execution failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Trade execution failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
