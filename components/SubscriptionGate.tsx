'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useSubscription } from '@/hooks/useSubscription';

interface SubscriptionGateProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Blocks children until Firebase auth + active subscription.
 */
export function SubscriptionGate({
  children,
  redirectTo = '/subscribe',
}: SubscriptionGateProps) {
  const { user, loading: authLoading } = useAuth();
  const { active, loading: subLoading } = useSubscription();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && !subLoading && !active) {
      router.push(redirectTo);
    }
  }, [user, authLoading, subLoading, active, router, redirectTo]);

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="text-gray-400">Checking subscription…</p>
        </div>
      </div>
    );
  }

  if (!user || !active) {
    return (
      <div className="min-h-screen bg-[#0a0e17] text-white flex items-center justify-center">
        <p className="text-gray-400">Redirecting…</p>
      </div>
    );
  }

  return <>{children}</>;
}
