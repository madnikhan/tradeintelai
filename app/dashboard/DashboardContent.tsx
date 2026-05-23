'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { TradingModeSwitch } from '@/components/TradingModeSwitch'
import { RiskMonitor } from '@/components/RiskMonitor'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { AccountStatsBar } from '@/components/layout/AccountStatsBar'
import { MobileTabBar, PRIMARY_TABS, type PrimaryTabId } from '@/components/layout/MobileTabBar'
import { ConnectionTester } from '@/components/ConnectionTester'
import { TradingModeManager } from '@/lib/trading-mode'
import { httpBridge } from '@/lib/http-bridge-connector'
import { TRADING_RULES } from '@/config/trading-rules'
import { getTradingConfig } from '@/lib/trading-mode'
import { getMaxTradesPerDay, getMaxOpenTrades, getDailyLossPercent } from '@/lib/trading-settings'
import { Trade, Account } from '@/types/trading'
import { TradingHoursFilter } from '@/lib/trading-hours'
import { SmartScoreCard } from '@/components/SmartScoreCard'
import { Settings } from '@/components/Settings'
import { TradeExecutionLog } from '@/components/TradeExecutionLog'
import { fetchTradeHistory, getStoredTrades, convertClosedTradeToTrade } from '@/lib/trade-history'
import { autoMigrate } from '@/lib/firebase/migration'
import { calculateAccountMetrics } from '@/lib/account-calculator'
import { LoadingSkeleton, LoadingSkeletonGrid } from '@/components/LoadingSkeleton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorMessage } from '@/components/ErrorMessage'
import { Tooltip, MetricTooltip } from '@/components/Tooltip'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { QuickActionsMenu } from '@/components/QuickActionsMenu'
import { keyboardShortcuts } from '@/lib/keyboard-shortcuts'
import { useSwipeGesture, attachSwipeListeners } from '@/lib/touch-gestures'
import { logger } from '@/lib/logger'
import { getBridgeUrl } from '@/config/bridge-config'
import { AuthButton } from '@/components/AuthButton'
import { SystemStatus } from '@/components/SystemStatus'

const tabPanelFallback = () => <LoadingSkeleton type="card" />

const TradeTabView = dynamic(
  () => import('@/components/trading/TradeTabView').then((m) => ({ default: m.TradeTabView })),
  { loading: tabPanelFallback, ssr: false }
)
const OpportunityScanner = dynamic(
  () => import('@/components/OpportunityScanner').then((m) => ({ default: m.OpportunityScanner })),
  { loading: tabPanelFallback, ssr: false }
)
const PerformanceTracker = dynamic(() => import('@/components/PerformanceTracker'), {
  loading: tabPanelFallback,
  ssr: false,
})
const AccuracyDashboard = dynamic(
  () => import('@/components/AccuracyDashboard').then((m) => ({ default: m.AccuracyDashboard })),
  { loading: tabPanelFallback, ssr: false }
)
const HealthCheckDashboard = dynamic(
  () => import('@/components/HealthCheckDashboard').then((m) => ({ default: m.HealthCheckDashboard })),
  { loading: tabPanelFallback, ssr: false }
)
const IslamicTradingPanel = dynamic(
  () => import('@/components/IslamicTradingPanel').then((m) => ({ default: m.IslamicTradingPanel })),
  { loading: tabPanelFallback, ssr: false }
)
const ScalpingPanel = dynamic(
  () => import('@/components/ScalpingPanel').then((m) => ({ default: m.ScalpingPanel })),
  { loading: tabPanelFallback, ssr: false }
)

// Initial empty state - Will be loaded from MT5
const emptyAccount: Account = {
  balance: 0,
  equity: 0,
  dailyProfitLoss: 0, // Realized P/L from trades closed today
  unrealizedPL: 0, // Current P/L from open positions
  monthlyProfitLoss: 0,
  allTimeProfitLoss: 0, // Total P/L from all closed trades
  openTrades: 0,
  tradesToday: 0,
  totalTrades: 0
}

type TabType = PrimaryTabId

export default function DashboardContent() {
  const [account, setAccount] = useState<Account>(emptyAccount)
  const [trades, setTrades] = useState<Trade[]>([])
  const [openPositions, setOpenPositions] = useState<any[]>([])
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false)
  const hasLoadedBalanceRef = useRef(false)
  const [isLoadingTrades, setIsLoadingTrades] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('trade')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [tradingHours, setTradingHours] = useState(TradingHoursFilter.analyze())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false) // Mobile sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false) // Desktop sidebar collapse
  const mainContentRef = useRef<HTMLDivElement>(null)

  // Swipe between primary tabs on mobile
  useEffect(() => {
    const el = mainContentRef.current
    if (!el) return
    const tabIds = PRIMARY_TABS.map((t) => t.id)
    const idx = tabIds.indexOf(activeTab)
    const cleanup = attachSwipeListeners(el, {
      onSwipeLeft: () => {
        if (idx < tabIds.length - 1) setActiveTab(tabIds[idx + 1])
      },
      onSwipeRight: () => {
        if (idx > 0) setActiveTab(tabIds[idx - 1])
      },
    })
    return cleanup
  }, [activeTab])

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
      setTradingHours(TradingHoursFilter.analyze())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Get breadcrumb items based on active tab
  const getBreadcrumbs = () => {
    const activeTabData = tabs.find(tab => tab.id === activeTab)
    if (!activeTabData) return []

    return [
      { label: 'Dashboard', icon: '🏠', onClick: () => setActiveTab('trade') },
      { label: activeTabData.label, icon: activeTabData.icon },
    ]
  }

  // Fetch open positions from MT5
  useEffect(() => {
    const fetchOpenPositions = async () => {
      try {
        const positionsResponse = await httpBridge.getPositions()
        if (positionsResponse.success && positionsResponse.positions) {
          setOpenPositions(positionsResponse.positions)
        }
      } catch (error) {
        logger.error('Failed to fetch open positions:', error)
      }
    }

    fetchOpenPositions()
    // Reduced frequency to avoid overwhelming bridge when EA is not responding
    const interval = setInterval(fetchOpenPositions, 60000) // 60 seconds instead of 30
    return () => clearInterval(interval)
  }, [])

  // Fetch REAL account balance from MT5 and detect account type
  useEffect(() => {
    let attemptCount = 0
    const fetchRealAccountBalance = async () => {
      try {
        attemptCount++
        if (!hasLoadedBalanceRef.current) {
          setIsLoadingBalance(true)
        } else {
          setIsRefreshingBalance(true)
        }
        logger.debug(`🔄 Fetching account balance (attempt ${attemptCount})...`)
        
        // Log the bridge URL being used BEFORE fetch
        const bridgeUrl = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:8080';
        console.log(`🔍 [Dashboard] Fetching account balance from: ${bridgeUrl}`);
        console.log(`🔍 [Dashboard] Environment variable NEXT_PUBLIC_BRIDGE_URL:`, process.env.NEXT_PUBLIC_BRIDGE_URL);
        
        const accountInfo = await httpBridge.getAccountInfo()
        
        // Log full response for debugging
        console.log('📥 [Dashboard] Account info response:', JSON.stringify(accountInfo, null, 2));
        logger.debug('📥 Account info response:', JSON.stringify(accountInfo, null, 2))
        
        // Log bridge URL if error (for debugging)
        if (!accountInfo.success) {
          console.error(`❌ [Dashboard] Account fetch failed!`);
          console.error(`🔗 Bridge URL used: ${accountInfo.bridgeUrl || bridgeUrl}`);
          console.error(`📋 Full error response:`, accountInfo);
          logger.error(`🔗 Bridge URL used: ${accountInfo.bridgeUrl || bridgeUrl}`)
          logger.error(`💡 Expected: https://1fbec4f40bef.ngrok-free.app/account (or ngrok URL if configured)`)
        }
        
        // Accept balance even if 0 (valid for some accounts) - only check if it's a valid number
        if (accountInfo.success && accountInfo.balance !== undefined && accountInfo.balance !== null && !isNaN(accountInfo.balance)) {
          // Auto-detect trading mode from MT5 account type
          let detectedMode: 'demo' | 'live' = 'live' // Default to live
          
          if (accountInfo.account_type) {
            detectedMode = accountInfo.account_type === 'demo' ? 'demo' : 'live'
            logger.debug(`🔍 Auto-detected trading mode from MT5 account_type: ${detectedMode}`)
          } else if (accountInfo.server) {
            const serverName = accountInfo.server.toLowerCase()
            if (serverName.includes('demo')) {
              detectedMode = 'demo'
              logger.debug(`🔍 Auto-detected trading mode from server name: ${detectedMode} (server: ${accountInfo.server})`)
            } else {
              detectedMode = 'live'
              logger.debug(`🔍 Auto-detected trading mode from server name: ${detectedMode} (server: ${accountInfo.server})`)
            }
          }

          if (TradingModeManager.getCurrentMode() !== detectedMode) {
            TradingModeManager.setMode(detectedMode)
          }
          
          const realBalance = accountInfo.balance
          const realEquity = accountInfo.equity || accountInfo.balance
          
          setAccount(prev => ({
            ...prev,
            balance: realBalance,
            equity: realEquity,
          }))
          
          TradingModeManager.setRealBalance(realBalance)
          hasLoadedBalanceRef.current = true
          console.log('✅ [Dashboard] Real MT5 balance loaded:', realBalance, 'Equity:', realEquity, 'Login:', accountInfo.login, 'Server:', accountInfo.server)
          logger.info(`✅ Real MT5 balance loaded: ${realBalance} Equity: ${realEquity} Login: ${accountInfo.login} Server: ${accountInfo.server}`)
        } else {
          // Balance not loaded - log detailed error for debugging
          console.error('❌ [Dashboard] MT5 balance not loaded. Response details:', {
            success: accountInfo.success,
            hasBalance: accountInfo.balance !== undefined,
            balance: accountInfo.balance,
            error: accountInfo.error,
            source: accountInfo.source,
            bridgeUrl: accountInfo.bridgeUrl || bridgeUrl,
            fullResponse: accountInfo
          })
          logger.warn('⚠️ MT5 balance not loaded. Response details:', {
            success: accountInfo.success,
            hasBalance: accountInfo.balance !== undefined,
            balance: accountInfo.balance,
            error: accountInfo.error,
            source: accountInfo.source,
            bridgeUrl: accountInfo.bridgeUrl || bridgeUrl,
            fullResponse: accountInfo
          })
          
          if (accountInfo.error) {
            if (accountInfo.error.includes('timeout') || accountInfo.error.includes('Timeout') || accountInfo.error.includes('not responding')) {
              console.error('⏱️ [Dashboard] MT5 EA timeout - EA may not be processing account info commands. Check:')
              console.error('   1. EA (MT5FileBridgeEA) is attached to a chart')
              console.error('   2. EA has "Allow live trading" enabled')
              console.error('   3. EA logs show "✅ Found command file" messages')
              console.error('   4. Check MT5 Experts tab for EA errors')
              console.error('   5. Command files exist in mt5-commands directory')
              logger.error('⏱️ MT5 Bridge timeout - EA may not be processing command files. Check:')
              logger.error('   1. EA is attached to a chart')
              logger.error('   2. EA logs show "✅ Found command file" messages')
              logger.error('   3. Command files exist in mt5-commands directory')
            } else {
              console.error('❌ [Dashboard] MT5 Bridge error:', accountInfo.error)
              logger.error('❌ MT5 Bridge error:', accountInfo.error)
            }
          } else if (!accountInfo.success) {
            console.error('❌ [Dashboard] Account info request failed. Bridge URL:', accountInfo.bridgeUrl || bridgeUrl)
            console.error('❌ [Dashboard] Full response:', JSON.stringify(accountInfo, null, 2))
            logger.error('❌ Account info request failed. Check bridge logs for details.')
          }
          // Don't set fake balance - keep at 0 until MT5 connects
          // Also don't set realBalance to null - keep previous value if it was set
        }
      } catch (error: any) {
        logger.error('❌ Failed to fetch account balance from MT5:', {
          error: error.message,
          stack: error.stack,
          name: error.name
        })
        // Don't set fake balance - keep at 0 until MT5 connects
      } finally {
        setIsLoadingBalance(false)
        setIsRefreshingBalance(false)
      }
    }

    // Fetch immediately on mount
    fetchRealAccountBalance()
    // Then poll every 60 seconds (reduced frequency to avoid overwhelming bridge when EA is not responding)
    const interval = setInterval(fetchRealAccountBalance, 60000)
    
    // Auto-migrate to Firestore if needed (non-blocking)
    autoMigrate().catch(err => {
      console.warn('Firestore migration failed (non-critical):', err)
    })
    
    return () => clearInterval(interval)
  }, [])
  
  // Force mode update when account info changes (for TradingModeSwitch reactivity)
  useEffect(() => {
    // Trigger a re-render of components that depend on trading mode
    const mode = TradingModeManager.getCurrentMode()
    // Dispatch a custom event that TradingModeSwitch can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tradingModeChanged', { detail: { mode } }))
    }
  }, [account.balance]) // Re-check when balance changes (indicates account info was fetched)

  // Calculate daily/monthly P/L from trades and open positions
  useEffect(() => {
    // Always calculate metrics, even if empty (to show 0 instead of stale data)
    const metrics = calculateAccountMetrics(trades, openPositions)
    
      setAccount(prev => ({
        ...prev,
        dailyProfitLoss: metrics.dailyProfitLoss, // Realized P/L from closed trades today
        unrealizedPL: metrics.unrealizedPL, // Current P/L from open positions
        monthlyProfitLoss: metrics.monthlyProfitLoss,
        allTimeProfitLoss: metrics.allTimeProfitLoss, // Total P/L from all closed trades
        openTrades: metrics.openTrades,
        tradesToday: metrics.tradesToday,
        totalTrades: metrics.totalTrades,
      }))
    
    if (trades.length > 0 || openPositions.length > 0) {
      logger.logAccountMetrics({
        dailyPL: metrics.dailyProfitLoss,
        unrealizedPL: metrics.unrealizedPL,
        monthlyPL: metrics.monthlyProfitLoss,
        allTimePL: metrics.allTimeProfitLoss,
        openTrades: metrics.openTrades,
        totalTrades: metrics.totalTrades,
      })
    }
  }, [trades, openPositions])

  // Manual sync function (can be called from button)
  const syncTrades = useCallback(async () => {
    const showTradeSkeleton = trades.length === 0
    if (showTradeSkeleton) {
      setIsLoadingTrades(true)
    }
    try {
      console.log('🔄 Starting trade sync...')
      
      // Fetch both closed and open positions with timeout handling
      let closedData: any = { success: false, positions: [] }
      let openPositionsData: any = { success: false, positions: [] }
      
      // Try closed positions endpoint first
      try {
        console.log('📥 Fetching closed positions...')
        const closedResponse = await fetch(getBridgeUrl('/closed-positions'), {
          headers: {
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': 'true', // Skip ngrok free tier browser warning
          },
          signal: AbortSignal.timeout(25000) // 25 second timeout (EA needs more time)
        }).catch((error) => {
          console.warn('⚠️ Closed positions fetch failed:', error.message)
          return null
        })
        
        if (closedResponse && closedResponse.ok) {
          try {
            closedData = await closedResponse.json()
            console.log(`📊 Closed positions response: success=${closedData.success}, count=${closedData.positions?.length || 0}`)
            if (!closedData.success && closedData.error) {
              console.warn('⚠️ Closed positions error:', closedData.error)
            }
          } catch (e) {
            console.warn('⚠️ Failed to parse closed positions response:', e)
          }
        } else {
          console.warn('⚠️ Closed positions response not OK:', closedResponse?.status)
        }
      } catch (error: any) {
        console.warn('⚠️ Failed to fetch closed positions:', error.message || error)
      }
      
      // If closed positions failed, log diagnostic info
      if (!closedData.success || !closedData.positions || closedData.positions.length === 0) {
        if (closedData.error) {
          console.warn('⚠️ Closed positions error:', closedData.error)
          if (closedData.error.includes('Timeout')) {
            console.warn('💡 EA is not responding. Please check:')
            console.warn('   1. MT5 EA (MT5FileBridgeEA) is attached to a chart')
            console.warn('   2. EA is running (check MT5 Experts tab)')
            console.warn('   3. EA has "Allow live trading" enabled')
            console.warn('   4. Check MT5 Experts log for errors')
          }
        }
      }
      
      // Fetch open positions
      try {
        console.log('📥 Fetching open positions...')
        openPositionsData = await httpBridge.getPositions()
        console.log(`📊 Open positions response: success=${openPositionsData.success}, count=${openPositionsData.positions?.length || 0}`)
      } catch (error: any) {
        console.warn('⚠️ Failed to fetch open positions:', error.message || error)
      }

      const allTrades: Trade[] = []

      // Add closed trades
      if (closedData.success && closedData.positions && closedData.positions.length > 0) {
          logger.debug(`📝 Processing ${closedData.positions.length} closed positions...`)
          const closedTrades = closedData.positions.map((pos: any, index: number) => {
            const entryPrice = pos.entry_price || pos.entryPrice || 0
            const exitPrice = pos.exit_price || pos.exitPrice || 0
            const stopLoss = entryPrice * 0.99
            const takeProfit = entryPrice * 1.02
            const lotSize = pos.volume || 0
            // Net P/L = profit + swap + commission (all costs included)
            const profit = pos.profit || 0
            const swap = pos.swap || 0
            const commission = pos.commission || 0
            const netProfitLoss = profit + swap + commission

            return {
              id: pos.position_id?.toString() || `closed_${Date.now()}_${index}`,
              pair: pos.symbol || 'EURUSD',
              direction: (pos.direction === 'BUY' || pos.direction === 'buy') ? 'BUY' : 'SELL',
              entryPrice,
              stopLoss,
              takeProfit,
              lotSize,
              riskAmount: 0,
              rewardAmount: 0,
              status: 'closed' as const,
              profitLoss: netProfitLoss, // Net P/L after commission and swap
              timestamp: new Date(pos.close_time || pos.closeTime || pos.open_time || pos.openTime || Date.now()),
              reason: 'MT5 Closed Position',
            }
          })
          allTrades.push(...closedTrades)
          logger.debug(`✅ Added ${closedTrades.length} closed trades`)
          console.log(`✅ Added ${closedTrades.length} closed trades to allTrades array`)
          if (closedTrades.length > 0) {
            console.log('📊 Sample closed trade:', {
              id: closedTrades[0].id,
              pair: closedTrades[0].pair,
              profitLoss: closedTrades[0].profitLoss,
              status: closedTrades[0].status,
              timestamp: closedTrades[0].timestamp
            })
          }
      } else {
        logger.debug('⚠️ No closed positions found')
        console.warn('⚠️ No closed positions found in response:', {
          success: closedData.success,
          positions: closedData.positions?.length || 0,
          error: closedData.error
        })
      }

      // Add open positions as open trades
      if (openPositionsData.success && openPositionsData.positions && openPositionsData.positions.length > 0) {
        logger.debug(`📝 Processing ${openPositionsData.positions.length} open positions...`)
        const openTrades = openPositionsData.positions.map((pos: any, index: number) => {
          const entryPrice = pos.open_price || pos.entryPrice || 0
          const stopLoss = pos.sl || pos.stopLoss || entryPrice * 0.99
          const takeProfit = pos.tp || pos.takeProfit || entryPrice * 1.02
          const lotSize = pos.volume || 0

          return {
            id: pos.ticket?.toString() || `open_${Date.now()}_${index}`,
            pair: pos.symbol || 'EURUSD',
            direction: (pos.type === 'BUY' || pos.type === 'buy') ? 'BUY' : 'SELL',
            entryPrice,
            stopLoss,
            takeProfit,
            lotSize,
            riskAmount: 0,
            rewardAmount: 0,
            status: 'open' as const,
            profitLoss: pos.profit || pos.profitLoss || 0, // Unrealized P/L
            timestamp: new Date(pos.openTime || pos.open_time || Date.now()),
            reason: 'MT5 Open Position',
          }
        })
        allTrades.push(...openTrades)
        logger.debug(`✅ Added ${openTrades.length} open trades`)
      } else {
        logger.debug('⚠️ No open positions found')
      }

      if (allTrades.length > 0) {
        setTrades(allTrades)
        // Store in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('mt5_trade_history', JSON.stringify(allTrades))
        }
        const closedCount = allTrades.filter(t => t.status === 'closed').length
        const openCount = allTrades.filter(t => t.status === 'open').length
        const totalPL = allTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0)
        const openPL = allTrades.filter(t => t.status === 'open').reduce((sum, t) => sum + (t.profitLoss || 0), 0)
        const closedPL = allTrades.filter(t => t.status === 'closed').reduce((sum, t) => sum + (t.profitLoss || 0), 0)
        
        logger.logTradeSync(allTrades.length, closedCount, openCount)
        logger.debug(`📊 Total P/L: $${totalPL.toFixed(2)} (Closed: $${closedPL.toFixed(2)}, Open: $${openPL.toFixed(2)})`)
        
        // Enhanced debugging for All Time P/L
        console.log('🔍 All Time P/L Debug (from sync):', {
          totalTrades: allTrades.length,
          closedTrades: closedCount,
          closedPL: closedPL,
          sampleClosedTrades: allTrades.filter(t => t.status === 'closed').slice(0, 3).map(t => ({
            id: t.id,
            pair: t.pair,
            profitLoss: t.profitLoss,
            status: t.status
          }))
        })
        
        // Log sample trades for debugging (only in development)
        if (closedCount > 0 && process.env.NODE_ENV === 'development') {
          logger.debug('📋 Sample closed trades:')
          allTrades.filter(t => t.status === 'closed').slice(0, 3).forEach(t => {
            logger.debug(`  - ${t.pair} ${t.direction} | Entry: ${t.entryPrice} | P/L: $${(t.profitLoss || 0).toFixed(2)} | Time: ${t.timestamp}`)
          })
        }
        if (openCount > 0 && process.env.NODE_ENV === 'development') {
          logger.debug('📋 Open trades:')
          allTrades.filter(t => t.status === 'open').forEach(t => {
            logger.debug(`  - ${t.pair} ${t.direction} | Entry: ${t.entryPrice} | P/L: $${(t.profitLoss || 0).toFixed(2)}`)
          })
        }
      } else {
        logger.warn('⚠️ No trades found from MT5. Checking cache...')
        const storedTrades = getStoredTrades()
        if (storedTrades.length > 0) {
          console.log(`✅ Loading ${storedTrades.length} trades from cache`)
          console.log('🔍 Cached trades sample:', storedTrades.slice(0, 3).map(t => ({
            id: t.id,
            pair: t.pair,
            status: t.status,
            profitLoss: t.profitLoss
          })))
          const closedFromCache = storedTrades.filter(t => t.status === 'closed')
          const cachePL = closedFromCache.reduce((sum, t) => sum + (t.profitLoss || 0), 0)
          console.log(`🔍 Cache Analysis: ${closedFromCache.length} closed trades, Total P/L: $${cachePL.toFixed(2)}`)
          setTrades(storedTrades)
          logger.info(`✅ Loaded ${storedTrades.length} trades from cache`)
        } else {
          logger.warn('⚠️ No trades found in cache either. Make sure:')
          logger.warn('   1. MT5 EA is running and attached to a chart')
          logger.warn('   2. Python bridge is running (port 8080)')
          logger.warn('   3. EA has access to trade history')
        }
      }
    } catch (error: any) {
      logger.error('❌ Failed to sync trades:', error.message || error)
      const storedTrades = getStoredTrades()
      if (storedTrades.length > 0) {
        console.log(`✅ Loading ${storedTrades.length} trades from cache as fallback`)
        const closedFromCache = storedTrades.filter(t => t.status === 'closed')
        const cachePL = closedFromCache.reduce((sum, t) => sum + (t.profitLoss || 0), 0)
        console.log(`🔍 Cache Fallback: ${closedFromCache.length} closed trades, Total P/L: $${cachePL.toFixed(2)}`)
        setTrades(storedTrades)
        logger.info(`✅ Loaded ${storedTrades.length} trades from cache as fallback`)
      }
    } finally {
      setIsLoadingTrades(false)
    }
  }, [trades.length])

  // Keyboard shortcuts
  useEffect(() => {
    const shortcuts = [
      { key: '1', handler: () => setActiveTab('trade'), description: 'Go to Trade' },
      { key: '2', handler: () => setActiveTab('scan'), description: 'Go to Scan' },
      { key: '3', handler: () => setActiveTab('performance'), description: 'Go to Performance' },
      { key: '4', handler: () => setActiveTab('settings'), description: 'Go to Settings' },
      { key: 's', ctrl: true, handler: syncTrades, description: 'Sync Trades' },
      { key: 'f', ctrl: true, handler: toggleFullscreen, description: 'Toggle Fullscreen' },
      { key: 'b', ctrl: true, handler: () => setSidebarCollapsed(!sidebarCollapsed), description: 'Toggle Sidebar' },
    ]

    shortcuts.forEach(shortcut => {
      keyboardShortcuts.register({
        key: shortcut.key,
        ctrl: shortcut.ctrl,
        handler: shortcut.handler,
        description: shortcut.description,
      })
    })

    return () => {
      shortcuts.forEach(shortcut => {
        keyboardShortcuts.unregister(shortcut.key)
      })
    }
  }, [syncTrades, sidebarCollapsed, toggleFullscreen])

  // Fetch trade history - AUTO-SYNC from MT5
  useEffect(() => {
    // Load cached trades immediately (for instant display while MT5 sync happens)
    const cachedTrades = getStoredTrades()
    if (cachedTrades.length > 0) {
      console.log(`⚡ Loading ${cachedTrades.length} cached trades immediately`)
      const closedFromCache = cachedTrades.filter(t => t.status === 'closed')
      const cachePL = closedFromCache.reduce((sum, t) => sum + (t.profitLoss || 0), 0)
      console.log(`🔍 Immediate Cache: ${closedFromCache.length} closed trades, Total P/L: $${cachePL.toFixed(2)}`)
      setTrades(cachedTrades)
    }
    
    // Then sync from MT5 (may take a few seconds)
    syncTrades()
    
    // Listen for trades updated event (from manual entry)
    const handleTradesUpdated = () => {
      syncTrades()
    }
    window.addEventListener('tradesUpdated', handleTradesUpdated)
    
    // Auto-refresh trades every 60 seconds from MT5 (reduced to avoid overwhelming bridge)
    const interval = setInterval(syncTrades, 60000) // 60 seconds instead of 30
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('tradesUpdated', handleTradesUpdated)
    }
  }, [syncTrades])

  // Quick actions - defined after syncTrades
  const quickActions = [
    {
      id: 'sync-trades',
      label: 'Sync Trades',
      icon: '↻',
      shortcut: 'Ctrl+S',
      onClick: syncTrades,
    },
    {
      id: 'scan-opportunities',
      label: 'Scan Opportunities',
      icon: '🔍',
      shortcut: 'Ctrl+3',
      onClick: () => setActiveTab('scan'),
    },
    {
      id: 'new-trade',
      label: 'New Trade',
      icon: '💹',
      shortcut: 'Ctrl+2',
      onClick: () => setActiveTab('trade'),
    },
    {
      id: 'toggle-fullscreen',
      label: isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen',
      icon: isFullscreen ? '⛶' : '⛶',
      shortcut: 'Ctrl+F',
      onClick: toggleFullscreen,
    },
    {
      id: 'toggle-sidebar',
      label: sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar',
      icon: sidebarCollapsed ? '→' : '←',
      shortcut: 'Ctrl+B',
      onClick: () => setSidebarCollapsed(!sidebarCollapsed),
    },
  ]

  const tabs = PRIMARY_TABS

  const content = (
    <div className="min-h-screen bg-[#0a0e17] text-white flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col bg-[#0d1321] border-r border-[#1e2738] transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#1e2738] flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src="/logo.png" 
                  alt="TradeIntel AI Logo" 
                  className="h-10 w-10 object-contain"
                  onError={(e) => {
                    // Fallback to text logo if image not found
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-cyan-500/20 hidden" style={{display: 'none'}}>
                  TI
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  TradeIntel AI
                </h1>
                <p className="text-[10px] text-gray-500 -mt-0.5">Trading System</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="flex justify-center">
              <div className="relative">
                <img 
                  src="/logo.png" 
                  alt="TradeIntel AI Logo" 
                  className="h-10 w-10 object-contain"
                  onError={(e) => {
                    // Fallback to text logo if image not found
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-cyan-500/20 hidden" style={{display: 'none'}}>
                  TI
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e2738] transition-all"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {tabs.map((tab, index) => (
            <Tooltip key={tab.id} content={`${tab.label} (${index + 1})`} position="right">
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 touch-manipulation ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10'
                }`}
                title={sidebarCollapsed ? `${tab.label} (${index + 1})` : undefined}
              >
                <span className="text-xl flex-shrink-0">{tab.icon}</span>
                {!sidebarCollapsed && (
                  <span className="font-medium text-sm">{tab.label}</span>
                )}
                {!sidebarCollapsed && (
                  <span className="ml-auto text-xs text-gray-500 font-mono">{index + 1}</span>
                )}
              </button>
            </Tooltip>
          ))}
        </nav>

        {/* Sidebar Footer */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-[#1e2738] space-y-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              tradingHours.quality === 'PRIME' ? 'bg-green-500/10 text-green-400' :
              tradingHours.quality === 'GOOD' ? 'bg-cyan-500/10 text-cyan-400' :
              tradingHours.quality === 'AVERAGE' ? 'bg-yellow-500/10 text-yellow-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${
                tradingHours.quality === 'PRIME' ? 'bg-green-400' :
                tradingHours.quality === 'GOOD' ? 'bg-cyan-400' :
                tradingHours.quality === 'AVERAGE' ? 'bg-yellow-400' :
                'bg-red-400'
              }`}></span>
              <span className="font-medium">{tradingHours.currentSession}</span>
            </div>
            <div className="flex items-center text-xs text-gray-400 px-3">
              <span className="text-gray-600 mr-1">UK</span>
              <span className="font-mono font-medium text-white">
                {currentTime.toLocaleTimeString('en-GB', { 
                  timeZone: 'Europe/London',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`md:hidden fixed left-0 top-0 h-full bg-[#0d1321] border-r border-[#1e2738] z-50 transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } w-72 max-w-[85vw]`}>
        <div className="p-4 border-b border-[#1e2738] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src="/logo.png" 
                alt="TradeIntel AI Logo" 
                className="h-10 w-10 object-contain"
                onError={(e) => {
                  // Fallback to text logo if image not found
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-cyan-500/20 hidden" style={{display: 'none'}}>
                TI
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                TradeIntel AI
              </h1>
              <p className="text-[10px] text-gray-500 -mt-0.5">Trading System</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e2738] transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all duration-200 touch-manipulation min-h-[48px] ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10'
              }`}
            >
              <span className="text-2xl flex-shrink-0">{tab.icon}</span>
              <span className="font-medium text-base flex-1 text-left">{tab.label}</span>
              <span className="text-xs text-gray-500 font-mono bg-[#1e2738] px-2 py-1 rounded">{index + 1}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          onMenuOpen={() => setSidebarOpen(true)}
          tradingHoursQuality={tradingHours.quality}
          currentSession={tradingHours.currentSession}
        />

        <main ref={mainContentRef} className="flex-1 overflow-y-auto dashboard-main-pad">
          <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-4 sm:py-6">
            <div className="hidden md:block mb-4">
              <Breadcrumbs items={getBreadcrumbs()} />
            </div>
            <AccountStatsBar
              account={account}
              isLoadingBalance={isLoadingBalance}
              isLoadingTrades={isLoadingTrades}
              isRefreshingBalance={isRefreshingBalance}
              onSyncTrades={syncTrades}
              isSyncing={isLoadingTrades}
            />

        {/* Tab Content */}
        <div className="py-2 sm:py-4">
        {activeTab === 'trade' && (
          <TradeTabView account={account} />
        )}

        {activeTab === 'scan' && (
          <div className="max-w-7xl mx-auto">
            <div className="card animate-fade-in overflow-hidden">
              <OpportunityScanner />
            </div>
          </div>
        )}


        {activeTab === 'settings' && (
          <div className="max-w-7xl mx-auto">
            <div className="space-y-4 sm:space-y-6">
              <div className="card animate-fade-in overflow-hidden">
                <Settings />
              </div>
                  
              {/* Islamic Trading Panel */}
              <div className="card animate-fade-in overflow-hidden">
                <IslamicTradingPanel />
              </div>

              {/* Scalping Panel */}
              <div className="card animate-fade-in overflow-hidden">
                <ScalpingPanel />
              </div>
                  
              {/* Health Check Dashboard */}
              <div className="card animate-fade-in">
                <HealthCheckDashboard />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="max-w-7xl mx-auto">
            <div className="space-y-4 sm:space-y-6">
              {/* Accuracy Dashboard */}
              <div className="card animate-fade-in">
                    <AccuracyDashboard 
                      trades={trades}
                      currentBalance={account.balance}
                      initialBalance={getTradingConfig(TradingModeManager.getCurrentMode()).initialBalance}
                    />
                  </div>

              {/* Performance Tracker */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2">
                  <div className="card animate-fade-in overflow-hidden">
                    <div className="p-4 border-b border-[#1e2738] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {trades.length > 0 ? `${trades.length} trades loaded` : 'No trades found'}
                        </span>
                      </div>
                      <button
                        onClick={syncTrades}
                        disabled={isLoadingTrades}
                        className="btn btn-secondary text-xs"
                      >
                        {isLoadingTrades ? '↻ Syncing...' : '↻ Sync from MT5'}
                      </button>
                    </div>
                    <PerformanceTracker 
                      mode={TradingModeManager.getCurrentMode()}
                      config={getTradingConfig(TradingModeManager.getCurrentMode())}
                      trades={trades}
                      currentBalance={account.balance}
                    />
                  </div>
                </div>
                <div className="space-y-4 sm:space-y-6">
                  {/* Demo Success Requirements */}
                  {TradingModeManager.isDemoMode() && (
                    <div className="card bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 animate-fade-in">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-400">
                        <span>🎯</span> Demo Success Goals
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">3 Profitable Weeks</span>
                          <span className="font-bold text-white">0 / 3</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">Win Rate &gt; 55%</span>
                          <span className="font-bold text-white">0%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">Max Drawdown &lt; 8%</span>
                          <span className="font-bold text-white">0%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">Profit Factor &gt; 1.5</span>
                          <span className="font-bold text-white">0.00</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="card animate-fade-in">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <span>📊</span> Statistics
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
                        <span className="text-secondary text-sm">Total Trades</span>
                        <span className="font-mono font-bold">{account.totalTrades}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
                        <span className="text-secondary text-sm">Trades Today</span>
                        <span className="font-mono font-bold">{account.tradesToday}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-secondary text-sm">Open Positions</span>
                        <span className="font-mono font-bold text-cyan-400">{account.openTrades}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card animate-fade-in overflow-hidden">
                <TradeExecutionLog />
              </div>
            </div>
          </div>
        )}
        </div>
          </div>
        </main>

        <MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
  return content;
}
