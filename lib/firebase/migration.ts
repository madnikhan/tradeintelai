/**
 * Firestore Migration Utility
 * Migrates data from localStorage to Firestore
 */

import { syncLocalStorageToFirestore, saveTradesToFirestore } from './trade-history';
import { Trade } from '@/types/trading';
import { isFirebaseConfigured } from './config';

/**
 * Check if migration is needed
 */
export function isMigrationNeeded(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isFirebaseConfigured()) return false;
  
  const synced = localStorage.getItem('firestore_synced');
  return synced !== 'true';
}

/**
 * Run full migration from localStorage to Firestore
 */
export async function runMigration(): Promise<{
  success: boolean;
  tradesMigrated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let tradesMigrated = 0;

  if (!isFirebaseConfigured()) {
    return {
      success: false,
      tradesMigrated: 0,
      errors: ['Firebase not configured'],
    };
  }

  try {
    // Migrate trades
    try {
      tradesMigrated = await syncLocalStorageToFirestore();
      console.log(`✅ Migrated ${tradesMigrated} trades`);
    } catch (error) {
      const errorMsg = `Failed to migrate trades: ${String(error)}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }

    // Future: Migrate other data (settings, analysis, etc.)

    return {
      success: errors.length === 0,
      tradesMigrated,
      errors,
    };
  } catch (error) {
    errors.push(`Migration failed: ${String(error)}`);
    return {
      success: false,
      tradesMigrated,
      errors,
    };
  }
}

/**
 * Auto-migrate on app load (if needed)
 */
export async function autoMigrate(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isMigrationNeeded()) return;

  console.log('🔄 Starting automatic migration to Firestore...');
  const result = await runMigration();
  
  if (result.success) {
    console.log(`✅ Migration complete: ${result.tradesMigrated} trades migrated`);
  } else {
    console.warn(`⚠️ Migration completed with errors:`, result.errors);
  }
}

