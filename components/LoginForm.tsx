'use client';

/**
 * Login Form Component
 * Handles user authentication (sign in and sign up)
 */

import { useState } from 'react';
import { signIn, signUp, signInWithGoogle, resetPassword } from '@/lib/firebase/auth';
import { useAuth } from './AuthProvider';

export function LoginForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const { user } = useAuth();

  if (user) {
    return (
      <div className="p-6 card max-w-md mx-auto">
        <div className="text-center">
          <p className="text-emerald-400 mb-2">Signed in as</p>
          <p className="text-lg font-semibold text-white">
            {user.displayName || user.email}
          </p>
          <p className="text-sm text-secondary mt-1">{user.email}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const result = await signUp(email, password, displayName || undefined);
        if (result.success) {
          setSuccess('Account created successfully! You are now signed in.');
          setEmail('');
          setPassword('');
          setDisplayName('');
        } else {
          setError(result.error || 'Failed to create account');
        }
      } else {
        const result = await signIn(email, password);
        if (result.success) {
          setSuccess('Signed in successfully!');
          setEmail('');
          setPassword('');
        } else {
          setError(result.error || 'Failed to sign in');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setGoogleLoading(true);

    try {
      const result = await signInWithGoogle();
      if (result.success) {
        setSuccess('Signed in with Google successfully!');
      } else {
        setError(result.error || 'Failed to sign in with Google');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotMessage(null);
    setForgotLoading(true);
    const result = await resetPassword(forgotEmail);
    if (result.success) {
      setForgotMessage('Check your email for the reset link.');
      setForgotEmail('');
    } else {
      setForgotMessage(result.error || 'Failed to send reset email');
    }
    setForgotLoading(false);
  };

  return (
    <div className="p-6 sm:p-8 max-w-md w-full">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">
        {isSignUp ? 'Create account' : 'Sign in'}
      </h2>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div role="status" aria-live="polite" className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-sm">
          {success}
        </div>
      )}

      {showForgotPassword ? (
        <div className="space-y-4">
          <p className="text-sm text-secondary">Enter your email to receive a reset link.</p>
          <div>
            <label htmlFor="forgot-email" className="label block mb-2">Email</label>
            <input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              className="input min-h-[44px]"
              placeholder="your@email.com"
            />
          </div>
          {forgotMessage && (
            <p className={`text-sm ${forgotMessage.startsWith('Check') ? 'text-emerald-400' : 'text-rose-400'}`}>
              {forgotMessage}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={forgotLoading}
              className="btn btn-primary min-h-[44px] flex-1"
            >
              {forgotLoading ? 'Sending…' : 'Send reset link'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForgotPassword(false); setForgotMessage(null); }}
              className="btn btn-secondary min-h-[44px]"
            >
              Back to sign in
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="display-name" className="label block mb-2">
                Display name (optional)
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input min-h-[44px]"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="label block mb-2">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input min-h-[44px]"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="label block mb-2">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="input min-h-[44px]"
              placeholder="••••••••"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            {isSignUp && (
              <p className="hint mt-1">At least 6 characters</p>
            )}
            {!isSignUp && (
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="mt-2 text-sm text-cyan-400 hover:text-cyan-300 min-h-[44px] px-1 touch-manipulation"
              >
                Forgot password?
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="btn btn-primary w-full min-h-[44px]"
          >
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>
      )}

      {!showForgotPassword && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1e2738]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#141c2b] text-secondary">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="btn btn-secondary w-full min-h-[44px] flex items-center justify-center gap-3"
          >
            {googleLoading ? 'Signing in…' : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccess(null);
              }}
              className="text-sm text-cyan-400 hover:text-cyan-300 min-h-[44px] px-2 touch-manipulation"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
