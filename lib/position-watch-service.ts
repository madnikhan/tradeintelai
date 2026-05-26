/**
 * Browser-based open position monitoring: TP progress + smart exit when stuck.
 * Single poll loop while dashboard is mounted.
 */

import { TRADING_RULES, DEFAULT_POSITION_WATCH_CONFIG, type PositionWatchConfig } from '@/config/trading-rules';
import { httpBridge } from '@/lib/http-bridge-connector';
import { gatedEngineAdapter } from '@/lib/gated-engine-adapter';
import { updateAnalysisOutcome } from '@/lib/firebase/analysis-storage';
import { logger } from '@/lib/logger';
import type { TradeDirection } from '@/types/trading';

export type WatchStatus =
  | 'watching'
  | 'tp_hit'
  | 'sl_hit'
  | 'exited_smart'
  | 'closed_external'
  | 'stopped';

export interface WatchedPosition {
  id: string;
  symbol: string;
  ticket?: string | number;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: Date;
  source: 'ai' | 'manual' | 'scalp';
  analysisId?: string;
  recommendation?: string;
  /** Scalp profile: close when unrealized profit reaches this USD amount */
  takeProfitDollars?: number;
  configOverrides?: Partial<PositionWatchConfig>;
  status: WatchStatus;
  lastProfit: number;
  peakProfit: number;
  lastDistanceToTpPercent: number;
  lastCheckAt?: Date;
  exitReason?: string;
  closedAt?: Date;
}

export interface PositionWatchEvent {
  type: 'updated' | 'closed' | 'exit_attempt';
  position: WatchedPosition;
  message?: string;
}

type Listener = (event: PositionWatchEvent) => void;

function normalizeSymbol(s: string): string {
  return s.replace(/\//g, '').toUpperCase();
}

function parsePositionsResponse(positionsResponse: unknown): any[] {
  if (Array.isArray(positionsResponse)) return positionsResponse;
  if (positionsResponse && typeof positionsResponse === 'object') {
    const o = positionsResponse as Record<string, unknown>;
    if (Array.isArray(o.positions)) return o.positions;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.result)) return o.result;
    const arr = Object.values(o).find((v) => Array.isArray(v));
    if (Array.isArray(arr)) return arr;
  }
  return [];
}

function isOpenPosition(p: any): boolean {
  const status = (p.status || p.state || '').toString().toLowerCase();
  return !status || status === 'open' || status === 'active';
}

function matchPosition(open: any[], watch: WatchedPosition): any | undefined {
  return open.find((p: any) => {
    const ticket = p.order_id ?? p.orderId ?? p.ticket ?? p.id;
    if (watch.ticket != null && ticket != null) {
      if (String(ticket) === String(watch.ticket)) return true;
    }
    const sym = normalizeSymbol(p.symbol || '');
    if (sym !== normalizeSymbol(watch.symbol)) return false;
    const entry = p.entry_price ?? p.entryPrice ?? p.open_price ?? p.price_open ?? p.price;
    if (entry && Math.abs(Number(entry) - watch.entryPrice) < 0.0005) return true;
    return false;
  });
}

function distanceToTpPercent(
  current: number,
  entry: number,
  tp: number,
  direction: TradeDirection
): number {
  const total = Math.abs(tp - entry);
  if (total <= 0) return 100;
  const moved =
    direction === 'BUY' ? current - entry : entry - current;
  return Math.max(0, Math.min(100, (moved / total) * 100));
}

function getPipSize(symbol: string): number {
  const s = normalizeSymbol(symbol);
  if (s.includes('JPY') && !s.startsWith('XAU') && !s.startsWith('XAG')) return 0.01;
  return 0.0001;
}

export class PositionWatchService {
  private static watches = new Map<string, WatchedPosition>();
  private static config: PositionWatchConfig = { ...DEFAULT_POSITION_WATCH_CONFIG };
  private static pollTimer: ReturnType<typeof setInterval> | null = null;
  private static listeners = new Set<Listener>();
  private static lastSignalCheck = new Map<string, number>();
  private static recentEvents: PositionWatchEvent[] = [];

  static configure(partial: Partial<PositionWatchConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  static getConfig(): PositionWatchConfig {
    return { ...this.config };
  }

  static subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private static emit(event: PositionWatchEvent): void {
    this.recentEvents = [event, ...this.recentEvents].slice(0, 20);
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (e) {
        logger.error('PositionWatch listener error', e);
      }
    });
  }

  static getWatches(): WatchedPosition[] {
    return Array.from(this.watches.values());
  }

  static getRecentEvents(): PositionWatchEvent[] {
    return [...this.recentEvents];
  }

  static register(input: {
    symbol: string;
    ticket?: string | number;
    direction: TradeDirection;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    source?: 'ai' | 'manual' | 'scalp';
    analysisId?: string;
    recommendation?: string;
    takeProfitDollars?: number;
    configOverrides?: Partial<PositionWatchConfig>;
  }): WatchedPosition {
    const id = `watch_${normalizeSymbol(input.symbol)}_${Date.now()}`;
    const watch: WatchedPosition = {
      id,
      symbol: normalizeSymbol(input.symbol),
      ticket: input.ticket,
      direction: input.direction,
      entryPrice: input.entryPrice,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      openedAt: new Date(),
      source: input.source ?? 'manual',
      analysisId: input.analysisId,
      recommendation: input.recommendation,
      takeProfitDollars: input.takeProfitDollars,
      configOverrides: input.configOverrides,
      status: 'watching',
      lastProfit: 0,
      peakProfit: 0,
      lastDistanceToTpPercent: 0,
    };
    this.watches.set(id, watch);
    logger.info(`PositionWatch: registered ${watch.symbol} ticket=${watch.ticket ?? 'pending'}`);
    this.ensurePolling();
    this.emit({ type: 'updated', position: watch });
    return watch;
  }

  static stop(id: string): void {
    const w = this.watches.get(id);
    if (w) {
      w.status = 'stopped';
      this.watches.delete(id);
    }
    if (this.watches.size === 0) this.stopPolling();
  }

  static startPolling(): void {
    this.ensurePolling();
  }

  static stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private static ensurePolling(): void {
    if (this.pollTimer || !this.config.enabled) return;
    const interval = TRADING_RULES.POSITION_WATCH_POLL_MS;
    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, interval);
    void this.pollOnce();
  }

  private static async pollOnce(): Promise<void> {
    if (this.watches.size === 0) return;

    let positionsResponse: unknown;
    try {
      positionsResponse = await httpBridge.getPositions();
    } catch (e) {
      logger.warn('PositionWatch: getPositions failed', e);
      return;
    }

    const all = parsePositionsResponse(positionsResponse);
    const open = all.filter(isOpenPosition);

    for (const watch of [...this.watches.values()]) {
      if (watch.status !== 'watching') continue;

      const pos = matchPosition(open, watch);
      watch.lastCheckAt = new Date();

      if (!pos) {
        await this.handleClosedExternally(watch, all);
        continue;
      }

      const profit = Number(pos.profit ?? pos.profitLoss ?? pos.pl ?? 0);
      const current =
        Number(pos.current_price ?? pos.currentPrice ?? pos.price ?? pos.bid) ||
        watch.entryPrice;
      watch.lastProfit = profit;
      if (profit > watch.peakProfit) watch.peakProfit = profit;
      watch.lastDistanceToTpPercent = distanceToTpPercent(
        current,
        watch.entryPrice,
        watch.takeProfit,
        watch.direction
      );

      if (
        watch.takeProfitDollars != null &&
        profit >= watch.takeProfitDollars
      ) {
        const closed = await this.tryClose(
          watch,
          `Scalp profit target ($${watch.takeProfitDollars}) reached`
        );
        if (closed) continue;
      }

      if (profit >= 0 && watch.lastDistanceToTpPercent >= 99.5) {
        watch.status = 'tp_hit';
        watch.closedAt = new Date();
        watch.exitReason = 'Take profit reached (price at target)';
        await this.finalizeClose(watch, profit);
        continue;
      }

      const cfgAssist = this.watchConfig(watch);
      if (cfgAssist.assistTpClose && watch.lastDistanceToTpPercent >= 95) {
        const pip = getPipSize(watch.symbol);
        const distPips = Math.abs(watch.takeProfit - current) / pip;
        if (distPips <= TRADING_RULES.POSITION_WATCH_ASSIST_TP_PIPS) {
          const closed = await this.tryClose(watch, 'App-assisted close near take profit');
          if (closed) continue;
        }
      }

      const cfg = this.watchConfig(watch);
      if (cfg.smartExitEnabled) {
        const exitReason = await this.evaluateSmartExit(watch, current, profit);
        if (exitReason) {
          const closed = await this.tryClose(watch, exitReason);
          if (closed) continue;
        }
      }

      this.emit({ type: 'updated', position: { ...watch } });
    }
  }

  private static async handleClosedExternally(
    watch: WatchedPosition,
    all: any[]
  ): Promise<void> {
    const closed = all.find((p: any) => {
      const ticket = p.order_id ?? p.orderId ?? p.ticket;
      return (
        watch.ticket != null &&
        ticket != null &&
        String(ticket) === String(watch.ticket)
      );
    });
    const profit = closed
      ? Number(closed.profit ?? closed.profitLoss ?? 0)
      : watch.lastProfit;

    if (profit > 0) {
      watch.status = 'tp_hit';
      watch.exitReason = 'Closed at broker (profit)';
    } else if (profit < 0) {
      watch.status = 'sl_hit';
      watch.exitReason = 'Closed at broker (loss)';
    } else {
      watch.status = 'closed_external';
      watch.exitReason = 'Position closed externally';
    }
    watch.closedAt = new Date();
    await this.finalizeClose(watch, profit);
  }

  private static watchConfig(watch: WatchedPosition): PositionWatchConfig {
    return { ...this.config, ...watch.configOverrides };
  }

  private static async evaluateSmartExit(
    watch: WatchedPosition,
    current: number,
    profit: number
  ): Promise<string | null> {
    const cfg = this.watchConfig(watch);
    const now = Date.now();
    const holdMs = now - watch.openedAt.getTime();

    if (holdMs >= cfg.maxHoldMs) {
      return `Max hold time exceeded (${Math.round(holdMs / 3600000)}h)`;
    }

    const riskDist = Math.abs(watch.entryPrice - watch.stopLoss);
    if (riskDist > 0) {
      const adverse =
        watch.direction === 'BUY'
          ? watch.entryPrice - current
          : current - watch.entryPrice;
      if (adverse >= riskDist * cfg.lossExtension) {
        return `Loss extended beyond ${cfg.lossExtension}x planned risk`;
      }
    }

    if (
      watch.peakProfit > 0 &&
      profit < watch.peakProfit * (1 - cfg.givebackFraction)
    ) {
      return `Gave back ${Math.round(cfg.givebackFraction * 100)}% of peak open profit`;
    }

    if (
      holdMs >= cfg.stallNearTpMs &&
      watch.lastDistanceToTpPercent >= (1 - cfg.stallTpFraction) * 100
    ) {
      return `Stalled near take profit for ${Math.round(holdMs / 3600000)}h`;
    }

    if (cfg.signalRecheckEnabled) {
      const lastCheck = this.lastSignalCheck.get(watch.id) ?? 0;
      if (now - lastCheck >= TRADING_RULES.POSITION_WATCH_SIGNAL_RECHECK_MS) {
        this.lastSignalCheck.set(watch.id, now);
        try {
          const analysis = await gatedEngineAdapter.analyzeMarket(watch.symbol, []);
          const rec = analysis.recommendation;
          const permitted = analysis.gateStatus?.executionPermitted ?? false;
          const bias = analysis.gateStatus?.directionalBias;

          if (!permitted || rec === 'HOLD') {
            return `Signal invalidated (now ${rec}, execution blocked)`;
          }
          if (
            watch.direction === 'BUY' &&
            (rec.includes('SELL') || bias === 'BEARISH')
          ) {
            return 'Direction flipped bearish vs open BUY';
          }
          if (
            watch.direction === 'SELL' &&
            (rec.includes('BUY') || bias === 'BULLISH')
          ) {
            return 'Direction flipped bullish vs open SELL';
          }
        } catch (e) {
          logger.debug('PositionWatch: signal recheck skipped', e);
        }
      }
    }

    return null;
  }

  private static async tryClose(
    watch: WatchedPosition,
    reason: string
  ): Promise<boolean> {
    if (!watch.ticket) {
      logger.warn(`PositionWatch: cannot close ${watch.symbol} — no ticket`);
      return false;
    }

    this.emit({
      type: 'exit_attempt',
      position: watch,
      message: reason,
    });

    try {
      const result = await httpBridge.closePosition(watch.ticket);
      if (result?.success === false) {
        logger.warn(`PositionWatch: close failed for ${watch.ticket}`, result);
        return false;
      }
      watch.status = 'exited_smart';
      watch.exitReason = reason;
      watch.closedAt = new Date();
      await this.finalizeClose(watch, watch.lastProfit);
      return true;
    } catch (e) {
      logger.error('PositionWatch: closePosition error', e);
      return false;
    }
  }

  private static async finalizeClose(
    watch: WatchedPosition,
    profit: number
  ): Promise<void> {
    this.watches.delete(watch.id);
    this.lastSignalCheck.delete(watch.id);

    if (watch.analysisId) {
      const entryValue = watch.entryPrice * 100000 * 0.01;
      const actualReturn = entryValue > 0 ? (profit / entryValue) * 100 : 0;
      void updateAnalysisOutcome(watch.analysisId, watch.id, {
        wasProfitable: profit > 0,
        actualReturn,
      }).catch((e) => logger.warn('PositionWatch: outcome update failed', e));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('positionWatchClosed', {
          detail: { watch, profit },
        })
      );
    }

    logger.info(
      `PositionWatch: ${watch.symbol} closed — ${watch.status} — ${watch.exitReason} — P/L ${profit.toFixed(2)}`
    );
    this.emit({
      type: 'closed',
      position: { ...watch },
      message: watch.exitReason,
    });

    if (this.watches.size === 0) this.stopPolling();
  }
}
