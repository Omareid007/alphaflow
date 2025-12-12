/**
 * AI Active Trader - Position Reconciliation System
 * Ensures internal positions match broker records for data integrity.
 * Based on financial reconciliation best practices.
 */

import { createLogger } from '../shared/common';
import { KillSwitch, KillSwitchReason } from '../shared/common/kill-switch';

const logger = createLogger('trading-engine:reconciliation');

export interface InternalPosition {
  symbol: string;
  quantity: number;
  side: 'long' | 'short';
  avgEntryPrice: number;
  currentValue: number;
}

export interface BrokerPosition {
  symbol: string;
  quantity: number;
  side: 'long' | 'short';
  avgEntryPrice: number;
  marketValue: number;
  unrealizedPnl: number;
}

export interface ReconciliationResult {
  status: 'matched' | 'mismatch' | 'error';
  timestamp: Date;
  internalPositionCount: number;
  brokerPositionCount: number;
  mismatches: PositionMismatch[];
  orphanedInternal: string[];
  orphanedBroker: string[];
  totalInternalValue: number;
  totalBrokerValue: number;
  valueDifference: number;
  valueDifferencePercent: number;
}

export interface PositionMismatch {
  symbol: string;
  field: 'quantity' | 'side' | 'avgEntryPrice' | 'value';
  internalValue: number | string;
  brokerValue: number | string;
  difference: number | null;
  severity: 'critical' | 'warning' | 'info';
}

export interface ReconciliationConfig {
  quantityTolerancePercent: number;
  priceTolerancePercent: number;
  valueTolerancePercent: number;
  autoHaltOnCritical: boolean;
  reconciliationIntervalMs: number;
}

const DEFAULT_CONFIG: ReconciliationConfig = {
  quantityTolerancePercent: 0.01,
  priceTolerancePercent: 0.5,
  valueTolerancePercent: 1.0,
  autoHaltOnCritical: true,
  reconciliationIntervalMs: 60000,
};

export class PositionReconciler {
  private config: ReconciliationConfig;
  private lastReconciliation: ReconciliationResult | null = null;
  private reconciliationHistory: ReconciliationResult[] = [];
  private maxHistorySize = 100;
  private reconciliationInterval: ReturnType<typeof setInterval> | null = null;
  private getInternalPositions: (() => Promise<InternalPosition[]>) | null = null;
  private getBrokerPositions: (() => Promise<BrokerPosition[]>) | null = null;

  constructor(config: Partial<ReconciliationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setPositionProviders(
    internal: () => Promise<InternalPosition[]>,
    broker: () => Promise<BrokerPosition[]>
  ): void {
    this.getInternalPositions = internal;
    this.getBrokerPositions = broker;
  }

  async reconcile(): Promise<ReconciliationResult> {
    if (!this.getInternalPositions || !this.getBrokerPositions) {
      return this.createErrorResult('Position providers not configured');
    }

    try {
      const [internalPositions, brokerPositions] = await Promise.all([
        this.getInternalPositions(),
        this.getBrokerPositions(),
      ]);

      const result = this.comparePositions(internalPositions, brokerPositions);

      this.lastReconciliation = result;
      this.reconciliationHistory.push(result);

      if (this.reconciliationHistory.length > this.maxHistorySize) {
        this.reconciliationHistory.shift();
      }

      if (result.status === 'mismatch' && this.config.autoHaltOnCritical) {
        const criticalMismatches = result.mismatches.filter(m => m.severity === 'critical');
        if (criticalMismatches.length > 0) {
          logger.error('Critical reconciliation mismatch detected', undefined, {
            mismatches: criticalMismatches,
          });

          const killSwitch = KillSwitch.getInstance();
          killSwitch.trigger(KillSwitchReason.RECONCILIATION_MISMATCH, {
            mismatches: criticalMismatches,
            valueDifference: result.valueDifference,
          });
        }
      }

      logger.info('Reconciliation completed', {
        status: result.status,
        mismatchCount: result.mismatches.length,
        orphanedInternal: result.orphanedInternal.length,
        orphanedBroker: result.orphanedBroker.length,
      });

      return result;

    } catch (error) {
      logger.error('Reconciliation failed', error instanceof Error ? error : undefined);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private comparePositions(
    internal: InternalPosition[],
    broker: BrokerPosition[]
  ): ReconciliationResult {
    const mismatches: PositionMismatch[] = [];
    const matchedSymbols = new Set<string>();

    const internalMap = new Map(internal.map(p => [p.symbol, p]));
    const brokerMap = new Map(broker.map(p => [p.symbol, p]));

    for (const [symbol, intPos] of internalMap) {
      const brokerPos = brokerMap.get(symbol);

      if (!brokerPos) {
        continue;
      }

      matchedSymbols.add(symbol);

      if (intPos.side !== brokerPos.side) {
        mismatches.push({
          symbol,
          field: 'side',
          internalValue: intPos.side,
          brokerValue: brokerPos.side,
          difference: null,
          severity: 'critical',
        });
      }

      const qtyDiff = Math.abs(intPos.quantity - brokerPos.quantity);
      const qtyDiffPercent = qtyDiff / Math.max(intPos.quantity, brokerPos.quantity);
      if (qtyDiffPercent > this.config.quantityTolerancePercent) {
        mismatches.push({
          symbol,
          field: 'quantity',
          internalValue: intPos.quantity,
          brokerValue: brokerPos.quantity,
          difference: intPos.quantity - brokerPos.quantity,
          severity: qtyDiffPercent > 0.05 ? 'critical' : 'warning',
        });
      }

      const priceDiff = Math.abs(intPos.avgEntryPrice - brokerPos.avgEntryPrice);
      const priceDiffPercent = priceDiff / Math.max(intPos.avgEntryPrice, brokerPos.avgEntryPrice);
      if (priceDiffPercent > this.config.priceTolerancePercent / 100) {
        mismatches.push({
          symbol,
          field: 'avgEntryPrice',
          internalValue: intPos.avgEntryPrice,
          brokerValue: brokerPos.avgEntryPrice,
          difference: intPos.avgEntryPrice - brokerPos.avgEntryPrice,
          severity: 'info',
        });
      }

      const valueDiff = Math.abs(intPos.currentValue - brokerPos.marketValue);
      const valueDiffPercent = valueDiff / Math.max(intPos.currentValue, brokerPos.marketValue);
      if (valueDiffPercent > this.config.valueTolerancePercent / 100) {
        mismatches.push({
          symbol,
          field: 'value',
          internalValue: intPos.currentValue,
          brokerValue: brokerPos.marketValue,
          difference: intPos.currentValue - brokerPos.marketValue,
          severity: valueDiffPercent > 0.05 ? 'warning' : 'info',
        });
      }
    }

    const orphanedInternal = Array.from(internalMap.keys()).filter(s => !matchedSymbols.has(s));
    const orphanedBroker = Array.from(brokerMap.keys()).filter(s => !matchedSymbols.has(s));

    if (orphanedInternal.length > 0) {
      for (const symbol of orphanedInternal) {
        mismatches.push({
          symbol,
          field: 'quantity',
          internalValue: internalMap.get(symbol)!.quantity,
          brokerValue: 0,
          difference: internalMap.get(symbol)!.quantity,
          severity: 'critical',
        });
      }
    }

    if (orphanedBroker.length > 0) {
      for (const symbol of orphanedBroker) {
        mismatches.push({
          symbol,
          field: 'quantity',
          internalValue: 0,
          brokerValue: brokerMap.get(symbol)!.quantity,
          difference: -brokerMap.get(symbol)!.quantity,
          severity: 'critical',
        });
      }
    }

    const totalInternalValue = internal.reduce((sum, p) => sum + p.currentValue, 0);
    const totalBrokerValue = broker.reduce((sum, p) => sum + p.marketValue, 0);
    const valueDifference = totalInternalValue - totalBrokerValue;
    const valueDifferencePercent = totalBrokerValue !== 0 
      ? (valueDifference / totalBrokerValue) * 100 
      : 0;

    return {
      status: mismatches.length === 0 ? 'matched' : 'mismatch',
      timestamp: new Date(),
      internalPositionCount: internal.length,
      brokerPositionCount: broker.length,
      mismatches,
      orphanedInternal,
      orphanedBroker,
      totalInternalValue,
      totalBrokerValue,
      valueDifference,
      valueDifferencePercent,
    };
  }

  private createErrorResult(message: string): ReconciliationResult {
    return {
      status: 'error',
      timestamp: new Date(),
      internalPositionCount: 0,
      brokerPositionCount: 0,
      mismatches: [{
        symbol: 'SYSTEM',
        field: 'value',
        internalValue: message,
        brokerValue: 'N/A',
        difference: null,
        severity: 'critical',
      }],
      orphanedInternal: [],
      orphanedBroker: [],
      totalInternalValue: 0,
      totalBrokerValue: 0,
      valueDifference: 0,
      valueDifferencePercent: 0,
    };
  }

  startPeriodicReconciliation(): void {
    if (this.reconciliationInterval) {
      return;
    }

    this.reconciliationInterval = setInterval(
      () => this.reconcile(),
      this.config.reconciliationIntervalMs
    );

    logger.info('Started periodic reconciliation', {
      intervalMs: this.config.reconciliationIntervalMs,
    });
  }

  stopPeriodicReconciliation(): void {
    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
      this.reconciliationInterval = null;
      logger.info('Stopped periodic reconciliation');
    }
  }

  getLastResult(): ReconciliationResult | null {
    return this.lastReconciliation;
  }

  getHistory(): ReadonlyArray<ReconciliationResult> {
    return [...this.reconciliationHistory];
  }

  getStats(): {
    totalReconciliations: number;
    matchedCount: number;
    mismatchCount: number;
    errorCount: number;
    matchRate: number;
  } {
    const total = this.reconciliationHistory.length;
    const matched = this.reconciliationHistory.filter(r => r.status === 'matched').length;
    const mismatch = this.reconciliationHistory.filter(r => r.status === 'mismatch').length;
    const error = this.reconciliationHistory.filter(r => r.status === 'error').length;

    return {
      totalReconciliations: total,
      matchedCount: matched,
      mismatchCount: mismatch,
      errorCount: error,
      matchRate: total > 0 ? matched / total : 1,
    };
  }
}

export function createPositionReconciler(config?: Partial<ReconciliationConfig>): PositionReconciler {
  return new PositionReconciler(config);
}
