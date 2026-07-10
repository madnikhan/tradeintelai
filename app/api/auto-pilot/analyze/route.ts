import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { headlessGatedAdapter } from '@/lib/headless-gated-adapter';

/** Headless gated analysis for Auto Pilot daemon (when local tsx worker unavailable). */
export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  if (!auth.authorized || !auth.userId) {
    return NextResponse.json({ ok: false, error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const symbol = String(body.symbol || 'EURUSD').replace('/', '').toUpperCase();
    const mode = body.mode === 'trade' ? 'trade' : 'scan';

    const analysis = await headlessGatedAdapter.analyzeMarket(symbol, [], { mode });

    return NextResponse.json({
      ok: true,
      symbol,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      overallScore: analysis.overallScore,
      executionPermitted: analysis.gateStatus?.executionPermitted ?? false,
      executionBlockedBy: analysis.gateStatus?.executionBlockedBy ?? [],
      executionReason: analysis.gateStatus?.executionReason,
      suggestedStopLoss: analysis.suggestedStopLoss,
      suggestedTakeProfit: analysis.suggestedTakeProfit,
      suggestedPositionSize: analysis.suggestedPositionSize,
      dataHealth: analysis.dataHealth,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
