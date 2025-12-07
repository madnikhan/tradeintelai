/**
 * Firestore Account Context
 * Manages account-specific data isolation in Firestore
 */

import { accountManager } from '../account-manager';
import { getUserId as getAuthUserId } from './auth';

/**
 * Get the current active account login
 */
function getCurrentAccountLogin(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const activeAccount = accountManager.getActiveAccount();
    return activeAccount?.login?.toString() || null;
  } catch (error) {
    console.warn('Failed to get active account:', error);
    return null;
  }
}

/**
 * Get user ID (from Firebase Auth or fallback)
 */
function getUserId(): string {
  // Try Firebase Auth first (preferred)
  try {
    const authUserId = getAuthUserId();
    if (authUserId && authUserId !== 'anonymous') {
      return authUserId;
    }
  } catch (error) {
    // Auth not available, fallback to localStorage
  }

  // Fallback to localStorage (for backward compatibility)
  if (typeof window !== 'undefined') {
    let userId = localStorage.getItem('firebase_user_id');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('firebase_user_id', userId);
    }
    return userId;
  }
  return 'anonymous';
}

/**
 * Get account-specific document ID for Firestore
 * Format: {userId}_{accountLogin}
 * 
 * This ensures:
 * - Same user, different accounts = separate data
 * - Different users = separate data
 * - Account switching = proper data isolation
 */
export function getAccountDocumentId(): string {
  const userId = getUserId();
  const accountLogin = getCurrentAccountLogin();
  
  if (accountLogin) {
    return `${userId}_${accountLogin}`;
  }
  
  // Fallback: use userId only (for backward compatibility)
  return userId;
}

/**
 * Get account-specific collection path
 * Returns the account login if available, otherwise userId
 */
export function getAccountCollectionId(): string {
  const accountLogin = getCurrentAccountLogin();
  
  if (accountLogin) {
    return `account_${accountLogin}`;
  }
  
  // Fallback: use userId
  return getUserId();
}

/**
 * Check if account context is available
 */
export function hasAccountContext(): boolean {
  return getCurrentAccountLogin() !== null;
}

/**
 * Get current account info for logging/debugging
 */
export function getAccountInfo(): {
  userId: string;
  accountLogin: string | null;
  documentId: string;
  collectionId: string;
} {
  return {
    userId: getUserId(),
    accountLogin: getCurrentAccountLogin(),
    documentId: getAccountDocumentId(),
    collectionId: getAccountCollectionId(),
  };
}

