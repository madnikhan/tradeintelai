'use client';

/**
 * Firebase Authentication Provider
 * Manages authentication state and provides it to the app
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange, getCurrentUser } from '@/lib/firebase/auth';
import { isFirebaseConfigured } from '@/lib/firebase/config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    
    try {
      if (!isFirebaseConfigured()) {
        if (mounted) setLoading(false);
        return;
      }

      // Subscribe to auth state changes
      unsubscribe = onAuthStateChange((authUser) => {
        if (mounted) {
          setUser(authUser);
          setLoading(false);
        }
      });

      // Also check current user immediately
      try {
        const currentUser = getCurrentUser();
        if (currentUser && mounted) {
          setUser(currentUser);
          setLoading(false);
        } else if (mounted) {
          // If no current user, still set loading to false after a short delay
          // to allow Firebase to initialize
          setTimeout(() => {
            if (mounted) setLoading(false);
          }, 1000);
        }
      } catch (error) {
        console.error('Error getting current user:', error);
        if (mounted) setLoading(false);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      if (mounted) setLoading(false);
    }
    
    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

