'use client';

/**
 * Authentication Button Component
 * Shows sign in/sign out button and user info
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { signOutUser, resetPassword } from '@/lib/firebase/auth';
import { LoginForm } from './LoginForm';

export function AuthButton() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    const result = await signOutUser();
    if (result.success) {
      setShowLogin(false);
      // Redirect to login page (root page)
      router.push('/');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage(null);

    const result = await resetPassword(resetEmail);
    if (result.success) {
      setResetMessage('Password reset email sent! Check your inbox.');
      setResetEmail('');
    } else {
      setResetMessage(result.error || 'Failed to send reset email');
    }

    setResetLoading(false);
  };

  if (loading) {
    return (
      <div className="px-4 py-2 text-gray-600 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  if (user) {
    return (
      <div className="relative">
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* User Avatar - Smaller on mobile */}
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-gray-300 dark:border-gray-600"
            />
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs sm:text-sm font-medium">
              {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          
          {/* User Info - Hidden on mobile */}
          <div className="text-right hidden md:block">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
              {user.displayName || 'User'}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
              {user.email}
            </div>
          </div>
          
          {/* Sign Out Button - Icon only on mobile */}
          <button
            onClick={handleSignOut}
            className="p-1.5 sm:px-3 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors touch-manipulation min-h-[36px] sm:min-h-[44px]"
            title="Sign Out"
          >
            <span className="hidden sm:inline text-xs sm:text-sm">Sign Out</span>
            <svg className="sm:hidden w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowLogin(!showLogin)}
        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
      >
        Sign In
      </button>

      {showLogin && (
        <div className="absolute right-0 mt-2 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[320px]">
            <LoginForm />
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Forgot password?
              </button>
              {showResetPassword && (
                <form onSubmit={handleResetPassword} className="mt-3 space-y-2">
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-2 px-4 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md"
                  >
                    {resetLoading ? 'Sending...' : 'Send Reset Email'}
                  </button>
                  {resetMessage && (
                    <div
                      className={`text-xs p-2 rounded ${
                        resetMessage.includes('sent')
                          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                          : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                      }`}
                    >
                      {resetMessage}
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

