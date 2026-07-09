'use client';

import { useState, useEffect } from 'react';
import { gatedEngineAdapter } from '@/lib/gated-engine-adapter';
import { executeGatedTrade } from '@/lib/execute-gated-trade';
import { ApproveExecuteSheet } from '@/components/ApproveExecuteSheet';
import { saveScanResultsForAlerts } from '@/components/MobileAlertsPanel';
import { useTradingContext } from '@/context/TradingContext';
import { TRADING_RULES } from '@/config/trading-rules';
import { TradingHoursFilter } from '@/lib/trading-hours';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { BridgePresenceBanner } from '@/components/BridgePresenceBanner';
import { ActiveAccountBanner, useActiveMt5AccountLogin, EXECUTE_ACCOUNT_TOOLTIP } from '@/components/ActiveAccountBanner';
import { TradeVerdictBanner } from '@/components/TradeVerdictBanner';
import {
  getAutoScanEnabled,
  setAutoScanEnabled,
  getScanIntervalMinutes,
  migrateScanSettingsToManual,
} from '@/lib/trading-settings';
import {
  isScannerExecutableOpportunity,
  SCANNER_MIN_CONFIDENCE_GATE,
} from '@/lib/scanner-executable';
import { getChartVisionCache } from '@/lib/chart-vision-cache';
// API keys are now managed server-side via environment variables

interface OpportunityScannerProps {
  onNavigateToTrade?: (symbol: string) => void;
}

interface Opportunity {
  symbol: string;
  score: number;
  confidence: number;
  recommendation: string;
  technicalScore: number;
  fundamentalScore: number;
  sentimentScore: number;
  riskLevel: string;
  strength: number;
  executionPermitted: boolean;
  executionBlockedBy: string[];
  marketReadabilityReason?: string;
  marketReadable?: boolean;
  gate1Inputs?: {
    trendStrength: number;
    patternConfidence: number;
    hasSupportResistance: boolean;
    hasStrongTrend: boolean;
    hasStrongPattern: boolean;
  };
  dataHealth?: {
    ohlcBars: number;
    ohlcSource: 'mt5' | 'twelvedata';
    technicalUsedFallback: boolean;
    analysisMode: 'scan' | 'trade';
    usedOhlcStructure: boolean;
    usedChartVision: boolean;
  };
}

interface ScanHealthSummary {
  pairCount: number;
  ohlcSourceMt5: number;
  ohlcSourceTwelveData: number;
  technicalFallbackCount: number;
  ohlcStructureCount: number;
  chartVisionCount: number;
  gate1ReadableCount: number;
  withChart: boolean;
}

function formatPairBlockReason(opp: Opportunity): string {
  if (!opp.executionPermitted && opp.marketReadabilityReason) {
    return opp.marketReadabilityReason;
  }
  if (opp.executionBlockedBy.length > 0) {
    return opp.executionBlockedBy.slice(0, 2).join('; ');
  }
  if (opp.recommendation === 'HOLD') {
    return 'HOLD — no directional setup';
  }
  return 'Gate 4 not passed';
}

export function OpportunityScanner({ onNavigateToTrade }: OpportunityScannerProps) {
  const { setSymbol, setAiAnalysis } = useTradingContext();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [quickExecuting, setQuickExecuting] = useState<string | null>(null);
  const [quickExecuteMessage, setQuickExecuteMessage] = useState<{
    symbol: string;
    success: boolean;
    text: string;
  } | null>(null);
  const [executeSheet, setExecuteSheet] = useState<{
    displaySymbol: string;
    sym: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [tradingHours, setTradingHours] = useState(TradingHoursFilter.analyze());
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [autoScanEnabled, setAutoScanEnabledState] = useState(false);
  const [scanCountdown, setScanCountdown] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [isClient, setIsClient] = useState(false);
  const [activeAlert, setActiveAlert] = useState<Opportunity[] | null>(null);
  const [alarmAcknowledged, setAlarmAcknowledged] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [alarmInterval, setAlarmInterval] = useState<NodeJS.Timeout | null>(null);
  const [apiKeyIssues, setApiKeyIssues] = useState<{ finnhub: number; newsdata: number }>({ finnhub: 0, newsdata: 0 });
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [showPairSelector, setShowPairSelector] = useState(false);
  const [showApiKeyDiagnostics, setShowApiKeyDiagnostics] = useState(false);
  const [testingKeys, setTestingKeys] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; status?: number; error?: string }>>({});
  const [scanHealth, setScanHealth] = useState<ScanHealthSummary | null>(null);
  const [lastScanUsedChart, setLastScanUsedChart] = useState(false);
  const activeMt5Login = useActiveMt5AccountLogin();
  const canExecuteToMt5 = activeMt5Login != null;

  // Executable opportunities: same rules as Trade tab validateGatedExecution (gate path)
  const isExecutableOpportunity = isScannerExecutableOpportunity;

  const openInTrade = (displaySymbol: string) => {
    const sym = displaySymbol.replace('/', '');
    const cached = gatedEngineAdapter.getCachedAnalysis(sym);
    setSymbol(sym);
    if (cached) setAiAnalysis(cached);
    onNavigateToTrade?.(sym);
  };

  const quickExecute = async (displaySymbol: string) => {
    if (!canExecuteToMt5) {
      setQuickExecuteMessage({
        symbol: displaySymbol,
        success: false,
        text: EXECUTE_ACCOUNT_TOOLTIP,
      });
      setTimeout(() => setQuickExecuteMessage(null), 8000);
      return;
    }
    const sym = displaySymbol.replace('/', '');
    const cached = gatedEngineAdapter.getCachedAnalysis(sym);
    if (!cached) {
      setQuickExecuteMessage({
        symbol: displaySymbol,
        success: false,
        text: 'No cached analysis — scan again first',
      });
      return;
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    if (isMobile) {
      setExecuteSheet({ displaySymbol, sym });
      return;
    }
    if (
      !window.confirm(
        `Execute ${cached.recommendation} on ${displaySymbol}?\n\nSL: ${cached.suggestedStopLoss}\nTP: ${cached.suggestedTakeProfit}\nLots: ${cached.suggestedPositionSize}`
      )
    ) {
      return;
    }
    setQuickExecuting(sym);
    setQuickExecuteMessage(null);
    const result = await executeGatedTrade({ symbol: sym, analysis: cached, source: 'ai' });
    setQuickExecuting(null);
    if (result.cancelled) return;
    setQuickExecuteMessage({
      symbol: displaySymbol,
      success: result.success,
      text: result.success
        ? (result.message as string) || 'Trade executed'
        : result.error || 'Execution failed',
    });
    setTimeout(() => setQuickExecuteMessage(null), 8000);
  };

  // Preset pair groups
  const MAJOR_PAIRS = [
    'EUR/USD',
    'GBP/USD',
    'USD/JPY',
    'USD/CHF',
    'AUD/USD',
    'USD/CAD',
    'NZD/USD',
    'XAU/USD',
  ];

  const ALL_PAIRS = TRADING_RULES.TRADING_PAIRS;

  // Load selected pairs from localStorage on mount
  useEffect(() => {
    if (isClient) {
      const saved = localStorage.getItem('opportunityScanner_selectedPairs');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedPairs(parsed);
          } else {
            // Default to major pairs if nothing saved
            setSelectedPairs(MAJOR_PAIRS);
            localStorage.setItem('opportunityScanner_selectedPairs', JSON.stringify(MAJOR_PAIRS));
          }
        } catch (e) {
          setSelectedPairs(MAJOR_PAIRS);
          localStorage.setItem('opportunityScanner_selectedPairs', JSON.stringify(MAJOR_PAIRS));
        }
      } else {
        // Default to major pairs
        setSelectedPairs(MAJOR_PAIRS);
        localStorage.setItem('opportunityScanner_selectedPairs', JSON.stringify(MAJOR_PAIRS));
      }
    }
  }, [isClient]);

  // Save selected pairs to localStorage when they change
  useEffect(() => {
    if (isClient && selectedPairs.length > 0) {
      localStorage.setItem('opportunityScanner_selectedPairs', JSON.stringify(selectedPairs));
    }
  }, [selectedPairs, isClient]);

  const scanAllPairs = async (withChart = false) => {
    if (isScanning) return; // Prevent multiple simultaneous scans
    const pairs = selectedPairs.length > 0 ? selectedPairs : TRADING_RULES.TRADING_PAIRS;

    if (withChart) {
      const cachedCount = pairs.filter((p) => getChartVisionCache(p.replace('/', ''))?.structure).length;
      const visionCalls = pairs.length - cachedCount;
      const ok = window.confirm(
        `Scan ${pairs.length} pairs with chart vision?\n\n` +
          `Estimated AI vision calls: ${visionCalls} (${cachedCount} may use Trade tab cache).\n` +
          `This uses API credits. Continue?`
      );
      if (!ok) return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setLastScanUsedChart(withChart);
    const results: Opportunity[] = [];
    const total = pairs.length;

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      try {
        const symbol = pair.replace('/', '');
        const cachedVision = getChartVisionCache(symbol);
        const analysis = await gatedEngineAdapter.analyzeMarket(symbol, [], undefined, {
          mode: 'scan',
          precomputedGptStructure: cachedVision?.structure,
          generateChartFromOhlc: withChart && !cachedVision?.structure,
        });
        
        const strength = analysis.overallScore * (analysis.confidence / 100);
        const executionPermitted = analysis.gateStatus?.executionPermitted ?? false;
        
        results.push({
          symbol: pair,
          score: analysis.overallScore,
          confidence: analysis.confidence,
          recommendation: analysis.recommendation,
          technicalScore: analysis.technicalScore,
          fundamentalScore: analysis.fundamentalScore,
          sentimentScore: analysis.sentimentScore,
          riskLevel: analysis.riskLevel,
          strength,
          executionPermitted,
          executionBlockedBy: analysis.gateStatus?.executionBlockedBy ?? [],
          marketReadabilityReason: analysis.gateStatus?.marketReadabilityReason,
          marketReadable: analysis.gateStatus?.marketReadable,
          gate1Inputs: analysis.gateStatus?.gate1Inputs,
          dataHealth: analysis.dataHealth,
        });
        
        setScanProgress(Math.round(((i + 1) / total) * 100));
        
        // Increased delay to avoid rate limits (1 second between pairs)
        await new Promise(resolve => setTimeout(resolve, withChart ? 1500 : 1000));
      } catch (error) {
        console.error(`Error analyzing ${pair}:`, error);
        setScanProgress(Math.round(((i + 1) / total) * 100));
      }
    }

    // Sort by strength (score * confidence)
    results.sort((a, b) => b.strength - a.strength);
    setOpportunities(results);

    setScanHealth({
      pairCount: results.length,
      ohlcSourceMt5: results.filter((r) => r.dataHealth?.ohlcSource === 'mt5').length,
      ohlcSourceTwelveData: results.filter((r) => r.dataHealth?.ohlcSource === 'twelvedata').length,
      technicalFallbackCount: results.filter((r) => r.dataHealth?.technicalUsedFallback).length,
      ohlcStructureCount: results.filter((r) => r.dataHealth?.usedOhlcStructure).length,
      chartVisionCount: results.filter((r) => r.dataHealth?.usedChartVision).length,
      gate1ReadableCount: results.filter((r) => r.marketReadable).length,
      withChart,
    });
    saveScanResultsForAlerts(
      results.map((r) => ({
        symbol: r.symbol,
        recommendation: r.recommendation,
        score: r.score,
        executionPermitted: r.executionPermitted,
      }))
    );
    setIsScanning(false);
    setLastScanTime(new Date());
    setTradingHours(TradingHoursFilter.analyze());
    
    // Check if we found strong signals and show notification
    const strongSignals = results.filter(isExecutableOpportunity);
    
    if (typeof window !== 'undefined') {
      console.log('🔔 Notification check:', {
        strongSignalsCount: strongSignals.length,
        hasNotificationAPI: 'Notification' in window,
        permission: 'Notification' in window ? Notification.permission : 'N/A',
        topSignal: strongSignals.length > 0 ? {
          symbol: strongSignals[0].symbol,
          score: strongSignals[0].score,
          confidence: strongSignals[0].confidence
        } : null
      });
    }
    
    // Trigger alert system for strong signals
    if (strongSignals.length > 0) {
      // Set active alert (will trigger sound and persistent banner)
      setActiveAlert(strongSignals);
      setAlarmAcknowledged(false);
      
      // Send browser notification
      if (typeof window !== 'undefined') {
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            try {
              const notification = new Notification(`🎯 ${strongSignals.length} Strong Signal${strongSignals.length > 1 ? 's' : ''} Found!`, {
                body: `Top opportunity: ${strongSignals[0].symbol} - ${strongSignals[0].recommendation} (Score: ${strongSignals[0].score}, Confidence: ${strongSignals[0].confidence}%)`,
                icon: '/logo.png',
                tag: 'trading-signal',
                requireInteraction: true, // Changed to true for better visibility
              });
              console.log('✅ Notification sent:', notification);
              setNotificationPermission('granted');
            } catch (error) {
              console.error('❌ Error creating notification:', error);
            }
          } else if (Notification.permission === 'default') {
            console.log('⚠️ Notification permission not yet requested');
            setNotificationPermission('default');
          } else {
            console.log('❌ Notification permission denied');
            setNotificationPermission('denied');
          }
        } else {
          console.log('❌ Browser does not support notifications');
        }
      }
    } else {
      // No strong signals - clear any active alerts
      setActiveAlert(null);
      setAlarmAcknowledged(false);
      console.log('ℹ️ No strong signals found, no notification sent');
    }
  };
  
  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
    migrateScanSettingsToManual();
    setAutoScanEnabledState(getAutoScanEnabled());

    const onScanSettingsChanged = () => setAutoScanEnabledState(getAutoScanEnabled());
    window.addEventListener('scan-settings-changed', onScanSettingsChanged);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    
    // Initialize audio context for alarm sounds
    if (typeof window !== 'undefined' && typeof AudioContext !== 'undefined') {
      const ctx = new AudioContext();
      setAudioContext(ctx);
    }
    
    return () => {
      window.removeEventListener('scan-settings-changed', onScanSettingsChanged);
      // Cleanup: stop any playing alarms
      if (alarmInterval) {
        clearInterval(alarmInterval);
      }
    };
  }, []);
  
  // Play continuous alarm sound when strong signals are found
  useEffect(() => {
    if (!isClient) return;
    
    // Cleanup function
    return () => {
      if (alarmInterval) {
        clearInterval(alarmInterval);
        setAlarmInterval(null);
      }
    };
  }, [isClient]);
  
  useEffect(() => {
    if (!isClient) return;
    
    // Stop any existing alarm
    if (alarmInterval) {
      clearInterval(alarmInterval);
      setAlarmInterval(null);
    }
    
    if (activeAlert && activeAlert.length > 0 && !alarmAcknowledged) {
      // Play alarm sound continuously
      const playAlarm = () => {
        try {
          // Try Web Audio API first
          if (audioContext && audioContext.state !== 'closed') {
            // Resume audio context if suspended (browser requires user interaction)
            if (audioContext.state === 'suspended') {
              audioContext.resume().catch(err => {
                console.warn('Could not resume audio context:', err);
              });
            }
            
            // Create a beep sound using Web Audio API
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800; // Higher pitch for urgency
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
          } else {
            // Fallback: Just log the alert
            console.log('🔔 ALARM: Strong signal detected!');
          }
        } catch (error) {
          console.error('Error playing alarm:', error);
          // Fallback: Just log the alert
          console.log('🔔 ALARM: Strong signal detected!');
        }
      };
      
      // Play alarm immediately
      playAlarm();
      
      // Play alarm every 2 seconds
      const interval = setInterval(() => {
        playAlarm();
      }, 2000);
      
      setAlarmInterval(interval);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [activeAlert, alarmAcknowledged, isClient, audioContext]);
  
  // Handle acknowledge button
  const acknowledgeAlert = () => {
    setAlarmAcknowledged(true);
    if (alarmInterval) {
      clearInterval(alarmInterval);
      setAlarmInterval(null);
    }
    console.log('✅ Alert acknowledged - alarm stopped');
  };

  // Auto-scan functionality
  useEffect(() => {
    if (!autoScanEnabled || !isClient) {
      setScanCountdown(0);
      return;
    }
    
    // Request notification permission on first load
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        console.log('🔔 Requesting notification permission...');
        Notification.requestPermission().then(permission => {
          console.log('🔔 Notification permission:', permission);
          setNotificationPermission(permission);
          if (permission === 'granted') {
            // Test notification
            try {
              new Notification('🎯 TradeIntel AI', {
                body: 'Notifications enabled! You will be alerted when strong signals are found.',
                icon: '/logo.png',
                tag: 'permission-granted',
              });
            } catch (error) {
              console.error('Error sending test notification:', error);
            }
          }
        }).catch(error => {
          console.error('Error requesting notification permission:', error);
        });
      } else {
        console.log('🔔 Notification permission status:', Notification.permission);
        setNotificationPermission(Notification.permission);
      }
    } else {
      console.log('❌ Browser does not support notifications');
    }
    
    // Determine scan interval from saved settings (minutes → ms)
    const getScanInterval = () => {
      const minutes = getScanIntervalMinutes();
      return minutes * 60 * 1000;
    };
    
    // No automatic scan on mount — user must click Scan Now
    const interval = getScanInterval();
    
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setScanCountdown(prev => {
        if (prev <= 1) {
          if (!isScanning) {
            scanAllPairs();
          }
          const newInterval = getScanInterval();
          return newInterval / 1000;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Auto-scan interval
    const scanInterval = setInterval(() => {
      if (!isScanning) {
        scanAllPairs();
      }
    }, interval);
    
    // Initialize countdown
    setScanCountdown(interval / 1000);
    
    // API keys are now managed server-side
    // No need to check failures client-side
    
    return () => {
      clearInterval(scanInterval);
      clearInterval(countdownInterval);
    };
  }, [autoScanEnabled, selectedPairs]);

  const validOpportunities = opportunities.filter(isExecutableOpportunity);

  const bestOpportunity = validOpportunities[0];

  const nearMissOpportunities = [...opportunities]
    .filter((o) => !isExecutableOpportunity(o))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  
  // Show alert banner when strong signals are found
  const hasStrongSignals = validOpportunities.length > 0;

  return (
    <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
      <div className="mb-4 space-y-3">
        <BridgePresenceBanner />
        <ActiveAccountBanner />
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">🎯 Opportunity Scanner</h2>
          <p className="text-sm text-gray-400">
            {autoScanEnabled ? (
              <>
                Auto-scanning {selectedPairs.length > 0 ? `${selectedPairs.length} selected pair${selectedPairs.length > 1 ? 's' : ''}` : 'all pairs'} every {getScanIntervalMinutes()} minutes
                {scanCountdown > 0 && (
                  <span className="ml-2 text-cyan-400">• Next scan in {Math.floor(scanCountdown / 60)}:{(scanCountdown % 60).toString().padStart(2, '0')}</span>
                )}
              </>
            ) : (
              <>Manual scan only — click <strong className="text-gray-300">Scan Now</strong> to analyze pairs (no AI calls until you click)</>
            )}
            {lastScanTime && (
              <span className="block text-xs text-gray-500 mt-1">
                Last scan: {lastScanTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                {' · '}
                {lastScanUsedChart ? 'with chart vision' : 'OHLC only (no vision credits)'}
                {' · '}
                Uses same gated engine as Trade tab (Signal vs Executable)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notification Permission Button */}
          {isClient && typeof window !== 'undefined' && 'Notification' in window && notificationPermission !== 'granted' && (
            <button
              onClick={async () => {
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
                  const permission = await Notification.requestPermission();
                  console.log('🔔 Permission result:', permission);
                  setNotificationPermission(permission);
                  if (permission === 'granted') {
                    // Test notification
                    new Notification('🎯 TradeIntel AI', {
                      body: 'Notifications enabled! You will be alerted when strong signals are found.',
                      icon: '/logo.png',
                      tag: 'permission-granted',
                    });
                  }
                }
              }}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
              title="Enable browser notifications"
            >
              🔔 Enable Notifications
            </button>
          )}
          {isClient && typeof window !== 'undefined' && 'Notification' in window && notificationPermission === 'granted' && (
            <div className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" title="Notifications enabled">
              ✅ Notifications On
            </div>
          )}
          <button
            onClick={() => setShowPairSelector(!showPairSelector)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
            title="Select currency pairs to scan"
          >
            📊 {selectedPairs.length > 0 ? `${selectedPairs.length} Pairs` : 'Select Pairs'}
          </button>
          <button
            onClick={() => {
              const next = !autoScanEnabled;
              setAutoScanEnabledState(next);
              setAutoScanEnabled(next);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              autoScanEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-gray-700 text-gray-400 border border-gray-600'
            }`}
            title={autoScanEnabled ? 'Auto-scan on (uses AI credits) — click to switch to manual' : 'Manual only — click to enable auto-scan in Setup'}
          >
            {autoScanEnabled ? '⏸️ Auto ON' : '▶️ Manual'}
          </button>
          <button
            onClick={() => void scanAllPairs(false)}
            disabled={isScanning}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isScanning && !lastScanUsedChart ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Scanning... {scanProgress}%
              </>
            ) : (
              <span>🔍 Scan Now</span>
            )}
          </button>
          <button
            onClick={() => void scanAllPairs(true)}
            disabled={isScanning}
            className="px-4 py-3 bg-[#141c2b] border border-purple-500/40 text-purple-300 rounded-lg font-medium hover:bg-purple-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            title="Uses AI vision API credits — one call per pair without Trade tab cache"
          >
            {isScanning && lastScanUsedChart ? `Chart scan… ${scanProgress}%` : '📈 Scan with chart'}
          </button>
        </div>
      </div>

      {/* CURRENCY PAIR SELECTOR */}
      {showPairSelector && (
        <div className="mb-4 bg-[#141c2b] border border-[#1e2738] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg">Select Currency Pairs to Scan</h3>
            <button
              onClick={() => setShowPairSelector(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => {
                setSelectedPairs(MAJOR_PAIRS);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                JSON.stringify(selectedPairs.sort()) === JSON.stringify(MAJOR_PAIRS.sort())
                  ? 'bg-cyan-500 text-white'
                  : 'bg-[#1e2738] text-gray-300 hover:bg-[#2a3441]'
              }`}
            >
              ⭐ Major Pairs ({MAJOR_PAIRS.length})
            </button>
            <button
              onClick={() => {
                 setSelectedPairs([...ALL_PAIRS]);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                JSON.stringify([...selectedPairs].sort()) === JSON.stringify([...ALL_PAIRS].sort())
                  ? 'bg-cyan-500 text-white'
                  : 'bg-[#1e2738] text-gray-300 hover:bg-[#2a3441]'
              }`}
            >
              🌐 All Pairs ({ALL_PAIRS.length})
            </button>
            <button
              onClick={() => {
                setSelectedPairs([]);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedPairs.length === 0
                  ? 'bg-cyan-500 text-white'
                  : 'bg-[#1e2738] text-gray-300 hover:bg-[#2a3441]'
              }`}
            >
              🎯 Custom ({selectedPairs.length})
            </button>
          </div>

          {/* Pair Selection Grid */}
          <div className="max-h-64 overflow-y-auto border border-[#1e2738] rounded-lg p-3 bg-[#0d1321]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {ALL_PAIRS.map((pair) => {
                const isSelected = selectedPairs.includes(pair);
                const isMajor = MAJOR_PAIRS.includes(pair);
                return (
                  <label
                    key={pair}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border border-cyan-500/50'
                        : 'bg-[#1e2738] border border-transparent hover:border-[#2a3441]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPairs([...selectedPairs, pair]);
                        } else {
                          setSelectedPairs(selectedPairs.filter(p => p !== pair));
                        }
                      }}
                      className="w-4 h-4 text-cyan-500 bg-[#0d1321] border-gray-600 rounded focus:ring-cyan-500"
                    />
                    <span className={`text-sm ${isSelected ? 'text-cyan-400 font-medium' : 'text-gray-400'}`}>
                      {pair}
                      {isMajor && <span className="ml-1 text-xs">⭐</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-300">
              <strong>💡 Tip:</strong> Selecting fewer pairs (e.g., Major Pairs only) allows faster 5-minute scans while staying within API rate limits. 
              {selectedPairs.length > 0 && selectedPairs.length < ALL_PAIRS.length && (
                <span className="block mt-1 text-green-400">
                  ✅ {selectedPairs.length} pairs selected - Using 5-minute scan intervals
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* API KEY WARNING BANNER */}
      {(apiKeyIssues.finnhub > 0 || apiKeyIssues.newsdata > 0) && (
        <div className="mb-4 bg-amber-500/20 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <h3 className="text-amber-400 font-bold mb-1">API Key Issues Detected</h3>
              <p className="text-sm text-gray-300 mb-2">
                Some external data providers are failing, which may reduce signal quality:
              </p>
              <ul className="text-sm text-gray-400 space-y-1 mb-3">
                {apiKeyIssues.finnhub > 0 && (
                  <li>• Finnhub.io: {apiKeyIssues.finnhub} failure{apiKeyIssues.finnhub > 1 ? 's' : ''} (Economic calendar data unavailable)</li>
                )}
                {apiKeyIssues.newsdata > 0 && (
                  <li>• NewsData.io: {apiKeyIssues.newsdata} failure{apiKeyIssues.newsdata > 1 ? 's' : ''} (News sentiment data unavailable)</li>
                )}
              </ul>
              <p className="text-xs text-gray-500 mb-3">
                <strong>Impact:</strong> The AI will rely more heavily on technical analysis. Strong signals may be less frequent without fundamental and sentiment data.
                <br />
                <strong>Fix:</strong> Check your API keys in environment variables (Vercel dashboard) or reduce scan frequency to avoid rate limits.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Note: API keys are managed server-side via environment variables for security.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* API KEY INFO */}
      {showApiKeyDiagnostics && (
        <div className="mb-4 bg-[#141c2b] border border-[#1e2738] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg">API Key Information</h3>
            <button
              onClick={() => setShowApiKeyDiagnostics(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-300 mb-2">
                <strong>API Keys are Managed Server-Side</strong>
              </p>
              <p className="text-xs text-blue-300 mb-2">
                For security, API keys are stored in environment variables on the server and are never exposed to the client.
              </p>
              <ul className="text-xs text-blue-300 space-y-1 list-disc list-inside mt-2">
                <li><strong>403 Forbidden:</strong> API key is invalid or expired. Update in Vercel environment variables.</li>
                <li><strong>429 Rate Limited:</strong> Too many requests. Wait or upgrade your API plan.</li>
                <li>Update keys in Vercel Dashboard → Settings → Environment Variables</li>
                <li>After updating, redeploy your application</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* In-app toast for strong signals */}
      {activeAlert && activeAlert.length > 0 && !alarmAcknowledged && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 p-4 rounded-xl border-2 border-amber-500/50 bg-gradient-to-r from-red-600/20 via-orange-500/20 to-red-600/20"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-white">
                Strong signal: {activeAlert[0].symbol} — {activeAlert[0].recommendation}
              </p>
              <p className="text-sm text-secondary">
                Score {activeAlert[0].score}, confidence {activeAlert[0].confidence}%
                {activeAlert.length > 1 ? ` (+${activeAlert.length - 1} more)` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={acknowledgeAlert}
              className="btn btn-primary min-h-[44px] shrink-0"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}


      {/* Strong Signals Found Banner */}
      {hasStrongSignals && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🎯</div>
            <div className="flex-1">
              <h3 className="text-emerald-400 font-bold text-lg">
                {validOpportunities.length} Strong Signal{validOpportunities.length > 1 ? 's' : ''} Found!
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Top opportunity: <span className="text-emerald-400 font-bold">{bestOpportunity.symbol}</span> - {bestOpportunity.recommendation} 
                (Score: {bestOpportunity.score}, Confidence: {bestOpportunity.confidence}%)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warning Banner */}
      {!hasStrongSignals && opportunities.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="text-amber-400 font-bold mb-2">No executable signals</h3>
              <p className="text-sm text-gray-400 mb-2">
                Scan completed — {opportunities.length} pair{opportunities.length > 1 ? 's' : ''} analyzed.
                Executable = Gate 4 passed, not HOLD, confidence ≥{SCANNER_MIN_CONFIDENCE_GATE}% (same as Trade tab).
              </p>
              {nearMissOpportunities.length > 0 && (
                <div className="mb-3 p-3 rounded-lg bg-[#141c2b] border border-[#1e2738]">
                  <p className="text-xs text-gray-500 mb-2">Closest to executable (by confidence):</p>
                  <ul className="text-sm text-gray-300 space-y-1.5">
                    {nearMissOpportunities.map((opp) => (
                      <li key={opp.symbol}>
                        <span className="text-white font-medium">{opp.symbol}</span>
                        {' — '}
                        {opp.recommendation}, {opp.confidence}% conf
                        <span className="text-amber-400/90">
                          {' '}
                          · {formatPairBlockReason(opp)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Prime session liquidity does not bypass Gate 4 — structure and bias must align</li>
                <li>See &quot;Blocked because&quot; column in the table below for each pair</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Scan health panel */}
      {scanHealth && opportunities.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-[#141c2b] border border-[#1e2738]">
          <h4 className="text-sm font-medium text-white mb-2">Scan data health</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-400">
            <div>
              <span className="text-gray-500">OHLC source</span>
              <p className="text-gray-200">
                MT5 {scanHealth.ohlcSourceMt5} · TwelveData {scanHealth.ohlcSourceTwelveData}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Gate 1 readable</span>
              <p className="text-gray-200">
                {scanHealth.gate1ReadableCount}/{scanHealth.pairCount} pairs
              </p>
            </div>
            <div>
              <span className="text-gray-500">Structure source</span>
              <p className="text-gray-200">
                {scanHealth.withChart
                  ? `Chart vision: ${scanHealth.chartVisionCount} pair(s)`
                  : `OHLC rules: ${scanHealth.ohlcStructureCount} pair(s)`}
              </p>
              {scanHealth.withChart && scanHealth.ohlcStructureCount === 0 && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Vision replaces OHLC structure path when chart scan is used
                </p>
              )}
            </div>
            <div>
              <span className="text-gray-500">Technical fallback</span>
              <p className={scanHealth.technicalFallbackCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                {scanHealth.technicalFallbackCount > 0
                  ? `${scanHealth.technicalFallbackCount} pairs (missing OHLC)`
                  : 'None — real indicator data'}
              </p>
            </div>
          </div>
          {scanHealth.withChart && scanHealth.chartVisionCount > 0 && (
            <p className="text-xs text-purple-300 mt-2">
              Chart vision fed Gate 1 on {scanHealth.chartVisionCount} pair(s) (uses API credits).
            </p>
          )}
        </div>
      )}

      {/* Trading Hours Status */}
      <div className={`mb-6 p-4 rounded-lg ${
        tradingHours.quality === 'PRIME' ? 'bg-green-500/10 border border-green-500/30' :
        tradingHours.quality === 'GOOD' ? 'bg-cyan-500/10 border border-cyan-500/30' :
        tradingHours.quality === 'AVERAGE' ? 'bg-yellow-500/10 border border-yellow-500/30' :
        'bg-red-500/10 border border-red-500/30'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2 h-2 rounded-full ${
            tradingHours.quality === 'PRIME' ? 'bg-green-400' :
            tradingHours.quality === 'GOOD' ? 'bg-cyan-400' :
            tradingHours.quality === 'AVERAGE' ? 'bg-yellow-400' :
            'bg-red-400'
          }`}></span>
          <span className="font-medium text-white">Current Session: {tradingHours.currentSession}</span>
          <span className={`text-xs px-2 py-1 rounded ${
            tradingHours.quality === 'PRIME' ? 'bg-green-500/20 text-green-400' :
            tradingHours.quality === 'GOOD' ? 'bg-cyan-500/20 text-cyan-400' :
            tradingHours.quality === 'AVERAGE' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {tradingHours.quality}
          </span>
        </div>
        <p className="text-sm text-gray-400">{tradingHours.recommendation}</p>
        {(tradingHours.quality === 'PRIME' || tradingHours.quality === 'GOOD') && (
          <p className="text-xs text-gray-500 mt-2">
            Prime liquidity does not bypass Gate 4 — signals still need clear structure, bias, and technical confirmation.
          </p>
        )}
      </div>

      {/* Best Opportunity */}
      {bestOpportunity && (
        <div className="mb-6 p-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">🏆 Top Opportunity</h3>
              <p className="text-sm text-gray-400">Strongest executable signal (Gate 4 passed)</p>
            </div>
            <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
              bestOpportunity.recommendation.includes('BUY') 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {bestOpportunity.recommendation}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Pair</p>
              <p className="text-lg font-bold text-white">{bestOpportunity.symbol}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Score</p>
              <p className="text-lg font-bold text-cyan-400">{bestOpportunity.score}/100</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Confidence</p>
              <p className="text-lg font-bold text-cyan-400">{bestOpportunity.confidence}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Strength</p>
              <p className="text-lg font-bold text-cyan-400">{bestOpportunity.strength.toFixed(1)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Technical</p>
              <p className="text-white font-medium">{bestOpportunity.technicalScore}/100</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Fundamental</p>
              <p className="text-white font-medium">{bestOpportunity.fundamentalScore}/100</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Sentiment</p>
              <p className="text-white font-medium">{bestOpportunity.sentimentScore}/100</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => openInTrade(bestOpportunity.symbol)}
              className="btn btn-secondary text-sm min-h-[40px]"
            >
              Open in Trade
            </button>
            {isExecutableOpportunity(bestOpportunity) && (
              <button
                type="button"
                onClick={() => void quickExecute(bestOpportunity.symbol)}
                disabled={
                  !canExecuteToMt5 ||
                  quickExecuting === bestOpportunity.symbol.replace('/', '')
                }
                title={!canExecuteToMt5 ? EXECUTE_ACCOUNT_TOOLTIP : undefined}
                className="btn btn-primary text-sm min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quickExecuting === bestOpportunity.symbol.replace('/', '')
                  ? 'Executing…'
                  : !canExecuteToMt5
                    ? 'Select MT5 account to execute'
                    : `Quick execute ${bestOpportunity.recommendation}`}
              </button>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[#1e2738]">
            <p className="text-xs text-gray-500 mb-2">⚠️ Remember: This is the BEST opportunity, but still:</p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Only risk 2% of your account ($1.91 on $95.55 balance)</li>
              <li>• Ensure stop loss and take profit are properly set</li>
              <li>• Trade objectively, not emotionally</li>
              <li>• This is NOT about recovering losses - it&apos;s about the next quality trade</li>
            </ul>
          </div>
        </div>
      )}

      {quickExecuteMessage && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            quickExecuteMessage.success
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {quickExecuteMessage.symbol}: {quickExecuteMessage.text}
        </div>
      )}

      {/* All Opportunities Table */}
      {opportunities.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4">
            All Opportunities ({validOpportunities.length} executable, {opportunities.length - validOpportunities.length} blocked or weak)
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e2738]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Pair</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Signal</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Executable</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Gate 1</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Blocked because</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Score</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Confidence</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Strength</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Risk</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp, index) => {
                  const isValid = isExecutableOpportunity(opp);
                  return (
                    <tr 
                      key={opp.symbol} 
                      className={`border-b border-[#1e2738] hover:bg-[#141c2b] transition-colors ${
                        isValid ? 'bg-green-500/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-white">{opp.symbol}</span>
                        <div className="mt-1">
                          <TradeVerdictBanner symbol={opp.symbol} compact />
                        </div>
                        {index === 0 && isValid && (
                          <span className="ml-2 text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">BEST</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          opp.recommendation.includes('BUY') 
                            ? 'bg-green-500/20 text-green-400' 
                            : opp.recommendation.includes('SELL')
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {opp.recommendation}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            opp.executionPermitted
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                          title={
                            opp.executionBlockedBy.length > 0
                              ? opp.executionBlockedBy.slice(0, 2).join('; ')
                              : undefined
                          }
                        >
                          {opp.executionPermitted ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-400">
                        {opp.gate1Inputs ? (
                          <div className="space-y-0.5">
                            <div>Trend {opp.gate1Inputs.trendStrength}%</div>
                            <div>Pattern {opp.gate1Inputs.patternConfidence}%</div>
                            <div>S/R {opp.gate1Inputs.hasSupportResistance ? 'yes' : 'no'}</div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[260px]">
                        {!isValid ? (
                          <span className="text-xs text-amber-400/90 line-clamp-3" title={formatPairBlockReason(opp)}>
                            {formatPairBlockReason(opp)}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-400/80">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${
                          opp.score >= 65 ? 'text-cyan-400' : 'text-gray-500'
                        }`}>
                          {opp.score}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${
                          opp.confidence >= SCANNER_MIN_CONFIDENCE_GATE ? 'text-cyan-400' : 'text-gray-500'
                        }`}>
                          {opp.confidence}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-white">{opp.strength.toFixed(1)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded ${
                          opp.riskLevel === 'LOW' ? 'bg-green-500/20 text-green-400' :
                          opp.riskLevel === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {opp.riskLevel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openInTrade(opp.symbol)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 mr-2"
                        >
                          Trade tab
                        </button>
                        {isValid && (
                          <button
                            type="button"
                            onClick={() => void quickExecute(opp.symbol)}
                            disabled={
                              !canExecuteToMt5 ||
                              quickExecuting === opp.symbol.replace('/', '')
                            }
                            title={!canExecuteToMt5 ? EXECUTE_ACCOUNT_TOOLTIP : undefined}
                            className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {quickExecuting === opp.symbol.replace('/', '')
                              ? '…'
                              : canExecuteToMt5
                                ? 'Execute'
                                : 'No account'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isScanning ? (
        <div className="space-y-4">
          <LoadingSkeleton type="card" />
          <LoadingSkeleton type="card" />
          <LoadingSkeleton type="card" />
        </div>
      ) : opportunities.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No Opportunities Found"
          description='Click "Scan Now" to analyze your selected pairs. Executable signals need Gate 4 pass and confidence ≥50% (same rules as Trade tab).'
          action={{
            label: '🔍 Scan All Pairs',
            onClick: () => void scanAllPairs(false),
          }}
        />
      ) : null}

      {executeSheet ? (
        <ApproveExecuteSheet
          symbol={executeSheet.displaySymbol}
          analysis={gatedEngineAdapter.getCachedAnalysis(executeSheet.sym)!}
          onClose={() => setExecuteSheet(null)}
          onDone={(success, text) => {
            setQuickExecuteMessage({
              symbol: executeSheet.displaySymbol,
              success,
              text,
            });
            setTimeout(() => setQuickExecuteMessage(null), 8000);
          }}
        />
      ) : null}
    </div>
  );
}

