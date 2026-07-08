/**
 * Firestore Trade History Service
 * Syncs trade history to Firestore with localStorage fallback
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
  writeBatch,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from './config';
import { getUserId } from './auth';
import { Trade } from '@/types/trading';
import { getAccountDocumentId, getAccountCollectionId } from './account-context';

const TRADES_COLLECTION = 'trades';

/**
 * Convert Trade to Firestore document
 */
function tradeToFirestore(trade: Trade): any {
  const toTs = (d: Date | string | undefined) => {
    if (!d) return undefined;
    const date = d instanceof Date ? d : new Date(d);
    return Timestamp.fromDate(date);
  };
  return {
    ...trade,
    timestamp: trade.timestamp instanceof Date
      ? Timestamp.fromDate(trade.timestamp)
      : Timestamp.fromDate(new Date(trade.timestamp)),
    closeTime: toTs(trade.closeTime),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

/**
 * Convert Firestore document to Trade
 */
function firestoreToTrade(docData: any): Trade {
  const toDate = (v: unknown): Date | undefined => {
    if (!v) return undefined;
    if (v instanceof Date) return v;
    if (typeof (v as { toDate?: () => Date }).toDate === 'function') {
      return (v as { toDate: () => Date }).toDate();
    }
    return new Date(v as string | number);
  };
  return {
    ...docData,
    timestamp: toDate(docData.timestamp) ?? new Date(),
    closeTime: toDate(docData.closeTime),
  };
}

/**
 * Save a single trade to Firestore
 */
export async function saveTradeToFirestore(trade: Trade): Promise<void> {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured, skipping Firestore save');
    return;
  }

  try {
    const accountDocId = getAccountDocumentId();
    const accountCollectionId = getAccountCollectionId();
    const tradeRef = doc(getDb(), TRADES_COLLECTION, accountDocId, 'trades', trade.id);
    
    await setDoc(tradeRef, tradeToFirestore(trade), { merge: true });
    console.log(`✅ Trade ${trade.id} saved to Firestore`);
  } catch (error) {
    console.error('❌ Failed to save trade to Firestore:', error);
    throw error;
  }
}

/**
 * Save multiple trades to Firestore (batch write)
 */
export async function saveTradesToFirestore(trades: Trade[]): Promise<void> {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured, skipping Firestore save');
    return;
  }

  if (trades.length === 0) return;

  try {
    const accountDocId = getAccountDocumentId();
    const batch = writeBatch(getDb());
    
    trades.forEach(trade => {
      const tradeRef = doc(getDb(), TRADES_COLLECTION, accountDocId, 'trades', trade.id);
      batch.set(tradeRef, tradeToFirestore(trade), { merge: true });
    });
    
    await batch.commit();
    console.log(`✅ ${trades.length} trades saved to Firestore`);
  } catch (error) {
    console.error('❌ Failed to save trades to Firestore:', error);
    throw error;
  }
}

/**
 * Get all trades from Firestore
 */
export async function getTradesFromFirestore(): Promise<Trade[]> {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured, returning empty array');
    return [];
  }

  try {
    const accountDocId = getAccountDocumentId();
    const tradesRef = collection(getDb(), TRADES_COLLECTION, accountDocId, 'trades');
    const q = query(tradesRef, orderBy('timestamp', 'desc'));
    
    const querySnapshot = await getDocs(q);
    const trades: Trade[] = [];
    
    querySnapshot.forEach((doc) => {
      trades.push(firestoreToTrade({ id: doc.id, ...doc.data() }));
    });
    
    console.log(`✅ Retrieved ${trades.length} trades from Firestore`);
    return trades;
  } catch (error) {
    console.error('❌ Failed to get trades from Firestore:', error);
    return [];
  }
}

/**
 * Get a single trade by ID
 */
export async function getTradeFromFirestore(tradeId: string): Promise<Trade | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  try {
    const userId = getUserId();
    const tradeRef = doc(getDb(), TRADES_COLLECTION, userId, 'trades', tradeId);
    const tradeSnap = await getDoc(tradeRef);
    
    if (tradeSnap.exists()) {
      return firestoreToTrade({ id: tradeSnap.id, ...tradeSnap.data() });
    }
    
    return null;
  } catch (error) {
    console.error('❌ Failed to get trade from Firestore:', error);
    return null;
  }
}

/**
 * Get trades by symbol
 */
export async function getTradesBySymbol(symbol: string): Promise<Trade[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  try {
    const pair = symbol.replace(/\//g, '').toUpperCase();
    const accountDocId = getAccountDocumentId();
    const tradesRef = collection(getDb(), TRADES_COLLECTION, accountDocId, 'trades');
    const q = query(
      tradesRef,
      where('pair', '==', pair),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const trades: Trade[] = [];
    
    querySnapshot.forEach((doc) => {
      trades.push(firestoreToTrade({ id: doc.id, ...doc.data() }));
    });
    
    return trades;
  } catch (error) {
    console.error('❌ Failed to get trades by symbol from Firestore:', error);
    return [];
  }
}

/**
 * Subscribe to real-time trade updates
 */
export function subscribeToTrades(
  callback: (trades: Trade[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured, returning no-op unsubscribe');
    return () => {};
  }

  try {
    const accountDocId = getAccountDocumentId();
    const tradesRef = collection(getDb(), TRADES_COLLECTION, accountDocId, 'trades');
    const q = query(tradesRef, orderBy('timestamp', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
      const trades: Trade[] = [];
      querySnapshot.forEach((doc) => {
        trades.push(firestoreToTrade({ id: doc.id, ...doc.data() }));
      });
      callback(trades);
    }, (error) => {
      console.error('❌ Firestore subscription error:', error);
    });
  } catch (error) {
    console.error('❌ Failed to subscribe to trades:', error);
    return () => {};
  }
}

/**
 * Sync trades from localStorage to Firestore (migration)
 */
export async function syncLocalStorageToFirestore(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  if (!isFirebaseConfigured()) return 0;

  try {
    const storedTrades = localStorage.getItem('mt5_trade_history');
    if (!storedTrades) return 0;

    const trades: Trade[] = JSON.parse(storedTrades);
    if (trades.length === 0) return 0;

    // Convert timestamp strings to Date objects
    const normalizedTrades = trades.map(t => ({
      ...t,
      timestamp: t.timestamp instanceof Date ? t.timestamp : new Date(t.timestamp),
    }));

    await saveTradesToFirestore(normalizedTrades);
    
    // Mark as synced
    localStorage.setItem('firestore_synced', 'true');
    
    console.log(`✅ Synced ${normalizedTrades.length} trades from localStorage to Firestore`);
    return normalizedTrades.length;
  } catch (error) {
    console.error('❌ Failed to sync localStorage to Firestore:', error);
    return 0;
  }
}

