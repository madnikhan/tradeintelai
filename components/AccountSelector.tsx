'use client';

import { useState, useEffect } from 'react';
import { accountManager, MT5Account } from '@/lib/account-manager';
import { httpBridge } from '@/lib/http-bridge-connector';
import { createMt5Account, findAccountByLogin } from '@/lib/firebase/mt5-accounts';
import { loadUserBridgeSettings } from '@/lib/firebase/user-bridge-settings';

export function AccountSelector() {
  const [accounts, setAccounts] = useState<MT5Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<MT5Account | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    login: '',
    server: '',
    password: '',
  });

  useEffect(() => {
    void (async () => {
      await loadUserBridgeSettings();
      await accountManager.syncFromFirestore();
      loadAccounts();
    })();
  }, []);

  const loadAccounts = () => {
    const allAccounts = accountManager.getAllAccounts();
    setAccounts(allAccounts);
    setActiveAccount(accountManager.getActiveAccount());
  };

  const handleToggleTrading = (id: string) => {
    if (accountManager.isTradingAccount(id)) {
      accountManager.removeTradingAccount(id);
    } else {
      accountManager.addTradingAccount(id);
    }
    loadAccounts();
  };

  const handleAddAccount = async () => {
    if (!newAccount.name || !newAccount.login || !newAccount.server) {
      alert('Please fill in all required fields');
      return;
    }

    const login = parseInt(newAccount.login, 10);
    accountManager.addAccount({
      name: newAccount.name,
      login,
      server: newAccount.server,
      password: newAccount.password || undefined,
    });

    try {
      const bridgeSettings = await loadUserBridgeSettings();
      const bridgeUrl =
        bridgeSettings.bridgeUrl ||
        (typeof window !== 'undefined' ? localStorage.getItem('bridge_url') : null) ||
        'http://localhost:8080';
      await createMt5Account({
        login,
        server: newAccount.server,
        name: newAccount.name,
        bridgeUrl,
        bridgeType: 'colleague',
      });
      await accountManager.syncFromFirestore();
    } catch (e) {
      console.warn('Firestore MT5 account create skipped:', e);
    }

    setNewAccount({ name: '', login: '', server: '', password: '' });
    setIsAdding(false);
    loadAccounts();
  };

  const applyBridgeForLogin = async (login: number) => {
    try {
      const record = await findAccountByLogin(login);
      if (record?.bridgeUrl && typeof window !== 'undefined') {
        localStorage.setItem('bridge_url', record.bridgeUrl);
      }
    } catch {
      /* local-only mode */
    }
  };

  const handleSetActive = async (id: string) => {
    accountManager.setActiveAccount(id);
    const account = accountManager.getAccount(id);
    if (account) {
      await applyBridgeForLogin(account.login);
    }
    loadAccounts();
    refreshAccountData();
  };

  const handleRemove = (id: string) => {
    if (confirm('Are you sure you want to remove this account?')) {
      accountManager.removeAccount(id);
      loadAccounts();
    }
  };

  const refreshAccountData = async () => {
    try {
      const accountInfo = await httpBridge.getAccountInfo();
      if (accountInfo.success && accountInfo.login) {
        accountManager.updateAccountData(accountInfo.login, {
          balance: accountInfo.balance,
          equity: accountInfo.equity,
          currency: accountInfo.currency,
        });
        // Auto-detect and update trading mode from MT5 account type
        const { TradingModeManager } = await import('@/lib/trading-mode');
        let detectedMode: 'demo' | 'live' = 'live'; // Default to live
        
        if (accountInfo.account_type) {
          // Use account_type from EA if available
          detectedMode = accountInfo.account_type === 'demo' ? 'demo' : 'live';
          console.log(`🔍 AccountSelector: Auto-detected mode from account_type: ${detectedMode}`);
        } else if (accountInfo.server) {
          // Fallback: detect from server name
          const serverName = accountInfo.server.toLowerCase();
          if (serverName.includes('demo')) {
            detectedMode = 'demo';
          } else {
            detectedMode = 'live';
          }
          console.log(`🔍 AccountSelector: Auto-detected mode from server name: ${detectedMode} (server: ${accountInfo.server})`);
        }
        
        TradingModeManager.setMode(detectedMode);
        loadAccounts();
      }
    } catch (error) {
      console.error('Failed to refresh account data:', error);
    }
  };

  // Auto-refresh active account data
  useEffect(() => {
    if (activeAccount) {
      refreshAccountData();
      const interval = setInterval(refreshAccountData, 30000); // Every 30s
      return () => clearInterval(interval);
    }
  }, [activeAccount?.id]);

  return (
    <>
      {/* Account Selector Button - Simplified on mobile */}
      <div className="relative">
        <button
          onClick={() => setShowModal(!showModal)}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-[#141c2b] border border-[#1e2738] text-white hover:bg-[#1e2738] transition-all text-sm touch-manipulation"
          title={activeAccount ? `${activeAccount.name} (${activeAccount.login})` : 'Select Account'}
        >
          <span className="text-base sm:text-lg">👤</span>
          <span className="hidden lg:inline">
            {activeAccount ? activeAccount.name : 'No Account'}
          </span>
          {activeAccount && (
            <span className="hidden xl:inline text-xs text-gray-400">
              {activeAccount.login}
            </span>
          )}
        </button>

        {/* Dropdown Modal */}
        {showModal && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowModal(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-80 bg-[#0d1321] border border-[#1e2738] rounded-xl shadow-xl z-50 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">MT5 Accounts</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Account List */}
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {accounts.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No accounts configured
                  </p>
                ) : (
                  accounts.map((account) => (
                    <div
                      key={account.id}
                      className={`p-3 rounded-lg border ${
                        account.isActive
                          ? 'bg-cyan-500/10 border-cyan-500/30'
                          : 'bg-[#141c2b] border-[#1e2738]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={accountManager.isTradingAccount(account.id)}
                            onChange={() => handleToggleTrading(account.id)}
                            className="w-4 h-4 rounded border-[#1e2738] bg-[#0d1321] text-cyan-500 focus:ring-cyan-500"
                          />
                          <div>
                            <p className="text-sm font-bold text-white">
                              {account.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {account.login} @ {account.server}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {account.isActive && (
                            <span className="text-xs text-cyan-400">Active</span>
                          )}
                          {accountManager.isTradingAccount(account.id) && (
                            <span className="text-xs text-emerald-400">Trading</span>
                          )}
                        </div>
                      </div>
                      {account.balance !== undefined && (
                        <p className="text-xs text-gray-500">
                          Balance: {account.currency || '$'}
                          {account.balance.toLocaleString()}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        {!account.isActive && (
                          <button
                            onClick={() => handleSetActive(account.id)}
                            className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(account.id)}
                          className="text-xs px-2 py-1 bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500/30"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Account Form */}
              {isAdding ? (
                <div className="space-y-2 p-3 bg-[#141c2b] rounded-lg border border-[#1e2738]">
                  <input
                    type="text"
                    placeholder="Account Name"
                    value={newAccount.name}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="number"
                    placeholder="Login Number"
                    value={newAccount.login}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, login: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="Server (e.g., ICMarketsSC-Demo)"
                    value={newAccount.server}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, server: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="password"
                    placeholder="Password (optional)"
                    value={newAccount.password}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, password: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddAccount}
                      className="flex-1 px-3 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-400"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setIsAdding(false);
                        setNewAccount({ name: '', login: '', server: '', password: '' });
                      }}
                      className="px-3 py-2 bg-[#1e2738] text-gray-400 rounded-lg text-sm hover:bg-[#2a3548]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full px-3 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-cyan-400 text-sm font-medium hover:bg-[#1e2738]"
                >
                  + Add Account
                </button>
              )}

              {/* Info */}
              <p className="text-xs text-gray-500 mt-3 text-center">
                Note: Switch accounts in MT5, then activate here
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

