export type NotificationEventType =
  | 'trade_executed'
  | 'executable_signal'
  | 'position_tp_near'
  | 'position_smart_exit'
  | 'bridge_disconnected';

export interface TradeExecutedPayload {
  symbol: string;
  direction: string;
  lots: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  orderId?: string | number;
  score?: number;
  confidence?: number;
  gatePassed?: boolean;
}

export interface ExecutableSignalPayload {
  symbol: string;
  recommendation: string;
  score: number;
  confidence: number;
}

export interface NotificationPrefs {
  pushEnabled: boolean;
  telegramEnabled: boolean;
  tradeExecuted: boolean;
  executableSignal: boolean;
  bridgeDisconnected: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  pushEnabled: true,
  telegramEnabled: true,
  tradeExecuted: true,
  executableSignal: false,
  bridgeDisconnected: true,
};
