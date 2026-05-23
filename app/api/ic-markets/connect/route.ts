import { NextRequest, NextResponse } from 'next/server';
import { fileBridge } from '@/lib/file-bridge-connector';
import { requireApiAuth } from '@/lib/with-auth';

export async function POST(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  try {
    console.log('🔗 Testing file bridge connection...');
    
    const accountInfo = await fileBridge.getAccountInfo();
    
    return NextResponse.json({
      success: true,
      connected: true,
      account_info: accountInfo,
      message: 'Connected via file bridge'
    });
    
  } catch (error) {
    console.error('Connection failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'File bridge connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
