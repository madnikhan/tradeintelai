/**
 * Multi-Account Trade Executor
 * Executes trades on multiple MT5 accounts simultaneously
 */

import { accountManager, MT5Account } from './account-manager';
import { httpBridge } from './http-bridge-connector';

export interface MultiAccountTradeResult {
  accountId: string;
  accountName: string;
  login: number;
  success: boolean;
  orderId?: string;
  error?: string;
  message?: string;
}

export interface MultiAccountTradeResponse {
  totalAccounts: number;
  successful: number;
  failed: number;
  results: MultiAccountTradeResult[];
}

export class MultiAccountExecutor {
  /**
   * Execute trade on multiple accounts
   */
  static async executeOnMultipleAccounts(
    trade: {
      symbol: string;
      type: 'BUY' | 'SELL';
      volume: number;
      stopLoss?: number;
      takeProfit?: number;
    },
    accountIds?: string[] // If not provided, uses all trading accounts
  ): Promise<MultiAccountTradeResponse> {
    const tradingAccounts = accountIds
      ? accountIds.map(id => accountManager.getAccount(id)).filter(Boolean) as MT5Account[]
      : accountManager.getTradingAccounts();

    if (tradingAccounts.length === 0) {
      return {
        totalAccounts: 0,
        successful: 0,
        failed: 0,
        results: [],
      };
    }

    // Execute trades in parallel
    const promises = tradingAccounts.map(account =>
      this.executeOnAccount(account, trade)
    );

    const results = await Promise.all(promises);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      totalAccounts: tradingAccounts.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Execute trade on a single account
   */
  private static async executeOnAccount(
    account: MT5Account,
    trade: {
      symbol: string;
      type: 'BUY' | 'SELL';
      volume: number;
      stopLoss?: number;
      takeProfit?: number;
    }
  ): Promise<MultiAccountTradeResult> {
    try {
      // For now, we'll use the same bridge but with account context
      // In the future, this could route to account-specific bridges
      const result = await httpBridge.executeTrade({
        symbol: trade.symbol,
        type: trade.type,
        volume: trade.volume,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        accountLogin: account.login, // Pass account login for routing
      });

      return {
        accountId: account.id,
        accountName: account.name,
        login: account.login,
        success: result.success || false,
        orderId: result.order_id || result.orderId,
        error: result.error,
        message: result.message,
      };
    } catch (error) {
      return {
        accountId: account.id,
        accountName: account.name,
        login: account.login,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get account-specific trade status
   */
  static async getAccountStatus(accountId: string): Promise<{
    connected: boolean;
    balance?: number;
    equity?: number;
  }> {
    const account = accountManager.getAccount(accountId);
    if (!account) {
      return { connected: false };
    }

    try {
      const accountInfo = await httpBridge.getAccountInfo();
      if (accountInfo.success && accountInfo.login === account.login) {
        return {
          connected: true,
          balance: accountInfo.balance,
          equity: accountInfo.equity,
        };
      }
    } catch (error) {
      console.error(`Failed to get status for account ${accountId}:`, error);
    }

    return { connected: false };
  }
}

