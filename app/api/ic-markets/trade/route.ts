import { NextRequest, NextResponse } from 'next/server';
import { fileBridge } from '@/lib/file-bridge-connector';
import { requireApiAuth } from '@/lib/with-auth';

export async function POST(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

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
