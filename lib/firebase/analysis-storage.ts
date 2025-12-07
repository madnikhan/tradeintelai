/**
 * Firestore Analysis Storage Service
 * Stores AI analysis results and tracks signal outcomes
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from './config';
import { MarketAnalysis } from '@/lib/ai-trading-engine';
import { getAccountDocumentId } from './account-context';

const ANALYSIS_COLLECTION = 'analysis';

/**
 * Analysis result document structure
 */
export interface AnalysisResult {
  id: string;
  userId: string;
  symbol: string;
  timestamp: Date;
  analysis: MarketAnalysis;
  marketData?: {
    price: number;
    indicators?: any;
    cotData?: any;
    regime?: string;
  };
  actionTaken: boolean;
  tradeId?: string;
  outcome?: {
    wasProfitable?: boolean;
    actualReturn?: number;
    predictedReturn?: number;
    accuracy?: 'correct' | 'incorrect' | 'pending';
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Save analysis result to Firestore
 */
export async function saveAnalysisToFirestore(
  symbol: string,
  analysis: MarketAnalysis,
  marketData?: any
): Promise<string> {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured, skipping analysis save');
    return '';
  }

  try {
    const accountDocId = getAccountDocumentId();
    const analysisId = `analysis_${symbol}_${Date.now()}`;
    const analysisRef = doc(
      getDb(), 
      ANALYSIS_COLLECTION, 
      accountDocId, 
      'results', 
      analysisId
    );
    
    const analysisResult: Omit<AnalysisResult, 'id'> = {
      userId: accountDocId,
      symbol,
      timestamp: analysis.timestamp || new Date(),
      analysis,
      marketData,
      actionTaken: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Clean undefined values before saving (Firestore doesn't allow undefined)
    const cleanAnalysis = JSON.parse(JSON.stringify(analysisResult, (key, value) => {
      // Remove undefined values
      if (value === undefined) {
        return null;
      }
      return value;
    }));
    
    await setDoc(analysisRef, {
      ...cleanAnalysis,
      timestamp: Timestamp.fromDate(analysisResult.timestamp),
      createdAt: Timestamp.fromDate(analysisResult.createdAt),
      updatedAt: Timestamp.fromDate(analysisResult.updatedAt),
    });
    
    console.log(`✅ Analysis ${analysisId} saved to Firestore`);
    return analysisId;
  } catch (error) {
    console.error('❌ Failed to save analysis to Firestore:', error);
    throw error;
  }
}

/**
 * Update analysis with trade outcome
 */
export async function updateAnalysisOutcome(
  analysisId: string,
  tradeId: string,
  outcome: {
    wasProfitable: boolean;
    actualReturn: number;
    predictedReturn?: number;
  }
): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  try {
    const accountDocId = getAccountDocumentId();
    const analysisRef = doc(
      getDb(), 
      ANALYSIS_COLLECTION, 
      accountDocId, 
      'results', 
      analysisId
    );
    
    const predictedReturn = outcome.predictedReturn || 
      (outcome.wasProfitable ? Math.abs(outcome.actualReturn) : -Math.abs(outcome.actualReturn));
    
    const accuracy: 'correct' | 'incorrect' = 
      (outcome.wasProfitable && predictedReturn > 0) || 
      (!outcome.wasProfitable && predictedReturn < 0)
        ? 'correct' 
        : 'incorrect';
    
    await setDoc(analysisRef, {
      actionTaken: true,
      tradeId,
      outcome: {
        ...outcome,
        predictedReturn,
        accuracy,
      },
      updatedAt: Timestamp.now(),
    }, { merge: true });
    
    console.log(`✅ Analysis ${analysisId} outcome updated`);
  } catch (error) {
    console.error('❌ Failed to update analysis outcome:', error);
  }
}

/**
 * Get analysis results for a symbol
 */
export async function getAnalysisResults(
  symbol: string,
  limitCount: number = 100
): Promise<AnalysisResult[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  try {
    const accountDocId = getAccountDocumentId();
    const analysisRef = collection(getDb(), ANALYSIS_COLLECTION, accountDocId, 'results');
    const q = query(
      analysisRef,
      where('symbol', '==', symbol),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const results: AnalysisResult[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(data.timestamp),
        createdAt: data.createdAt?.toDate() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate() || new Date(data.updatedAt),
      } as AnalysisResult);
    });
    
    return results;
  } catch (error) {
    console.error('❌ Failed to get analysis results:', error);
    return [];
  }
}

/**
 * Get analysis accuracy statistics
 */
export async function getAnalysisAccuracy(symbol?: string): Promise<{
  total: number;
  correct: number;
  incorrect: number;
  pending: number;
  accuracy: number;
}> {
  if (!isFirebaseConfigured()) {
    return { total: 0, correct: 0, incorrect: 0, pending: 0, accuracy: 0 };
  }

  try {
    const accountDocId = getAccountDocumentId();
    const analysisRef = collection(getDb(), ANALYSIS_COLLECTION, accountDocId, 'results');
    
    let q = query(analysisRef, where('actionTaken', '==', true));
    if (symbol) {
      q = query(analysisRef, where('symbol', '==', symbol), where('actionTaken', '==', true));
    }
    
    const querySnapshot = await getDocs(q);
    let total = 0;
    let correct = 0;
    let incorrect = 0;
    let pending = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.outcome) {
        total++;
        if (data.outcome.accuracy === 'correct') correct++;
        else if (data.outcome.accuracy === 'incorrect') incorrect++;
        else pending++;
      }
    });
    
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    
    return { total, correct, incorrect, pending, accuracy };
  } catch (error) {
    console.error('❌ Failed to get analysis accuracy:', error);
    return { total: 0, correct: 0, incorrect: 0, pending: 0, accuracy: 0 };
  }
}

