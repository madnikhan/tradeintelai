/**
 * Server-side analysis persist (Auto Pilot cloud path) using Admin SDK.
 */

import { getAdminFirestore } from '@/lib/firebase/admin';
import type { ExtendedMarketAnalysis } from '@/lib/gated-engine-adapter';

const ANALYSIS_COLLECTION = 'analysis';

export async function saveAnalysisAdmin(
  userId: string,
  symbol: string,
  analysis: ExtendedMarketAnalysis,
  marketData?: Record<string, unknown>
): Promise<string> {
  const db = await getAdminFirestore();
  const analysisId = `analysis_${symbol}_${Date.now()}`;
  const accountDocId = userId;
  const ref = db
    .collection(ANALYSIS_COLLECTION)
    .doc(accountDocId)
    .collection('results')
    .doc(analysisId);

  const clean = JSON.parse(
    JSON.stringify(
      {
        userId: accountDocId,
        symbol,
        timestamp: analysis.timestamp || new Date().toISOString(),
        analysis,
        marketData: marketData ?? null,
        actionTaken: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      (_k, v) => (v === undefined ? null : v)
    )
  );

  await ref.set(clean);
  return analysisId;
}

export async function markAnalysisActionTakenAdmin(
  userId: string,
  analysisId: string,
  tradeId: string
): Promise<void> {
  const db = await getAdminFirestore();
  const ref = db
    .collection(ANALYSIS_COLLECTION)
    .doc(userId)
    .collection('results')
    .doc(analysisId);
  await ref.set(
    {
      actionTaken: true,
      tradeId,
      outcome: { accuracy: 'pending' },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
