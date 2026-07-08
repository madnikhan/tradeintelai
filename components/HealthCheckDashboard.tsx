'use client'

import { useState, useEffect } from 'react'
import { getBridgeUrl } from '@/config/bridge-config'
import { LoadingSkeleton } from './LoadingSkeleton'

interface HealthStatus {
  service: string
  status: 'healthy' | 'degraded' | 'down'
  latency?: number
  lastCheck: Date
  message?: string
}

export function HealthCheckDashboard() {
  const [healthStatuses, setHealthStatuses] = useState<HealthStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    checkHealth()
    
    if (autoRefresh) {
      const interval = setInterval(checkHealth, 30000) // Check every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const checkHealth = async () => {
    setLoading(true)
    const checks: HealthStatus[] = []

    // Check MT5 Bridge
    try {
      const startTime = Date.now()
      const response = await fetch(getBridgeUrl('/health?quick=1'), {
        signal: AbortSignal.timeout(15000),
      })
      const latency = Date.now() - startTime
      
      if (response.ok) {
        checks.push({
          service: 'MT5 Bridge',
          status: 'healthy',
          latency,
          lastCheck: new Date(),
        })
      } else {
        checks.push({
          service: 'MT5 Bridge',
          status: 'degraded',
          latency,
          lastCheck: new Date(),
          message: `HTTP ${response.status}`,
        })
      }
    } catch (error: any) {
      checks.push({
        service: 'MT5 Bridge',
        status: 'down',
        lastCheck: new Date(),
        message: error.message || 'Connection failed',
      })
    }

    // Check COT Data API
    try {
      const startTime = Date.now()
      const response = await fetch('https://publicreporting.cftc.gov/resource/gpe5-46if.json?$limit=1', {
        signal: AbortSignal.timeout(10000),
      })
      const latency = Date.now() - startTime
      
      if (response.ok) {
        checks.push({
          service: 'COT Data API',
          status: 'healthy',
          latency,
          lastCheck: new Date(),
        })
      } else {
        checks.push({
          service: 'COT Data API',
          status: 'degraded',
          latency,
          lastCheck: new Date(),
          message: `HTTP ${response.status}`,
        })
      }
    } catch (error: any) {
      checks.push({
        service: 'COT Data API',
        status: 'down',
        lastCheck: new Date(),
        message: error.message || 'Connection failed',
      })
    }

    // Gemini — ping server health route (same as SystemStatus)
    try {
      const startTime = Date.now()
      const response = await fetch('/api/gemini/health', {
        signal: AbortSignal.timeout(10000),
      })
      const latency = Date.now() - startTime
      const data = response.ok ? await response.json().catch(() => ({})) : null

      if (response.ok) {
        checks.push({
          service: 'Gemini API',
          status: 'healthy',
          latency,
          lastCheck: new Date(),
          message: (data as { message?: string })?.message ?? 'Server proxy OK',
        })
      } else {
        checks.push({
          service: 'Gemini API',
          status: 'degraded',
          latency,
          lastCheck: new Date(),
          message: `HTTP ${response.status}`,
        })
      }
    } catch (error: unknown) {
      checks.push({
        service: 'Gemini API',
        status: 'down',
        lastCheck: new Date(),
        message: error instanceof Error ? error.message : 'Connection failed',
      })
    }

    setHealthStatuses(checks)
    setLoading(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'degraded':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      case 'down':
        return 'bg-red-500/20 border-red-500/50 text-red-400'
      default:
        return 'bg-gray-500/20 border-gray-500/50 text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅'
      case 'degraded':
        return '⚠️'
      case 'down':
        return '❌'
      default:
        return '❓'
    }
  }

  if (loading && healthStatuses.length === 0) {
    return <LoadingSkeleton />
  }

  const healthyCount = healthStatuses.filter(s => s.status === 'healthy').length
  const totalCount = healthStatuses.length
  const overallStatus = healthyCount === totalCount ? 'healthy' :
                        healthyCount > 0 ? 'degraded' : 'down'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">System Health</h2>
          <p className="text-sm text-gray-400 mt-1">
            Monitor data source availability and performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={checkHealth}
            disabled={loading}
            className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div className={`${getStatusColor(overallStatus)} border rounded-xl p-4`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getStatusIcon(overallStatus)}</span>
          <div>
            <div className="font-semibold">
              {overallStatus === 'healthy' ? 'All Systems Operational' :
               overallStatus === 'degraded' ? 'Some Services Degraded' :
               'System Issues Detected'}
            </div>
            <div className="text-sm opacity-80 mt-1">
              {healthyCount} of {totalCount} services healthy
            </div>
          </div>
        </div>
      </div>

      {/* Service Status List */}
      <div className="space-y-2">
        {healthStatuses.map((status, index) => (
          <div
            key={index}
            className={`${getStatusColor(status.status)} border rounded-lg p-4`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{getStatusIcon(status.status)}</span>
                <div>
                  <div className="font-semibold">{status.service}</div>
                  {status.message && (
                    <div className="text-sm opacity-80 mt-1">{status.message}</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                {status.latency !== undefined && (
                  <div className="text-sm opacity-80">{status.latency}ms</div>
                )}
                <div className="text-xs opacity-60 mt-1">
                  {status.lastCheck.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

