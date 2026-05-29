import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { dispatchTradeExecuted } from '@/lib/notifications/dispatch';
import type { TradeExecutedPayload } from '@/lib/notifications/types';

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  let body: TradeExecutedPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.symbol || !body.direction) {
    return NextResponse.json({ error: 'symbol and direction required' }, { status: 400 });
  }

  const result = await dispatchTradeExecuted(auth.userId, body);
  return NextResponse.json({ ok: true, ...result });
}
