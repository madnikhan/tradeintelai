import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { verifyBridgeBearerToken } from '@/lib/bridge-token-auth';
import { headlessGatedAdapter } from '@/lib/headless-gated-adapter';
import { saveAnalysisAdmin } from '@/lib/firebase/analysis-storage-admin';
import { getUserSubscription } from '@/lib/stripe/subscription-store';
import { canAccessApp } from '@/lib/subscription-access';

/** Headless gated analysis for Auto Pilot daemon (when local tsx worker unavailable). */
export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request);
  let userId = auth.authorized ? auth.userId : null;
  if (!userId) {
    const bridge = await verifyBridgeBearerToken(
      request.headers.get('authorization')
    );
    userId = bridge?.uid ?? null;
  }
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: auth.error ?? 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    if (auth.authorized && auth.userId) {
      const sub = await getUserSubscription(auth.userId);
      if (!canAccessApp(sub.status, auth.userId)) {
        return NextResponse.json(
          { ok: false, error: 'Active subscription required' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const symbol = String(body.symbol || 'EURUSD').replace('/', '').toUpperCase();
    const useVision = body.useVision === true;
    const mode = body.mode === 'scan' ? 'scan' : 'trade';

    const { analysis, entryPrice } = await headlessGatedAdapter.analyzeWithMeta(
      symbol,
      [],
      {
        mode,
        useVision,
        persist: false, // admin path below (client SDK not available on API)
      }
    );

    let analysisId = '';
    try {
      analysisId = await saveAnalysisAdmin(userId, symbol, analysis, {
        gateStatus: analysis.gateStatus,
        source: 'auto-pilot',
      });
    } catch (e) {
      console.warn('[auto-pilot/analyze] persist failed:', e);
    }

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
      entryPrice,
      analysisId: analysisId || undefined,
      dataHealth: analysis.dataHealth,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
