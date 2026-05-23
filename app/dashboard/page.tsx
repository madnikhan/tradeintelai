'use client'

import { TradingProvider } from '@/context/TradingContext'
import { SubscriptionGate } from '@/components/SubscriptionGate'
import DashboardContent from './DashboardContent'

export default function DashboardPage() {
  return (
    <SubscriptionGate>
      <TradingProvider>
        <DashboardContent />
      </TradingProvider>
    </SubscriptionGate>
  )
}
