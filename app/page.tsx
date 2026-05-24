'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { LoginForm } from '@/components/LoginForm'
import { useSubscription } from '@/hooks/useSubscription'
import { isBridgeSetupComplete } from '@/lib/bridge-setup-status'

export default function Home() {
  const { user, loading } = useAuth()
  const { active, loading: subLoading } = useSubscription()
  const router = useRouter()

  useEffect(() => {
    if (loading || subLoading || !user) return

    async function redirect() {
      if (!active) {
        router.push('/subscribe')
        return
      }
      const setupComplete = await isBridgeSetupComplete()
      router.push(setupComplete ? '/dashboard' : '/onboarding')
    }

    redirect()
  }, [user, loading, subLoading, active, router])

  if (loading || subLoading || user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#0a0e17] text-white safe-area-top safe-area-bottom">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="text-secondary">{user ? 'Redirecting to dashboard…' : 'Loading…'}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-[#0a0e17] text-white safe-area-top safe-area-bottom">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">TradeIntel AI</h1>
          <p className="text-secondary">Sign in to access your trading dashboard</p>
        </div>

        <div className="card border-[#1e2738] shadow-xl">
          <LoginForm />
        </div>

        <p className="text-center text-xs text-tertiary">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </main>
  )
}
