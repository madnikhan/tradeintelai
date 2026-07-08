'use client'

import { TradingProvider } from '@/context/TradingContext'
import { BridgeProvider } from '@/context/BridgeContext'
import { SubscriptionGate } from '@/components/SubscriptionGate'
import DashboardContent from './DashboardContent'

export default function DashboardPage() {
  return (
    <SubscriptionGate>
      <BridgeProvider>
        <TradingProvider>
          <DashboardContent />
        </TradingProvider>
      </BridgeProvider>
    </SubscriptionGate>
  )
}
