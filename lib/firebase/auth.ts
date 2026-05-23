/**
 * Firebase Authentication Service
 * Handles user authentication, sign up, sign in, and session management
 */

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  User,
  UserCredential
} from 'firebase/auth';
import { getAuthInstance } from './config';
import { logger } from '../logger';

/**
 * Sign up a new user
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const auth = getAuthInstance();
    const userCredential: UserCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Update display name if provided
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }

    logger.info(`✅ User signed up: ${email}`);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    const errorMessage = getAuthErrorMessage(error.code);
    logger.error(`❌ Sign up failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sign in an existing user
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const auth = getAuthInstance();
    const userCredential: UserCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    logger.info(`✅ User signed in: ${email}`);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    const code = error?.code;
    const errorMessage = getAuthErrorMessage(code);
    logger.error(`❌ Sign in failed: ${errorMessage}${code ? ` (${code})` : ''}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const auth = getAuthInstance();
    const provider = new GoogleAuthProvider();
    
    // Request additional scopes if needed
    provider.addScope('profile');
    provider.addScope('email');
    
    // Set custom parameters
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const userCredential: UserCredential = await signInWithPopup(auth, provider);
    
    logger.info(`✅ User signed in with Google: ${userCredential.user.email}`);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    // Handle popup closed by user
    if (error.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Sign in cancelled' };
    }
    
    const errorMessage = getAuthErrorMessage(error.code);
    logger.error(`❌ Google sign in failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = getAuthInstance();
    await signOut(auth);
    logger.info('✅ User signed out');
    return { success: true };
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to sign out';
    logger.error(`❌ Sign out failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = getAuthInstance();
    await sendPasswordResetEmail(auth, email);
    logger.info(`✅ Password reset email sent to: ${email}`);
    return { success: true };
  } catch (error: any) {
    const errorMessage = getAuthErrorMessage(error.code);
    logger.error(`❌ Password reset failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): User | null {
  try {
    const auth = getAuthInstance();
    return auth.currentUser;
  } catch (error) {
    return null;
  }
}

/**
 * Subscribe to authentication state changes
 */
export function onAuthStateChange(
  callback: (user: User | null) => void
): () => void {
  try {
    const auth = getAuthInstance();
    return onAuthStateChanged(auth, callback);
  } catch (error) {
    // Return no-op unsubscribe if auth not available
    return () => {};
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

/**
 * Get user ID (from Firebase Auth or fallback)
 */
export function getUserId(): string {
  const user = getCurrentUser();
  if (user && user.uid) {
    return user.uid;
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
 * Get user email
 */
export function getUserEmail(): string | null {
  const user = getCurrentUser();
  return user?.email || null;
}

/**
 * Get user display name
 */
export function getUserDisplayName(): string | null {
  const user = getCurrentUser();
  return user?.displayName || null;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  displayName?: string,
  photoURL?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = getCurrentUser();
    if (!user) {
      return { success: false, error: 'No user signed in' };
    }

    const updates: { displayName?: string; photoURL?: string } = {};
    if (displayName) updates.displayName = displayName;
    if (photoURL) updates.photoURL = photoURL;

    await updateProfile(user, updates);
    logger.info('✅ User profile updated');
    return { success: true };
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to update profile';
    logger.error(`❌ Profile update failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Convert Firebase Auth error codes to user-friendly messages
 */
function getAuthErrorMessage(errorCode: string | undefined): string {
  if (!errorCode) return 'Invalid email or password.';
  const errorMessages: Record<string, string> = {
    'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/operation-not-allowed': 'Email/password accounts are not enabled.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/popup-closed-by-user': 'Sign in cancelled.',
    'auth/popup-blocked': 'Popup blocked. Please allow popups for this site.',
    'auth/cancelled-popup-request': 'Only one popup request is allowed at a time.',
  };

  return errorMessages[errorCode] || 'An error occurred. Please try again.';
}

