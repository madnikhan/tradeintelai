'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TradingModeSwitch } from '@/components/TradingModeSwitch'
import { RiskMonitor } from '@/components/RiskMonitor'
import { TradePanel } from '@/components/TradePanel'
import { AITradingDashboard } from '@/components/AITradingDashboard'
import { ConnectionTester } from '@/components/ConnectionTester'
import PerformanceTracker from '@/components/PerformanceTracker'
import { TradingModeManager } from '@/lib/trading-mode'
import { httpBridge } from '@/lib/http-bridge-connector'
import { TRADING_RULES } from '@/config/trading-rules'
import { getTradingConfig } from '@/lib/trading-mode'
import { Trade, Account } from '@/types/trading'
import { TradingHoursFilter } from '@/lib/trading-hours'
import { SmartScoreCard } from '@/components/SmartScoreCard'
import { AccountSelector } from '@/components/AccountSelector'
import { TradeAnalysisDashboard } from '@/components/TradeAnalysisDashboard'
import { OpportunityScanner } from '@/components/OpportunityScanner'
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
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { logger } from '@/lib/logger'
import { getBridgeUrl } from '@/config/bridge-config'
import { AuthButton } from '@/components/AuthButton'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { SystemStatus } from '@/components/SystemStatus'

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

type TabType = 'overview' | 'trade' | 'analysis' | 'smartscore' | 'performance' | 'tradeanalysis' | 'opportunities' | 'settings' | 'executionlog'

export default function DashboardPage() {
  const [account, setAccount] = useState<Account>(emptyAccount)
  const [trades, setTrades] = useState<Trade[]>([])
  const [openPositions, setOpenPositions] = useState<any[]>([])
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [isLoadingTrades, setIsLoadingTrades] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [tradingHours, setTradingHours] = useState(TradingHoursFilter.analyze())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false) // Mobile sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false) // Desktop sidebar collapse
  const mainContentRef = useRef<HTMLDivElement>(null) // For touch gestures

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
      { label: 'Dashboard', icon: '🏠', onClick: () => setActiveTab('overview') },
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
        setIsLoadingBalance(true)
        logger.debug(`🔄 Fetching account balance (attempt ${attemptCount})...`)
        
        const accountInfo = await httpBridge.getAccountInfo()
        
        // Log full response for debugging
        logger.debug('📥 Account info response:', JSON.stringify(accountInfo, null, 2))
        
        // Accept balance even if 0 (valid for some accounts) - only check if it's a valid number
        if (accountInfo.success && accountInfo.balance !== undefined && accountInfo.balance !== null && !isNaN(accountInfo.balance)) {
          // Auto-detect trading mode from MT5 account type
          let detectedMode: 'demo' | 'live' = 'live' // Default to live
          
          if (accountInfo.account_type) {
            // Use account_type from EA if available
            detectedMode = accountInfo.account_type === 'demo' ? 'demo' : 'live'
            logger.debug(`🔍 Auto-detected trading mode from MT5 account_type: ${detectedMode}`)
          } else if (accountInfo.server) {
            // Fallback: detect from server name (demo servers usually contain "demo" or "Demo")
            const serverName = accountInfo.server.toLowerCase()
            if (serverName.includes('demo')) {
              detectedMode = 'demo'
              logger.debug(`🔍 Auto-detected trading mode from server name: ${detectedMode} (server: ${accountInfo.server})`)
            } else {
              detectedMode = 'live'
              logger.debug(`🔍 Auto-detected trading mode from server name: ${detectedMode} (server: ${accountInfo.server})`)
            }
          }
          
          TradingModeManager.setMode(detectedMode)
          
          const realBalance = accountInfo.balance
          const realEquity = accountInfo.equity || accountInfo.balance
          
          setAccount(prev => ({
            ...prev,
            balance: realBalance,
            equity: realEquity,
          }))
          
          TradingModeManager.setRealBalance(realBalance)
          logger.info('✅ Real MT5 balance loaded:', realBalance, 'Equity:', realEquity, 'Login:', accountInfo.login, 'Server:', accountInfo.server)
        } else {
          // Balance not loaded - log detailed error for debugging
          logger.warn('⚠️ MT5 balance not loaded. Response details:', {
            success: accountInfo.success,
            hasBalance: accountInfo.balance !== undefined,
            balance: accountInfo.balance,
            error: accountInfo.error,
            source: accountInfo.source,
            fullResponse: accountInfo
          })
          
          if (accountInfo.error) {
            if (accountInfo.error.includes('timeout') || accountInfo.error.includes('Timeout')) {
              logger.error('⏱️ MT5 Bridge timeout - EA may not be processing command files. Check:')
              logger.error('   1. EA is attached to a chart')
              logger.error('   2. EA logs show "✅ Found command file" messages')
              logger.error('   3. Command files exist in mt5-commands directory')
            } else {
              logger.error('❌ MT5 Bridge error:', accountInfo.error)
            }
          } else if (!accountInfo.success) {
            logger.error('❌ Account info request failed. Check bridge logs for details.')
          }
          // Don't set fake balance - keep at 0 until MT5 connects
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
    setIsLoadingTrades(true)
    try {
      console.log('🔄 Starting trade sync...')
      
      // Fetch both closed and open positions with timeout handling
      let closedData: any = { success: false, positions: [] }
      let openPositionsData: any = { success: false, positions: [] }
      
      // Try closed positions endpoint first
      try {
        console.log('📥 Fetching closed positions...')
        const closedResponse = await fetch(getBridgeUrl('/closed-positions'), {
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
        setTrades(storedTrades)
        logger.info(`✅ Loaded ${storedTrades.length} trades from cache as fallback`)
      }
    } finally {
      setIsLoadingTrades(false)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const shortcuts = [
      { key: '1', handler: () => setActiveTab('overview'), description: 'Go to Overview' },
      { key: '2', handler: () => setActiveTab('trade'), description: 'Go to Trade' },
      { key: '3', handler: () => setActiveTab('opportunities'), description: 'Go to Opportunities' },
      { key: '4', handler: () => setActiveTab('analysis'), description: 'Go to AI Analysis' },
      { key: '5', handler: () => setActiveTab('smartscore'), description: 'Go to Smart Score' },
      { key: '6', handler: () => setActiveTab('tradeanalysis'), description: 'Go to Trade Analysis' },
      { key: '7', handler: () => setActiveTab('performance'), description: 'Go to Performance' },
      { key: '8', handler: () => setActiveTab('executionlog'), description: 'Go to Execution Log' },
      { key: '9', handler: () => setActiveTab('settings'), description: 'Go to Settings' },
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
    // Load immediately
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
      onClick: () => setActiveTab('opportunities'),
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

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: '📊', shortLabel: 'Overview' },
    { id: 'trade' as TabType, label: 'Trade', icon: '💹', shortLabel: 'Trade' },
    { id: 'opportunities' as TabType, label: 'Opportunities', icon: '🔍', shortLabel: 'Scan' },
    { id: 'analysis' as TabType, label: 'AI Analysis', icon: '🤖', shortLabel: 'AI' },
    { id: 'smartscore' as TabType, label: 'Smart Score', icon: '🎯', shortLabel: 'Score' },
    { id: 'tradeanalysis' as TabType, label: 'Trade Analysis', icon: '📊', shortLabel: 'Analysis' },
    { id: 'performance' as TabType, label: 'Performance', icon: '📈', shortLabel: 'Perf' },
    { id: 'executionlog' as TabType, label: 'Execution Log', icon: '📝', shortLabel: 'Log' },
    { id: 'settings' as TabType, label: 'Settings', icon: '⚙️', shortLabel: 'Settings' },
  ]

  // Authentication check - redirect to login if not authenticated
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      // Not authenticated, redirect to login page
      router.push('/')
    }
  }, [user, authLoading, router])

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Show loading state while redirecting (if not authenticated)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0e17] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="text-gray-400">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0e17] text-white flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-[#0d1321] border-r border-[#1e2738] transition-all duration-300 ${
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
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`lg:hidden fixed left-0 top-0 h-full bg-[#0d1321] border-r border-[#1e2738] z-50 transition-transform duration-300 ease-in-out ${
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
        {/* Header */}
        <header className="bg-[#0d1321] border-b border-[#1e2738] sticky top-0 z-30">
          <div className="px-2 sm:px-4 lg:px-6">
            <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
              {/* Left Side: Logo & Hamburger */}
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e2738] transition-all touch-manipulation"
                  aria-label="Open menu"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {/* Brand Logo - Smaller on mobile */}
                <div className="flex items-center">
                  <div className="relative">
                    <img 
                      src="/logo.png" 
                      alt="TradeIntel AI Logo" 
                      className="h-8 w-8 sm:h-10 sm:w-10 md:h-14 md:w-14 object-contain"
                      onError={(e) => {
                        // Fallback to text logo if image not found
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="h-8 w-8 sm:h-10 sm:w-10 md:h-14 md:w-14 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-sm sm:text-lg md:text-xl shadow-lg shadow-cyan-500/20 hidden" style={{display: 'none'}}>
                      TI
                    </div>
                  </div>
                </div>
              </div>

              {/* Breadcrumbs - Hidden on mobile */}
              <div className="hidden md:block flex-1 px-4">
                <Breadcrumbs items={getBreadcrumbs()} />
              </div>

              {/* Spacer for desktop when breadcrumbs hidden */}
              <div className="hidden md:hidden lg:block flex-1" />

              {/* Right Side - Optimized for mobile */}
              <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0">
                {/* Trading Session Indicator - Hidden on small screens */}
                <div className={`hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
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
                
                {/* UK Time - Hidden on small screens */}
                <div className="hidden md:flex items-center text-sm text-gray-400">
                  <span className="text-gray-600 mr-1">UK</span>
                  <span className="font-mono font-medium text-white">
                    {currentTime.toLocaleTimeString('en-GB', { 
                      timeZone: 'Europe/London',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                {/* System Status */}
                <SystemStatus />

                {/* Quick Actions Menu - Hidden on mobile */}
                <div className="hidden lg:block">
                  <QuickActionsMenu actions={quickActions} />
                </div>

                {/* Fullscreen Toggle - Hidden on mobile */}
                <button
                  onClick={toggleFullscreen}
                  className="hidden md:block p-2 rounded-lg bg-[#141c2b] text-gray-400 hover:text-white hover:bg-[#1e2738] transition-all"
                  title={isFullscreen ? 'Exit Fullscreen (Ctrl+F)' : 'Enter Fullscreen (Ctrl+F)'}
                >
                  {isFullscreen ? (
                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  )}
                </button>

                {/* AuthButton - Simplified on mobile */}
                <AuthButton />

                {/* AccountSelector - Simplified on mobile */}
                <AccountSelector />

                {/* TradingModeSwitch - Simplified on mobile */}
                <TradingModeSwitch />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
              {/* Top Stats Bar - Always Visible */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-5 lg:mb-6">
          {/* Balance */}
          {isLoadingBalance ? (
            <LoadingSkeleton type="metric" />
          ) : (
            <MetricTooltip
              metric="Balance"
              description="Your account balance is the total amount of funds available in your trading account."
            >
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-3 sm:p-4 cursor-help touch-manipulation">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Balance</p>
                <p className="text-lg sm:text-xl font-bold text-white font-mono break-words">
                  {TradingModeManager.getCurrencySymbol()}{account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </MetricTooltip>
          )}

          {/* Equity */}
          {isLoadingBalance ? (
            <LoadingSkeleton type="metric" />
          ) : (
            <MetricTooltip
              metric="Equity"
              description="Equity is your account balance plus the unrealized profit/loss from all open positions."
            >
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-3 sm:p-4 cursor-help touch-manipulation">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Equity</p>
                <p className="text-lg sm:text-xl font-bold text-white font-mono break-words">
                  {TradingModeManager.getCurrencySymbol()}{account.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </MetricTooltip>
          )}

                {/* Daily P/L (Realized) */}
                {isLoadingTrades ? (
                  <LoadingSkeleton type="metric" />
                ) : (
                  <MetricTooltip
                    metric="Daily P/L (Realized)"
                    description="Profit or loss from trades closed today. This is realized profit/loss, not including open positions."
                  >
                    <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-3 sm:p-4 cursor-help touch-manipulation">
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Daily P/L</p>
                      <p className={`text-lg sm:text-xl font-bold font-mono break-words ${
                        account.dailyProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {account.dailyProfitLoss >= 0 ? '+' : ''}{TradingModeManager.getCurrencySymbol()}{account.dailyProfitLoss.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-0.5">Realized (closed today)</p>
                    </div>
                  </MetricTooltip>
                )}

                {/* Unrealized P/L */}
                {isLoadingBalance ? (
                  <LoadingSkeleton type="metric" />
                ) : (
                  <MetricTooltip
                    metric="Unrealized P/L"
                    description="Current profit or loss from all open positions. This changes with market movements and becomes realized when positions are closed."
                  >
                    <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-3 sm:p-4 cursor-help touch-manipulation">
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Unrealized P/L</p>
                      <p className={`text-lg sm:text-xl font-bold font-mono break-words ${
                        (account.unrealizedPL || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {(account.unrealizedPL || 0) >= 0 ? '+' : ''}{TradingModeManager.getCurrencySymbol()}{(account.unrealizedPL || 0).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-0.5">Open positions</p>
                    </div>
                  </MetricTooltip>
                )}

          {/* Open Trades */}
          {isLoadingBalance ? (
            <LoadingSkeleton type="metric" />
          ) : (
            <MetricTooltip
              metric="Open Trades"
              description="Number of currently open positions in your account."
            >
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-3 sm:p-4 cursor-help touch-manipulation">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Open Trades</p>
                <p className="text-lg sm:text-xl font-bold text-cyan-400 font-mono">{account.openTrades}</p>
              </div>
            </MetricTooltip>
          )}

          {/* Monthly P/L */}
          {isLoadingBalance ? (
            <LoadingSkeleton type="metric" />
          ) : (
            <MetricTooltip
              metric="Monthly P/L"
              description="Total profit or loss from all trades closed this month."
            >
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-3 sm:p-4 cursor-help touch-manipulation">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Monthly P/L</p>
                <p className={`text-lg sm:text-xl font-bold font-mono break-words ${
                  account.monthlyProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {account.monthlyProfitLoss >= 0 ? '+' : ''}{TradingModeManager.getCurrencySymbol()}{account.monthlyProfitLoss.toFixed(2)}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">This month</p>
              </div>
            </MetricTooltip>
          )}

          {/* All Time P/L */}
          {isLoadingBalance ? (
            <LoadingSkeleton type="metric" />
          ) : (
            <MetricTooltip
              metric="All Time P/L"
              description="Total profit or loss from all closed trades (net of commissions and swap fees). This is your cumulative trading performance."
            >
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-4 cursor-help">
                <p className="text-xs text-gray-500 mb-1">All Time P/L</p>
                <p className={`text-xl font-bold font-mono ${
                  (account.allTimeProfitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {(account.allTimeProfitLoss || 0) >= 0 ? '+' : ''}{TradingModeManager.getCurrencySymbol()}{(account.allTimeProfitLoss || 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">Total closed trades</p>
              </div>
            </MetricTooltip>
          )}

          {/* Sync Button */}
          <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-4 flex items-center justify-center">
            <button
              onClick={syncTrades}
              disabled={isLoadingTrades}
              className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
              title="Sync trades from MT5"
            >
              {isLoadingTrades ? (
                <>
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <span>↻</span>
                  <span>Sync Trades</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Trading Hours Card */}
              <div className={`rounded-xl border p-5 ${
                tradingHours.quality === 'PRIME' ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30' :
                tradingHours.quality === 'GOOD' ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/30' :
                tradingHours.quality === 'AVERAGE' ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30' :
                'bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <span>🕐</span> Trading Session
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    tradingHours.quality === 'PRIME' ? 'bg-green-500/20 text-green-400' :
                    tradingHours.quality === 'GOOD' ? 'bg-cyan-500/20 text-cyan-400' :
                    tradingHours.quality === 'AVERAGE' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {tradingHours.quality}
                  </span>
                </div>
                <p className="text-gray-300 mb-2">{tradingHours.recommendation}</p>
                {tradingHours.bestPairsNow.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-xs text-gray-500">Best pairs now:</span>
                    {tradingHours.bestPairsNow.slice(0, 5).map(pair => (
                      <span key={pair} className="px-2 py-0.5 bg-white/5 rounded text-xs text-cyan-400">{pair}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick AI Summary */}
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <span>🤖</span> AI Recommendation
                  </h3>
                  <button 
                    onClick={() => setActiveTab('analysis')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    View Full Analysis →
                  </button>
                </div>
                {aiAnalysis ? (
                  <div className="flex items-center gap-6">
                    <div className={`text-4xl font-bold ${
                      aiAnalysis.recommendation?.includes('BUY') ? 'text-emerald-400' :
                      aiAnalysis.recommendation?.includes('SELL') ? 'text-rose-400' :
                      'text-yellow-400'
                    }`}>
                      {aiAnalysis.recommendation || 'HOLD'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-500 text-sm">Confidence</span>
                        <div className="flex-1 h-2 bg-[#1e2738] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                            style={{ width: `${aiAnalysis.confidence || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono text-cyan-400">{aiAnalysis.confidence || 0}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm">Score</span>
                        <div className="flex-1 h-2 bg-[#1e2738] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                            style={{ width: `${aiAnalysis.overallScore || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono text-purple-400">{aiAnalysis.overallScore || 0}/100</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">Loading AI analysis...</p>
                )}
              </div>

              {/* Quick Trade Button */}
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/30 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold mb-1">Ready to Trade?</h3>
                    <p className="text-gray-400 text-sm">Execute trades with AI-powered risk management</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('trade')}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    Open Trade Panel →
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-6">
              {/* Trade Sync Status Warning */}
              {isLoadingTrades ? (
                <LoadingSkeleton type="card" />
              ) : trades.length === 0 ? (
                <EmptyState
                  icon="📊"
                  title="No Trades Found"
                  description="Click 'Sync Trades' above to load trades from MT5. If sync fails, ensure the MT5 EA is attached to a chart and the Python bridge is running on port 8080."
                  action={{
                    label: '↻ Sync Trades',
                    onClick: syncTrades,
                  }}
                />
              ) : null}

              {/* Account Overview */}
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-5">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>💰</span> Account
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
                    <span className="text-gray-400">Balance</span>
                    <span className="font-mono font-bold">{TradingModeManager.getCurrencySymbol()}{account.balance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
                    <span className="text-gray-400">Equity</span>
                    <span className="font-mono font-bold">{TradingModeManager.getCurrencySymbol()}{account.equity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
                    <span className="text-gray-400">Daily P/L</span>
                    <span className={`font-mono font-bold ${account.dailyProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {account.dailyProfitLoss >= 0 ? '+' : ''}{TradingModeManager.getCurrencySymbol()}{account.dailyProfitLoss.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
                    <span className="text-gray-400">Unrealized P/L</span>
                    <span className={`font-mono font-bold ${(account.unrealizedPL || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {(account.unrealizedPL || 0) >= 0 ? '+' : ''}{TradingModeManager.getCurrencySymbol()}{(account.unrealizedPL || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400">Monthly P/L</span>
                    <span className={`font-mono font-bold ${account.monthlyProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {account.monthlyProfitLoss >= 0 ? '+' : ''}{TradingModeManager.getCurrencySymbol()}{account.monthlyProfitLoss.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-[#1e2738]">
                    <span className="text-gray-400">All Time P/L</span>
                    <span className={`font-mono font-bold ${(account.allTimeProfitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {(account.allTimeProfitLoss || 0) >= 0 ? '+' : ''}{TradingModeManager.getCurrencySymbol()}{(account.allTimeProfitLoss || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trading Rules */}
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-5">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>⚖️</span> Trading Rules
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-2 px-3 bg-[#141c2b] rounded-lg">
                    <span className="text-gray-400">Risk per Trade</span>
                    <span className="font-bold text-cyan-400">{(TRADING_RULES.RISK_PERCENTAGE * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-[#141c2b] rounded-lg">
                    <span className="text-gray-400">Reward:Risk</span>
                    <span className="font-bold text-cyan-400">1:{TRADING_RULES.MIN_REWARD_RISK_RATIO}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-[#141c2b] rounded-lg">
                    <span className="text-gray-400">Daily Loss Limit</span>
                    <span className="font-bold text-rose-400">{(TRADING_RULES.DAILY_LOSS_PERCENT * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-[#141c2b] rounded-lg">
                    <span className="text-gray-400">Max Trades/Day</span>
                    <span className="font-bold text-white">{TRADING_RULES.MAX_TRADES_PER_DAY}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-[#141c2b] rounded-lg">
                    <span className="text-gray-400">Max Open Trades</span>
                    <span className="font-bold text-white">{TRADING_RULES.MAX_OPEN_TRADES}</span>
                  </div>
                </div>
              </div>

              {/* Account Selector */}
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
                <AccountSelector />
              </div>

              {/* Risk Monitor */}
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
                <RiskMonitor 
                  dailyProfitLoss={account.dailyProfitLoss}
                  openTrades={account.openTrades}
                  tradesToday={account.tradesToday}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trade' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
                <TradePanel aiAnalysis={aiAnalysis} />
              </div>
            </div>
            <div className="space-y-6">
              {/* AI Quick Summary */}
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-5">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>🤖</span> AI Summary
                </h3>
                {aiAnalysis ? (
                  <div className="space-y-4">
                    <div className={`text-center py-4 rounded-xl ${
                      aiAnalysis.recommendation?.includes('BUY') ? 'bg-emerald-500/10 border border-emerald-500/30' :
                      aiAnalysis.recommendation?.includes('SELL') ? 'bg-rose-500/10 border border-rose-500/30' :
                      'bg-yellow-500/10 border border-yellow-500/30'
                    }`}>
                      <p className="text-2xl font-bold">{aiAnalysis.recommendation || 'HOLD'}</p>
                      <p className="text-sm text-gray-400">{aiAnalysis.confidence}% confidence</p>
                    </div>
                    {aiAnalysis.reasoning?.slice(0, 3).map((reason: string, i: number) => (
                      <p key={i} className="text-sm text-gray-400 flex items-start gap-2">
                        <span className="text-cyan-400">•</span> {reason}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Loading...</p>
                )}
              </div>

              {/* Risk Monitor */}
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
                <RiskMonitor 
                  dailyProfitLoss={account.dailyProfitLoss}
                  openTrades={account.openTrades}
                  tradesToday={account.tradesToday}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
            <AITradingDashboard onAnalysisChange={setAiAnalysis} />
          </div>
        )}

        {activeTab === 'smartscore' && (
          <SmartScoreCard analysis={aiAnalysis} symbol={aiAnalysis?.symbol || 'EURUSD'} />
        )}

        {activeTab === 'tradeanalysis' && (
          <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
            <TradeAnalysisDashboard />
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
            <OpportunityScanner />
          </div>
        )}

        {activeTab === 'executionlog' && (
          <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
            <TradeExecutionLog />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
            <Settings />
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
                <div className="p-4 border-b border-[#1e2738] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {trades.length > 0 ? `${trades.length} trades loaded` : 'No trades found'}
                    </span>
                  </div>
                  <button
                    onClick={syncTrades}
                    disabled={isLoadingTrades}
                    className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/30 transition-all disabled:opacity-50"
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
            <div className="space-y-6">
              {/* Demo Success Requirements */}
              {TradingModeManager.isDemoMode() && (
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/30 p-5">
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

              {/* Account Stats */}
              <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-5">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>📊</span> Statistics
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
                    <span className="text-gray-400">Total Trades</span>
                    <span className="font-mono font-bold">{account.totalTrades}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
                    <span className="text-gray-400">Trades Today</span>
                    <span className="font-mono font-bold">{account.tradesToday}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400">Open Positions</span>
                    <span className="font-mono font-bold text-cyan-400">{account.openTrades}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        </main>
      </div>
    </div>
    </ErrorBoundary>
  )
}
