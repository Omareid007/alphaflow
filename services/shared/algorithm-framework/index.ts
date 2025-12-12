/**
 * AI Active Trader - Algorithm Framework
 * QuantConnect LEAN-inspired modular trading pipeline
 * 
 * Pipeline: Universe Selection → Alpha Generation → Portfolio Construction → Execution → Risk Management
 */

import { createLogger } from '../common';
import { UniverseSelectionModule, type UniverseFilter } from './universe-selection';
import { AlphaGenerationModule, type AlphaModel } from './alpha-generation';
import { PortfolioConstructionModule, type PortfolioConstructor } from './portfolio-construction';
import { ExecutionModule, type ExecutionAlgorithm } from './execution';
import { RiskManagementModule, type RiskModel } from './risk-management';
import type {
  Security,
  Insight,
  PortfolioTarget,
  OrderTicket,
  RiskAlert,
  AlgorithmContext,
  AlgorithmState,
  Portfolio,
  RiskMetrics,
} from './types';

export * from './types';
export * from './universe-selection';
export * from './alpha-generation';
export * from './portfolio-construction';
export * from './execution';
export * from './risk-management';

const logger = createLogger('algorithm-framework');

export interface AlgorithmFrameworkConfig {
  name: string;
  universeSelection?: UniverseSelectionModule;
  alphaGeneration?: AlphaGenerationModule;
  portfolioConstruction?: PortfolioConstructionModule;
  execution?: ExecutionModule;
  riskManagement?: RiskManagementModule;
  warmupPeriod?: number;
  tradingSchedule?: {
    startHour: number;
    endHour: number;
    tradingDays: number[];
  };
}

export interface AlgorithmResult {
  timestamp: Date;
  universeChanges: { additions: string[]; removals: string[] };
  insights: Insight[];
  targets: PortfolioTarget[];
  orders: OrderTicket[];
  riskAlerts: RiskAlert[];
  metrics: {
    processingTimeMs: number;
    securitiesAnalyzed: number;
    signalsGenerated: number;
    ordersCreated: number;
  };
}

export class AlgorithmFramework {
  private config: AlgorithmFrameworkConfig;
  private universeSelection: UniverseSelectionModule;
  private alphaGeneration: AlphaGenerationModule;
  private portfolioConstruction: PortfolioConstructionModule;
  private execution: ExecutionModule;
  private riskManagement: RiskManagementModule;
  
  private state: AlgorithmState;
  private warmupCount: number = 0;
  private lastRunTime: Date | null = null;
  private isRunning: boolean = false;

  constructor(config: AlgorithmFrameworkConfig) {
    this.config = config;
    
    this.universeSelection = config.universeSelection || new UniverseSelectionModule();
    this.alphaGeneration = config.alphaGeneration || new AlphaGenerationModule();
    this.portfolioConstruction = config.portfolioConstruction || new PortfolioConstructionModule();
    this.execution = config.execution || new ExecutionModule();
    this.riskManagement = config.riskManagement || new RiskManagementModule();

    this.state = this.initializeState();

    logger.info('Algorithm Framework initialized', { name: config.name });
  }

  private initializeState(): AlgorithmState {
    return {
      securities: new Map(),
      universe: new Set(),
      insights: [],
      targets: [],
      orders: [],
      portfolio: {
        cash: 100000,
        equity: 100000,
        margin: 0,
        buyingPower: 100000,
        positions: new Map(),
        totalUnrealizedPnL: 0,
        totalRealizedPnL: 0,
      },
      riskMetrics: {
        portfolioBeta: 0,
        portfolioVolatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        valueAtRisk95: 0,
        valueAtRisk99: 0,
        concentration: 0,
        correlationRisk: 0,
      },
      parameters: {},
      warmupComplete: false,
      tradingEnabled: true,
    };
  }

  async run(securities: Security[], currentTime: Date): Promise<AlgorithmResult> {
    const startTime = Date.now();
    
    if (this.isRunning) {
      throw new Error('Algorithm is already running');
    }

    this.isRunning = true;

    try {
      for (const security of securities) {
        this.state.securities.set(security.symbol, security);
      }

      const context = this.createContext(currentTime);

      if (!this.state.warmupComplete) {
        this.warmupCount++;
        if (this.warmupCount >= (this.config.warmupPeriod || 20)) {
          this.state.warmupComplete = true;
          logger.info('Warmup complete', { periods: this.warmupCount });
        } else {
          return this.emptyResult(currentTime, startTime);
        }
      }

      if (!this.isWithinTradingHours(currentTime)) {
        logger.debug('Outside trading hours');
        return this.emptyResult(currentTime, startTime);
      }

      if (!this.state.tradingEnabled) {
        logger.debug('Trading disabled');
        return this.emptyResult(currentTime, startTime);
      }

      const universeResult = await this.universeSelection.select(securities, context);
      
      for (const symbol of universeResult.additions) {
        this.state.universe.add(symbol);
      }
      for (const symbol of universeResult.removals) {
        this.state.universe.delete(symbol);
      }

      const universeSecurities = securities.filter(s => this.state.universe.has(s.symbol));

      const alphaResult = await this.alphaGeneration.generate(universeSecurities, context);
      this.state.insights = alphaResult.insights;

      const portfolioResult = await this.portfolioConstruction.construct(alphaResult.insights, context);

      const riskResult = await this.riskManagement.evaluate(portfolioResult.targets, context);
      this.state.targets = riskResult.adjustedTargets;

      const executionResult = await this.execution.execute(riskResult.adjustedTargets, context);
      this.state.orders = executionResult.orders;

      this.lastRunTime = currentTime;
      const processingTimeMs = Date.now() - startTime;

      logger.info('Algorithm cycle complete', {
        universe: this.state.universe.size,
        insights: alphaResult.insights.length,
        targets: riskResult.adjustedTargets.length,
        orders: executionResult.orders.length,
        alerts: riskResult.riskAlerts.length,
        processingTimeMs,
      });

      return {
        timestamp: currentTime,
        universeChanges: universeResult,
        insights: alphaResult.insights,
        targets: riskResult.adjustedTargets,
        orders: executionResult.orders,
        riskAlerts: riskResult.riskAlerts,
        metrics: {
          processingTimeMs,
          securitiesAnalyzed: universeSecurities.length,
          signalsGenerated: alphaResult.insights.length,
          ordersCreated: executionResult.orders.length,
        },
      };
    } finally {
      this.isRunning = false;
    }
  }

  private createContext(currentTime: Date): AlgorithmContext {
    return {
      currentTime,
      state: this.state,
      logger: {
        debug: (msg: string, meta?: Record<string, unknown>) => logger.debug(msg, meta),
        info: (msg: string, meta?: Record<string, unknown>) => logger.info(msg, meta),
        warn: (msg: string, meta?: Record<string, unknown>) => logger.warn(msg, meta),
        error: (msg: string, meta?: Record<string, unknown>) => logger.error(msg, undefined, meta),
      },
    };
  }

  private isWithinTradingHours(time: Date): boolean {
    if (!this.config.tradingSchedule) return true;

    const { startHour, endHour, tradingDays } = this.config.tradingSchedule;
    const day = time.getDay();
    const hour = time.getHours();

    if (!tradingDays.includes(day)) return false;
    if (hour < startHour || hour >= endHour) return false;

    return true;
  }

  private emptyResult(timestamp: Date, startTime: number): AlgorithmResult {
    return {
      timestamp,
      universeChanges: { additions: [], removals: [] },
      insights: [],
      targets: [],
      orders: [],
      riskAlerts: [],
      metrics: {
        processingTimeMs: Date.now() - startTime,
        securitiesAnalyzed: 0,
        signalsGenerated: 0,
        ordersCreated: 0,
      },
    };
  }

  updatePortfolio(portfolio: Partial<Portfolio>): void {
    Object.assign(this.state.portfolio, portfolio);
  }

  updateRiskMetrics(metrics: Partial<RiskMetrics>): void {
    Object.assign(this.state.riskMetrics, metrics);
  }

  setParameter(key: string, value: unknown): void {
    this.state.parameters[key] = value;
  }

  getParameter(key: string): unknown {
    return this.state.parameters[key];
  }

  enableTrading(): void {
    this.state.tradingEnabled = true;
    logger.info('Trading enabled');
  }

  disableTrading(): void {
    this.state.tradingEnabled = false;
    logger.info('Trading disabled');
  }

  getState(): AlgorithmState {
    return { ...this.state };
  }

  getUniverse(): string[] {
    return Array.from(this.state.universe);
  }

  getActiveInsights(): Insight[] {
    return this.alphaGeneration.getActiveInsights();
  }

  getCurrentTargets(): PortfolioTarget[] {
    return this.portfolioConstruction.getCurrentTargets();
  }

  getPendingOrders(): OrderTicket[] {
    return this.execution.getPendingOrders();
  }

  getRiskAlerts(limit?: number): RiskAlert[] {
    return this.riskManagement.getAlertHistory(limit);
  }

  onOrderFill(orderId: string, filledQty: number, avgPrice: number): void {
    this.execution.updateOrderStatus(orderId, 'filled', {
      filledQuantity: filledQty,
      averagePrice: avgPrice,
      filledAt: new Date(),
    });
  }

  onOrderReject(orderId: string, reason: string): void {
    this.execution.updateOrderStatus(orderId, 'rejected');
    logger.warn('Order rejected', { orderId, reason });
  }

  cancelAllOrders(): string[] {
    return this.execution.cancelAllPending();
  }

  reset(): void {
    this.state = this.initializeState();
    this.warmupCount = 0;
    this.lastRunTime = null;
    this.universeSelection.clearCache();
    this.alphaGeneration.clearInsights();
    this.portfolioConstruction.clearTargets();
    this.execution.clearHistory();
    this.riskManagement.clearAlertHistory();
    logger.info('Algorithm framework reset');
  }
}

export const createMomentumAlgorithm = (name: string = 'MomentumStrategy'): AlgorithmFramework => {
  const { createMomentumUniverse } = require('./universe-selection');
  const { createMomentumAlpha } = require('./alpha-generation');
  const { createMeanVariancePortfolio } = require('./portfolio-construction');
  const { createSmartExecution } = require('./execution');
  const { createModerateRisk } = require('./risk-management');

  return new AlgorithmFramework({
    name,
    universeSelection: createMomentumUniverse(),
    alphaGeneration: createMomentumAlpha(),
    portfolioConstruction: createMeanVariancePortfolio(),
    execution: createSmartExecution(),
    riskManagement: createModerateRisk(),
    warmupPeriod: 50,
    tradingSchedule: {
      startHour: 9,
      endHour: 16,
      tradingDays: [1, 2, 3, 4, 5],
    },
  });
};

export const createValueAlgorithm = (name: string = 'ValueStrategy'): AlgorithmFramework => {
  const { createValueUniverse } = require('./universe-selection');
  const { createMeanReversionAlpha } = require('./alpha-generation');
  const { createEqualWeightPortfolio } = require('./portfolio-construction');
  const { createImmediateExecution } = require('./execution');
  const { createConservativeRisk } = require('./risk-management');

  return new AlgorithmFramework({
    name,
    universeSelection: createValueUniverse(),
    alphaGeneration: createMeanReversionAlpha(),
    portfolioConstruction: createEqualWeightPortfolio(),
    execution: createImmediateExecution(),
    riskManagement: createConservativeRisk(),
    warmupPeriod: 100,
    tradingSchedule: {
      startHour: 9,
      endHour: 16,
      tradingDays: [1, 2, 3, 4, 5],
    },
  });
};

export const createMultiFactorAlgorithm = (name: string = 'MultiFactorStrategy'): AlgorithmFramework => {
  const { createLowVolatilityUniverse } = require('./universe-selection');
  const { createMultiFactorAlpha } = require('./alpha-generation');
  const { createRiskParityPortfolio } = require('./portfolio-construction');
  const { createSmartExecution } = require('./execution');
  const { createModerateRisk } = require('./risk-management');

  return new AlgorithmFramework({
    name,
    universeSelection: createLowVolatilityUniverse(),
    alphaGeneration: createMultiFactorAlpha(),
    portfolioConstruction: createRiskParityPortfolio(),
    execution: createSmartExecution(),
    riskManagement: createModerateRisk(),
    warmupPeriod: 60,
    tradingSchedule: {
      startHour: 9,
      endHour: 16,
      tradingDays: [1, 2, 3, 4, 5],
    },
  });
};
