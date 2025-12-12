/**
 * AI Active Trader - Strategy DSL Runtime
 * Domain-Specific Language for defining trading strategies.
 * Supports plug-and-play strategies with backtesting integration.
 */

import { createLogger } from '../common';

const logger = createLogger('dsl-runtime');

export interface StrategyCondition {
  type: 'price' | 'indicator' | 'volume' | 'time' | 'pattern' | 'custom';
  indicator?: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'crosses_above' | 'crosses_below';
  value: number | string | StrategyCondition;
  params?: Record<string, unknown>;
}

export interface StrategyAction {
  type: 'buy' | 'sell' | 'close' | 'scale_in' | 'scale_out' | 'alert' | 'log';
  symbol?: string;
  quantity?: number | 'all' | 'half' | 'percent';
  quantityPercent?: number;
  orderType?: 'market' | 'limit' | 'stop';
  limitPrice?: number | string;
  stopPrice?: number | string;
  message?: string;
}

export interface StrategyRule {
  name: string;
  description?: string;
  conditions: StrategyCondition[];
  conditionLogic?: 'and' | 'or';
  actions: StrategyAction[];
  priority?: number;
  cooldownMs?: number;
  maxExecutions?: number;
  enabled?: boolean;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  symbols: string[];
  timeframe: string;
  rules: StrategyRule[];
  riskManagement?: {
    maxPositionSize?: number;
    maxPositionPercent?: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    trailingStopPercent?: number;
    maxDailyLossPercent?: number;
    maxOpenPositions?: number;
  };
  parameters?: Record<string, {
    type: 'number' | 'string' | 'boolean';
    default: unknown;
    min?: number;
    max?: number;
    options?: unknown[];
    description?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface StrategyContext {
  symbol: string;
  currentPrice: number;
  timestamp: Date;
  bars: Array<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: Date;
  }>;
  position?: {
    side: 'long' | 'short' | 'flat';
    quantity: number;
    entryPrice: number;
    unrealizedPnl: number;
  };
  account?: {
    cash: number;
    equity: number;
    buyingPower: number;
  };
  indicators: Map<string, number[]>;
  parameters: Record<string, unknown>;
  state: Record<string, unknown>;
}

export interface StrategySignal {
  strategyId: string;
  ruleName: string;
  symbol: string;
  action: StrategyAction;
  timestamp: Date;
  confidence: number;
  reasoning: string;
  metadata: Record<string, unknown>;
}

export interface BacktestResult {
  strategyId: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgHoldingPeriodMs: number;
  trades: Array<{
    entryTime: Date;
    exitTime: Date;
    side: 'long' | 'short';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    rule: string;
  }>;
}

type IndicatorFunction = (bars: StrategyContext['bars'], ...params: number[]) => number[];

const BUILT_IN_INDICATORS: Record<string, IndicatorFunction> = {
  sma: (bars, period = 20) => {
    const closes = bars.map(b => b.close);
    const result: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else {
        const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  },

  ema: (bars, period = 20) => {
    const closes = bars.map(b => b.close);
    const multiplier = 2 / (period + 1);
    const result: number[] = [];
    let ema = closes[0];
    
    for (let i = 0; i < closes.length; i++) {
      if (i === 0) {
        result.push(closes[0]);
      } else {
        ema = (closes[i] - ema) * multiplier + ema;
        result.push(ema);
      }
    }
    return result;
  },

  rsi: (bars, period = 14) => {
    const closes = bars.map(b => b.close);
    const result: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 0; i < closes.length; i++) {
      if (i === 0) {
        result.push(NaN);
        continue;
      }

      const change = closes[i] - closes[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);

      if (i < period) {
        result.push(NaN);
        continue;
      }

      const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      }
    }
    return result;
  },

  macd: (bars, fast = 12, slow = 26, signal = 9) => {
    const emaFast = BUILT_IN_INDICATORS.ema(bars, fast);
    const emaSlow = BUILT_IN_INDICATORS.ema(bars, slow);
    const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
    
    const fakeBars = macdLine.map(m => ({ open: m, high: m, low: m, close: m, volume: 0, timestamp: new Date() }));
    const signalLine = BUILT_IN_INDICATORS.ema(fakeBars, signal);
    
    return macdLine.map((m, i) => m - signalLine[i]);
  },

  bollinger_upper: (bars, period = 20, stdDev = 2) => {
    const sma = BUILT_IN_INDICATORS.sma(bars, period);
    const closes = bars.map(b => b.close);
    
    return sma.map((ma, i) => {
      if (isNaN(ma)) return NaN;
      const slice = closes.slice(Math.max(0, i - period + 1), i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
      return ma + stdDev * Math.sqrt(variance);
    });
  },

  bollinger_lower: (bars, period = 20, stdDev = 2) => {
    const sma = BUILT_IN_INDICATORS.sma(bars, period);
    const closes = bars.map(b => b.close);
    
    return sma.map((ma, i) => {
      if (isNaN(ma)) return NaN;
      const slice = closes.slice(Math.max(0, i - period + 1), i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
      return ma - stdDev * Math.sqrt(variance);
    });
  },

  atr: (bars, period = 14) => {
    const result: number[] = [];
    const trueRanges: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i === 0) {
        trueRanges.push(bars[i].high - bars[i].low);
        result.push(NaN);
        continue;
      }

      const high = bars[i].high;
      const low = bars[i].low;
      const prevClose = bars[i - 1].close;
      
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trueRanges.push(tr);

      if (i < period - 1) {
        result.push(NaN);
      } else {
        const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
        result.push(atr);
      }
    }
    return result;
  },

  volume_sma: (bars, period = 20) => {
    const volumes = bars.map(b => b.volume);
    const result: number[] = [];
    for (let i = 0; i < volumes.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else {
        const sum = volumes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  },
};

export class DSLRuntime {
  private strategies: Map<string, StrategyDefinition> = new Map();
  private customIndicators: Map<string, IndicatorFunction> = new Map();
  private ruleExecutionCount: Map<string, number> = new Map();
  private ruleLastExecution: Map<string, number> = new Map();

  constructor() {
    logger.info('DSL Runtime initialized');
  }

  registerStrategy(strategy: StrategyDefinition): void {
    this.validateStrategy(strategy);
    this.strategies.set(strategy.id, strategy);
    logger.info('Strategy registered', { id: strategy.id, name: strategy.name, rules: strategy.rules.length });
  }

  registerIndicator(name: string, fn: IndicatorFunction): void {
    this.customIndicators.set(name, fn);
    logger.info('Custom indicator registered', { name });
  }

  getStrategy(id: string): StrategyDefinition | undefined {
    return this.strategies.get(id);
  }

  listStrategies(): StrategyDefinition[] {
    return Array.from(this.strategies.values());
  }

  removeStrategy(id: string): boolean {
    return this.strategies.delete(id);
  }

  async evaluate(strategyId: string, context: StrategyContext): Promise<StrategySignal[]> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    this.computeIndicators(strategy, context);

    const signals: StrategySignal[] = [];

    const sortedRules = [...strategy.rules]
      .filter(r => r.enabled !== false)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of sortedRules) {
      const ruleKey = `${strategyId}:${rule.name}`;
      
      if (rule.cooldownMs) {
        const lastExec = this.ruleLastExecution.get(ruleKey) || 0;
        if (Date.now() - lastExec < rule.cooldownMs) {
          continue;
        }
      }

      if (rule.maxExecutions) {
        const execCount = this.ruleExecutionCount.get(ruleKey) || 0;
        if (execCount >= rule.maxExecutions) {
          continue;
        }
      }

      const conditionsMet = this.evaluateConditions(rule, context);

      if (conditionsMet) {
        for (const action of rule.actions) {
          signals.push({
            strategyId,
            ruleName: rule.name,
            symbol: context.symbol,
            action,
            timestamp: context.timestamp,
            confidence: this.calculateConfidence(rule, context),
            reasoning: `Rule "${rule.name}" triggered: ${rule.description || 'Conditions met'}`,
            metadata: {
              currentPrice: context.currentPrice,
              position: context.position,
            },
          });
        }

        this.ruleLastExecution.set(ruleKey, Date.now());
        this.ruleExecutionCount.set(ruleKey, (this.ruleExecutionCount.get(ruleKey) || 0) + 1);
      }
    }

    return signals;
  }

  private computeIndicators(strategy: StrategyDefinition, context: StrategyContext): void {
    const indicatorsNeeded = new Set<string>();

    for (const rule of strategy.rules) {
      for (const condition of rule.conditions) {
        if (condition.type === 'indicator' && condition.indicator) {
          indicatorsNeeded.add(condition.indicator);
        }
      }
    }

    for (const indicatorName of indicatorsNeeded) {
      if (context.indicators.has(indicatorName)) continue;

      // Parse indicator name, handling compound names like "bollinger_upper_20_2"
      const { baseName, params: defaultParams } = this.parseIndicatorName(indicatorName);
      
      // Apply parameter overrides from context.parameters
      const resolvedParams = this.resolveIndicatorParams(baseName, defaultParams, context.parameters);
      
      const fn = this.customIndicators.get(baseName) || BUILT_IN_INDICATORS[baseName];
      if (fn) {
        const values = fn(context.bars, ...resolvedParams);
        // Store under the original key that rules reference
        context.indicators.set(indicatorName, values);
      }
    }
  }

  private parseIndicatorName(indicatorName: string): { baseName: string; params: number[] } {
    // Known compound indicator names (base names that contain underscores)
    const compoundIndicators = ['bollinger_upper', 'bollinger_lower', 'volume_sma'];
    
    // Check for compound indicator names first
    for (const compound of compoundIndicators) {
      if (indicatorName.startsWith(compound)) {
        const suffix = indicatorName.slice(compound.length);
        if (suffix === '' || suffix.startsWith('_')) {
          const paramStrs = suffix ? suffix.slice(1).split('_') : [];
          const params = paramStrs.map(p => parseFloat(p)).filter(n => !isNaN(n));
          return { baseName: compound, params };
        }
      }
    }
    
    // Standard parsing: first segment is name, rest are params
    const parts = indicatorName.split('_');
    const baseName = parts[0];
    const params = parts.slice(1).map(p => parseFloat(p)).filter(n => !isNaN(n));
    
    return { baseName, params };
  }

  private resolveIndicatorParams(
    indicatorName: string,
    defaultParams: number[],
    parameters: Record<string, unknown>
  ): number[] {
    const resolved = [...defaultParams];
    
    // Map indicator names to parameter keys
    const paramMappings: Record<string, string[]> = {
      sma: ['sma_period', 'period'],
      ema: ['ema_period', 'period'],
      rsi: ['rsi_period', 'period'],
      macd: ['macd_fast', 'macd_slow', 'macd_signal'],
      bollinger_upper: ['bollinger_period', 'bollinger_stddev'],
      bollinger_lower: ['bollinger_period', 'bollinger_stddev'],
      atr: ['atr_period', 'period'],
      volume_sma: ['volume_sma_period'],
    };

    const mappings = paramMappings[indicatorName] || [];
    
    for (let i = 0; i < mappings.length; i++) {
      const paramKey = mappings[i];
      if (paramKey in parameters) {
        const value = parameters[paramKey];
        if (typeof value === 'number') {
          resolved[i] = value;
        }
      }
      // Also check generic indicator_param format (e.g., 'rsi_0' for first param)
      const genericKey = `${indicatorName}_${i}`;
      if (genericKey in parameters) {
        const value = parameters[genericKey];
        if (typeof value === 'number') {
          resolved[i] = value;
        }
      }
    }

    return resolved;
  }

  private evaluateConditions(rule: StrategyRule, context: StrategyContext): boolean {
    const logic = rule.conditionLogic || 'and';
    
    if (logic === 'and') {
      return rule.conditions.every(c => this.evaluateCondition(c, context));
    } else {
      return rule.conditions.some(c => this.evaluateCondition(c, context));
    }
  }

  private evaluateCondition(condition: StrategyCondition, context: StrategyContext): boolean {
    let leftValue: number;
    let rightValue: number;

    switch (condition.type) {
      case 'price':
        leftValue = context.currentPrice;
        break;
      case 'indicator':
        if (!condition.indicator) return false;
        const values = context.indicators.get(condition.indicator);
        if (!values || values.length === 0) return false;
        leftValue = values[values.length - 1];
        if (isNaN(leftValue)) return false;
        break;
      case 'volume':
        leftValue = context.bars.length > 0 ? context.bars[context.bars.length - 1].volume : 0;
        break;
      case 'time':
        leftValue = context.timestamp.getHours() * 60 + context.timestamp.getMinutes();
        break;
      default:
        return false;
    }

    if (typeof condition.value === 'object' && 'type' in condition.value) {
      const nestedResult = this.evaluateCondition(condition.value, context);
      rightValue = nestedResult ? 1 : 0;
    } else if (typeof condition.value === 'string' && condition.value.startsWith('indicator:')) {
      const indicatorName = condition.value.slice(10);
      const values = context.indicators.get(indicatorName);
      if (!values || values.length === 0) return false;
      rightValue = values[values.length - 1];
    } else if (typeof condition.value === 'string' && condition.value.startsWith('param:')) {
      // Support parameterized thresholds: 'param:rsi_oversold' -> context.parameters.rsi_oversold
      const paramKey = condition.value.slice(6);
      const paramValue = context.parameters[paramKey];
      rightValue = typeof paramValue === 'number' ? paramValue : parseFloat(String(paramValue)) || 0;
    } else {
      rightValue = typeof condition.value === 'number' ? condition.value : parseFloat(condition.value as string) || 0;
    }

    switch (condition.operator) {
      case '>': return leftValue > rightValue;
      case '<': return leftValue < rightValue;
      case '>=': return leftValue >= rightValue;
      case '<=': return leftValue <= rightValue;
      case '==': return Math.abs(leftValue - rightValue) < 0.0001;
      case '!=': return Math.abs(leftValue - rightValue) >= 0.0001;
      case 'crosses_above': {
        const prevLeft = this.getPreviousValue(condition, context);
        const prevRight = this.getPreviousRightValue(condition, context);
        return !isNaN(prevLeft) && !isNaN(prevRight) && prevLeft <= prevRight && leftValue > rightValue;
      }
      case 'crosses_below': {
        const prevLeftVal = this.getPreviousValue(condition, context);
        const prevRightVal = this.getPreviousRightValue(condition, context);
        return !isNaN(prevLeftVal) && !isNaN(prevRightVal) && prevLeftVal >= prevRightVal && leftValue < rightValue;
      }
      default:
        return false;
    }
  }

  private getPreviousValue(condition: StrategyCondition, context: StrategyContext): number {
    if (condition.type === 'indicator' && condition.indicator) {
      const values = context.indicators.get(condition.indicator);
      if (values && values.length >= 2) {
        return values[values.length - 2];
      }
    } else if (condition.type === 'price' && context.bars.length >= 2) {
      return context.bars[context.bars.length - 2].close;
    }
    return NaN;
  }

  private getPreviousRightValue(condition: StrategyCondition, context: StrategyContext): number {
    if (typeof condition.value === 'string' && condition.value.startsWith('indicator:')) {
      const indicatorName = condition.value.slice(10);
      const values = context.indicators.get(indicatorName);
      if (values && values.length >= 2) {
        return values[values.length - 2];
      }
      return NaN;
    }
    return typeof condition.value === 'number' ? condition.value : parseFloat(condition.value as string) || NaN;
  }

  private calculateConfidence(rule: StrategyRule, context: StrategyContext): number {
    let confidence = 0.5;
    
    if (context.bars.length >= 50) {
      confidence += 0.1;
    }

    const rsi = context.indicators.get('rsi_14');
    if (rsi && rsi.length > 0) {
      const currentRsi = rsi[rsi.length - 1];
      if (!isNaN(currentRsi)) {
        if (currentRsi < 30 || currentRsi > 70) {
          confidence += 0.1;
        }
      }
    }

    if (rule.conditions.length >= 3) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  private resolveParameters(
    strategy: StrategyDefinition,
    overrides: Record<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    if (strategy.parameters) {
      for (const [name, config] of Object.entries(strategy.parameters)) {
        resolved[name] = config.default;
      }
    }

    for (const [name, value] of Object.entries(overrides)) {
      resolved[name] = value;
    }

    return resolved;
  }

  async backtest(
    strategyId: string,
    bars: StrategyContext['bars'],
    parametersOrOptions: Record<string, number> | {
      initialCapital?: number;
      commissionPercent?: number;
      slippagePercent?: number;
      parameterOverrides?: Record<string, unknown>;
    } = {},
    options: {
      initialCapital?: number;
      commissionPercent?: number;
      slippagePercent?: number;
    } = {}
  ): Promise<BacktestResult> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    let parameterOverrides: Record<string, unknown> = {};
    let initialCapital: number;
    let commission: number;
    let slippage: number;

    if ('initialCapital' in parametersOrOptions || 'commissionPercent' in parametersOrOptions || 
        'slippagePercent' in parametersOrOptions || 'parameterOverrides' in parametersOrOptions) {
      const legacyOptions = parametersOrOptions as {
        initialCapital?: number;
        commissionPercent?: number;
        slippagePercent?: number;
        parameterOverrides?: Record<string, unknown>;
      };
      initialCapital = legacyOptions.initialCapital || 100000;
      commission = legacyOptions.commissionPercent || 0.001;
      slippage = legacyOptions.slippagePercent || 0.0005;
      parameterOverrides = legacyOptions.parameterOverrides || {};
    } else {
      parameterOverrides = parametersOrOptions as Record<string, number>;
      initialCapital = options.initialCapital || 100000;
      commission = options.commissionPercent || 0.001;
      slippage = options.slippagePercent || 0.0005;
    }

    let cash = initialCapital;
    let position: { quantity: number; entryPrice: number; side: 'long' | 'short'; entryTime: Date } | null = null;
    const trades: BacktestResult['trades'] = [];
    let maxEquity = initialCapital;
    let maxDrawdown = 0;

    const symbol = strategy.symbols[0] || 'UNKNOWN';

    const resolvedParameters = this.resolveParameters(strategy, parameterOverrides);

    for (let i = 50; i < bars.length; i++) {
      const currentBars = bars.slice(0, i + 1);
      const currentBar = bars[i];

      const context: StrategyContext = {
        symbol,
        currentPrice: currentBar.close,
        timestamp: currentBar.timestamp,
        bars: currentBars,
        position: position ? {
          side: position.side,
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          unrealizedPnl: (currentBar.close - position.entryPrice) * position.quantity * (position.side === 'long' ? 1 : -1),
        } : { side: 'flat', quantity: 0, entryPrice: 0, unrealizedPnl: 0 },
        account: { cash, equity: cash, buyingPower: cash },
        indicators: new Map(),
        parameters: resolvedParameters,
        state: {},
      };

      const signals = await this.evaluate(strategyId, context);

      for (const signal of signals) {
        if (signal.action.type === 'buy' && !position) {
          const price = currentBar.close * (1 + slippage);
          const quantity = Math.floor((cash * 0.95) / price);
          if (quantity > 0) {
            const cost = quantity * price * (1 + commission);
            cash -= cost;
            position = { quantity, entryPrice: price, side: 'long', entryTime: currentBar.timestamp };
          }
        } else if (signal.action.type === 'sell' && position && position.side === 'long') {
          const price = currentBar.close * (1 - slippage);
          const proceeds = position.quantity * price * (1 - commission);
          cash += proceeds;

          const pnl = proceeds - (position.quantity * position.entryPrice);
          trades.push({
            entryTime: position.entryTime,
            exitTime: currentBar.timestamp,
            side: 'long',
            entryPrice: position.entryPrice,
            exitPrice: price,
            quantity: position.quantity,
            pnl,
            pnlPercent: (pnl / (position.quantity * position.entryPrice)) * 100,
            rule: signal.ruleName,
          });

          position = null;
        } else if (signal.action.type === 'close' && position) {
          const price = currentBar.close * (1 - slippage);
          const proceeds = position.quantity * price * (1 - commission);
          cash += proceeds;

          const pnl = proceeds - (position.quantity * position.entryPrice);
          trades.push({
            entryTime: position.entryTime,
            exitTime: currentBar.timestamp,
            side: position.side,
            entryPrice: position.entryPrice,
            exitPrice: price,
            quantity: position.quantity,
            pnl,
            pnlPercent: (pnl / (position.quantity * position.entryPrice)) * 100,
            rule: signal.ruleName,
          });

          position = null;
        }
      }

      const equity = cash + (position ? position.quantity * currentBar.close : 0);
      maxEquity = Math.max(maxEquity, equity);
      const drawdown = (maxEquity - equity) / maxEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    if (position) {
      const lastBar = bars[bars.length - 1];
      cash += position.quantity * lastBar.close;
      trades.push({
        entryTime: position.entryTime,
        exitTime: lastBar.timestamp,
        side: position.side,
        entryPrice: position.entryPrice,
        exitPrice: lastBar.close,
        quantity: position.quantity,
        pnl: (lastBar.close - position.entryPrice) * position.quantity,
        pnlPercent: ((lastBar.close - position.entryPrice) / position.entryPrice) * 100,
        rule: 'end_of_backtest',
      });
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);

    return {
      strategyId,
      symbol,
      startDate: bars[0].timestamp,
      endDate: bars[bars.length - 1].timestamp,
      initialCapital,
      finalCapital: cash,
      totalReturn: cash - initialCapital,
      totalReturnPercent: ((cash - initialCapital) / initialCapital) * 100,
      maxDrawdown: maxDrawdown * initialCapital,
      maxDrawdownPercent: maxDrawdown * 100,
      sharpeRatio: this.calculateSharpeRatio(trades, initialCapital),
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      profitFactor: losingTrades.length > 0 
        ? Math.abs(winningTrades.reduce((a, t) => a + t.pnl, 0) / losingTrades.reduce((a, t) => a + t.pnl, 0))
        : winningTrades.length > 0 ? Infinity : 0,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      avgWin: winningTrades.length > 0 ? winningTrades.reduce((a, t) => a + t.pnl, 0) / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? losingTrades.reduce((a, t) => a + t.pnl, 0) / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0,
      avgHoldingPeriodMs: trades.length > 0 
        ? trades.reduce((a, t) => a + (t.exitTime.getTime() - t.entryTime.getTime()), 0) / trades.length
        : 0,
      trades,
    };
  }

  private calculateSharpeRatio(trades: BacktestResult['trades'], initialCapital: number): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => t.pnlPercent / 100);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;
    
    return (avgReturn / stdDev) * Math.sqrt(252);
  }

  private validateStrategy(strategy: StrategyDefinition): void {
    if (!strategy.id || !strategy.name) {
      throw new Error('Strategy must have id and name');
    }
    if (!strategy.rules || strategy.rules.length === 0) {
      throw new Error('Strategy must have at least one rule');
    }
    for (const rule of strategy.rules) {
      if (!rule.name || !rule.conditions || !rule.actions) {
        throw new Error(`Invalid rule: ${JSON.stringify(rule)}`);
      }
    }
  }

  parseStrategyFromJSON(json: string | object): StrategyDefinition {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    return data as StrategyDefinition;
  }

  exportStrategyToJSON(strategyId: string): string {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }
    return JSON.stringify(strategy, null, 2);
  }
}

export function createDSLRuntime(): DSLRuntime {
  return new DSLRuntime();
}

export type WalkForwardBacktestFn = (
  strategyId: string,
  bars: StrategyContext['bars'],
  parameters: Record<string, number>,
  options: { initialCapital: number; commissionPercent: number; slippagePercent: number }
) => Promise<BacktestResult>;

export function createBacktestAdapter(runtime: DSLRuntime): WalkForwardBacktestFn {
  return async (strategyId, bars, parameters, options) => {
    return runtime.backtest(strategyId, bars, parameters, options);
  };
}

export const EXAMPLE_STRATEGY: StrategyDefinition = {
  id: 'sma_crossover',
  name: 'SMA Crossover Strategy',
  version: '1.0.0',
  description: 'Classic moving average crossover strategy',
  symbols: ['AAPL'],
  timeframe: '1d',
  rules: [
    {
      name: 'Golden Cross',
      description: 'Buy when fast SMA crosses above slow SMA',
      conditions: [
        { type: 'indicator', indicator: 'sma_20', operator: 'crosses_above', value: 'indicator:sma_50' },
        { type: 'indicator', indicator: 'rsi_14', operator: '<', value: 70 },
      ],
      conditionLogic: 'and',
      actions: [{ type: 'buy', orderType: 'market' }],
      cooldownMs: 86400000,
    },
    {
      name: 'Death Cross',
      description: 'Sell when fast SMA crosses below slow SMA',
      conditions: [
        { type: 'indicator', indicator: 'sma_20', operator: 'crosses_below', value: 'indicator:sma_50' },
      ],
      actions: [{ type: 'close' }],
    },
  ],
  riskManagement: {
    stopLossPercent: 5,
    takeProfitPercent: 15,
    maxPositionPercent: 20,
  },
};
