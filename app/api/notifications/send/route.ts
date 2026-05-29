import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import {
  dispatchExecutableSignal,
  dispatchTradeExecuted,
} from '@/lib/notifications/dispatch';
import type { ExecutableSignalPayload, TradeExecutedPayload } from '@/lib/notifications/types';

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  let body: {
    type: string;
    payload: TradeExecutedPayload | ExecutableSignalPayload;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  switch (body.type) {
    case 'trade_executed':
      return NextResponse.json({
        ok: true,
        ...(await dispatchTradeExecuted(auth.userId, body.payload as TradeExecutedPayload)),
      });
    case 'executable_signal':
      return NextResponse.json({
        ok: true,
        ...(await dispatchExecutableSignal(auth.userId, body.payload as ExecutableSignalPayload)),
      });
    default:
      return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
  }
}
