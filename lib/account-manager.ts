/**
 * Multi-Account Manager
 * Handles multiple MT5 account configurations
 */

export interface MT5Account {
  id: string;
  name: string;
  login: number;
  server: string;
  password?: string; // Optional - stored in localStorage
  isActive: boolean;
  balance?: number;
  equity?: number;
  currency?: string;
  lastUpdated?: Date;
}

class AccountManager {
  private accounts: MT5Account[] = [];
  private activeAccountId: string | null = null;
  private tradingAccountIds: string[] = []; // Multiple accounts for trading
  private storageKey = 'mt5_accounts';
  private activeKey = 'mt5_active_account';
  private tradingKey = 'mt5_trading_accounts';

  constructor() {
    this.loadAccounts();
  }

  /**
   * Load accounts from localStorage
   */
  private loadAccounts() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.accounts = JSON.parse(stored);
      }
      
      const activeId = localStorage.getItem(this.activeKey);
      if (activeId) {
        this.activeAccountId = activeId;
      }

      const tradingIds = localStorage.getItem(this.tradingKey);
      if (tradingIds) {
        this.tradingAccountIds = JSON.parse(tradingIds);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      this.accounts = [];
      this.tradingAccountIds = [];
    }
  }

  /**
   * Save accounts to localStorage
   */
  private saveAccounts() {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.accounts));
      if (this.activeAccountId) {
        localStorage.setItem(this.activeKey, this.activeAccountId);
      }
      localStorage.setItem(this.tradingKey, JSON.stringify(this.tradingAccountIds));
    } catch (error) {
      console.error('Failed to save accounts:', error);
    }
  }

  /**
   * Add a new account
   */
  addAccount(account: Omit<MT5Account, 'id' | 'isActive'>): MT5Account {
    const newAccount: MT5Account = {
      ...account,
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isActive: false,
    };

    this.accounts.push(newAccount);
    this.saveAccounts();
    return newAccount;
  }

  /**
   * Update an account
   */
  updateAccount(id: string, updates: Partial<MT5Account>): boolean {
    const index = this.accounts.findIndex(acc => acc.id === id);
    if (index === -1) return false;

    this.accounts[index] = { ...this.accounts[index], ...updates };
    this.saveAccounts();
    return true;
  }

  /**
   * Remove an account
   */
  removeAccount(id: string): boolean {
    const index = this.accounts.findIndex(acc => acc.id === id);
    if (index === -1) return false;

    // If removing active account, clear active
    if (this.activeAccountId === id) {
      this.activeAccountId = null;
    }

    this.accounts.splice(index, 1);
    this.saveAccounts();
    return true;
  }

  /**
   * Get all accounts
   */
  getAllAccounts(): MT5Account[] {
    return [...this.accounts];
  }

  /**
   * Get account by ID
   */
  getAccount(id: string): MT5Account | undefined {
    return this.accounts.find(acc => acc.id === id);
  }

  /**
   * Set active account
   */
  setActiveAccount(id: string | null): boolean {
    if (id === null) {
      this.activeAccountId = null;
      this.saveAccounts();
      return true;
    }

    const account = this.accounts.find(acc => acc.id === id);
    if (!account) return false;

    // Deactivate all accounts
    this.accounts.forEach(acc => acc.isActive = false);
    
    // Activate selected account
    account.isActive = true;
    this.activeAccountId = id;
    this.saveAccounts();
    return true;
  }

  /**
   * Get active account
   */
  getActiveAccount(): MT5Account | null {
    if (!this.activeAccountId) return null;
    return this.accounts.find(acc => acc.id === this.activeAccountId) || null;
  }

  /**
   * Update account balance/equity from MT5
   */
  updateAccountData(login: number, data: { balance?: number; equity?: number; currency?: string }): boolean {
    const account = this.accounts.find(acc => acc.login === login);
    if (!account) return false;

    account.balance = data.balance ?? account.balance;
    account.equity = data.equity ?? account.equity;
    account.currency = data.currency ?? account.currency;
    account.lastUpdated = new Date();
    this.saveAccounts();
    return true;
  }

  /**
   * Find account by login number
   */
  findByLogin(login: number): MT5Account | undefined {
    return this.accounts.find(acc => acc.login === login);
  }

  /**
   * Add account to trading list (for multi-account execution)
   */
  addTradingAccount(id: string): boolean {
    const account = this.accounts.find(acc => acc.id === id);
    if (!account) return false;

    if (!this.tradingAccountIds.includes(id)) {
      this.tradingAccountIds.push(id);
      this.saveAccounts();
    }
    return true;
  }

  /**
   * Remove account from trading list
   */
  removeTradingAccount(id: string): boolean {
    const index = this.tradingAccountIds.indexOf(id);
    if (index === -1) return false;

    this.tradingAccountIds.splice(index, 1);
    this.saveAccounts();
    return true;
  }

  /**
   * Get all accounts selected for trading
   */
  getTradingAccounts(): MT5Account[] {
    return this.accounts.filter(acc => this.tradingAccountIds.includes(acc.id));
  }

  /**
   * Check if account is selected for trading
   */
  isTradingAccount(id: string): boolean {
    return this.tradingAccountIds.includes(id);
  }

  /**
   * Set trading accounts (replace all)
   */
  setTradingAccounts(ids: string[]): void {
    // Validate all IDs exist
    const validIds = ids.filter(id => this.accounts.some(acc => acc.id === id));
    this.tradingAccountIds = validIds;
    this.saveAccounts();
  }

  /**
   * Merge Firestore-visible MT5 accounts into local storage (by login).
   */
  async syncFromFirestore(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const { listVisibleMt5Accounts } = await import('./firebase/mt5-accounts');
      const remote = await listVisibleMt5Accounts();
      for (const r of remote) {
        const existing = this.accounts.find((a) => a.login === r.login);
        if (existing) {
          existing.name = r.name;
          existing.server = r.server;
        } else {
          this.addAccount({
            name: r.name,
            login: r.login,
            server: r.server,
          });
        }
      }
      this.saveAccounts();
    } catch (e) {
      console.warn('accountManager.syncFromFirestore:', e);
    }
  }

  /**
   * Clear all trading accounts
   */
  clearTradingAccounts(): void {
    this.tradingAccountIds = [];
    this.saveAccounts();
  }
}

// Singleton instance
export const accountManager = new AccountManager();

