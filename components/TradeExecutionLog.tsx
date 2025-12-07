'use client';

import { useState, useEffect, useCallback } from 'react';

interface ExecutionLogEntry {
  id: string;
  timestamp: Date;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  success: boolean;
  accountId?: string;
  accountName?: string;
  orderId?: string;
  error?: string;
  message?: string;
}

export function TradeExecutionLog() {
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');

  const loadLogs = () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('trade_execution_logs');
      if (stored) {
        const parsed = JSON.parse(stored);
        setLogs(parsed.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        })));
      }
    } catch (error) {
      console.error('Failed to load execution logs:', error);
    }
  };

  const addLog = useCallback((log: ExecutionLogEntry) => {
    setLogs(prevLogs => {
      const newLogs = [log, ...prevLogs].slice(0, 100); // Keep last 100 logs
      if (typeof window !== 'undefined') {
        localStorage.setItem('trade_execution_logs', JSON.stringify(newLogs));
      }
      return newLogs;
    });
  }, []);

  const clearLogs = () => {
    if (confirm('Are you sure you want to clear all execution logs?')) {
      setLogs([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('trade_execution_logs');
      }
    }
  };

  useEffect(() => {
    // Load logs from localStorage
    loadLogs();

    // Listen for new trade executions
    const handleTradeExecuted = (event: CustomEvent) => {
      const logEntry: ExecutionLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        ...event.detail,
      };
      addLog(logEntry);
    };

    window.addEventListener('tradeExecuted', handleTradeExecuted as EventListener);
    return () => {
      window.removeEventListener('tradeExecuted', handleTradeExecuted as EventListener);
    };
  }, [addLog]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Timestamp', 'Symbol', 'Type', 'Volume', 'Entry Price', 'Stop Loss', 'Take Profit', 'Account', 'Status', 'Order ID', 'Error'];
    const rows = filteredLogs.map(log => [
      log.timestamp.toISOString(),
      log.symbol || '',
      log.type || '',
      log.volume || 0,
      log.entryPrice || '',
      log.stopLoss || '',
      log.takeProfit || '',
      log.accountName || log.accountId || '',
      log.success ? 'Success' : 'Failed',
      log.orderId || '',
      log.error || '',
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'success' && !log.success) return false;
    if (filter === 'failed' && log.success) return false;
    if (selectedAccount !== 'all' && log.accountId !== selectedAccount) return false;
    return true;
  });

  const uniqueAccounts = Array.from(new Set(logs.map(log => log.accountId).filter(Boolean)));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Trade Execution Log</h2>
          <p className="text-gray-400 text-sm">History of all trade executions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            disabled={filteredLogs.length === 0}
            className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-500/30 transition-all text-sm font-medium disabled:opacity-50"
          >
            📥 Export CSV
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-all"
          >
            Clear Logs
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === 'all'
                ? 'bg-cyan-500 text-white'
                : 'bg-[#1e2738] text-gray-400 hover:bg-[#2a3548]'
            }`}
          >
            All ({logs.length})
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === 'success'
                ? 'bg-emerald-500 text-white'
                : 'bg-[#1e2738] text-gray-400 hover:bg-[#2a3548]'
            }`}
          >
            Success ({logs.filter(l => l.success).length})
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === 'failed'
                ? 'bg-rose-500 text-white'
                : 'bg-[#1e2738] text-gray-400 hover:bg-[#2a3548]'
            }`}
          >
            Failed ({logs.filter(l => !l.success).length})
          </button>
        </div>

        {uniqueAccounts.length > 0 && (
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="px-4 py-2 bg-[#1e2738] border border-[#2a3548] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Accounts</option>
            {uniqueAccounts.map(accountId => {
              const log = logs.find(l => l.accountId === accountId);
              return (
                <option key={accountId} value={accountId}>
                  {log?.accountName || accountId}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-2">No execution logs found</p>
            <p className="text-sm text-gray-600">Trade executions will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#141c2b] border-b border-[#1e2738]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Volume</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2738]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#141c2b] transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {log.timestamp.toLocaleTimeString()}
                      <br />
                      <span className="text-xs text-gray-500">
                        {log.timestamp.toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{log.symbol}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.type === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{log.volume} lots</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {log.accountName || log.accountId || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      {log.success ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                          ✓ Success
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-rose-500/20 text-rose-400">
                          ✕ Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {log.orderId && (
                        <div className="text-xs">
                          Order: {log.orderId}
                        </div>
                      )}
                      {log.error && (
                        <div className="text-xs text-rose-400 mt-1">
                          {log.error}
                        </div>
                      )}
                      {log.message && !log.error && (
                        <div className="text-xs text-gray-500 mt-1">
                          {log.message}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

