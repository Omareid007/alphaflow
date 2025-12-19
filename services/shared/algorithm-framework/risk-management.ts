/**
 * AI Active Trader - Risk Management Module
 * Monitors and manages portfolio risk
 */

import { createLogger } from '../common';
import type { 
  PortfolioTarget, 
  RiskAlert, 
  AlgorithmContext, 
  RiskManagementResult,
  RiskMetrics,
  Position
} from './types';

const logger = createLogger('risk-management');

export interface RiskModel {
  name: string;
  type: 'position' | 'portfolio' | 'market' | 'custom';
  evaluate: (targets: PortfolioTarget[], context: AlgorithmContext) => Promise<RiskEvaluation>;
}

export interface RiskEvaluation {
  passed: boolean;
  adjustments: Map<string, number>;
  alerts: RiskAlert[];
}

export interface RiskManagementConfig {
  models: RiskModel[];
  maxPortfolioRisk: number;
  maxPositionRisk: number;
  maxDrawdown: number;
  maxDailyLoss: number;
  maxConcentration: number;
  maxCorrelation: number;
  maxVaR95: number;
  stopLossPercent: number;
  trailingStopPercent: number;
  takeProfitPercent: number;
  volatilityTarget: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
}

const BUILT_IN_RISK_MODELS: Record<string, RiskModel> = {
  positionLimit: {
    name: 'positionLimit',
    type: 'position',
    evaluate: async (targets, context) => {
      const adjustments = new Map<string, number>();
      const alerts: RiskAlert[] = [];
      const maxPositionPct = (context.state.parameters.maxPositionPercent as number) || 0.2;

      for (const target of targets) {
        const security = context.state.securities.get(target.symbol);
        if (!security) continue;

        const positionValue = target.quantity * security.price;
        const positionPct = positionValue / context.state.portfolio.equity;

        if (positionPct > maxPositionPct) {
          const newQty = Math.floor((context.state.portfolio.equity * maxPositionPct) / security.price);
          adjustments.set(target.symbol, newQty);
          
          alerts.push({
            level: 'warning',
            type: 'position_size',
            message: `Position ${target.symbol} exceeds ${maxPositionPct * 100}% limit`,
            metric: positionPct * 100,
            threshold: maxPositionPct * 100,
            action: 'reduce',
          });
        }
      }

      return { passed: alerts.length === 0, adjustments, alerts };
    },
  },

  drawdownLimit: {
    name: 'drawdownLimit',
    type: 'portfolio',
    evaluate: async (targets, context) => {
      const alerts: RiskAlert[] = [];
      const maxDrawdown = (context.state.parameters.maxDrawdownPercent as number) || 0.1;
      const currentDrawdown = context.state.riskMetrics.currentDrawdown;

      if (currentDrawdown >= maxDrawdown) {
        alerts.push({
          level: 'critical',
          type: 'drawdown',
          message: `Drawdown ${(currentDrawdown * 100).toFixed(2)}% exceeds maximum`,
          metric: currentDrawdown * 100,
          threshold: maxDrawdown * 100,
          action: 'pause',
        });

        const adjustments = new Map<string, number>();
        for (const target of targets) {
          adjustments.set(target.symbol, 0);
        }
        return { passed: false, adjustments, alerts };
      }

      if (currentDrawdown >= maxDrawdown * 0.8) {
        alerts.push({
          level: 'warning',
          type: 'drawdown',
          message: `Drawdown ${(currentDrawdown * 100).toFixed(2)}% approaching maximum`,
          metric: currentDrawdown * 100,
          threshold: maxDrawdown * 100,
        });
      }

      return { passed: true, adjustments: new Map(), alerts };
    },
  },

  dailyLossLimit: {
    name: 'dailyLossLimit',
    type: 'portfolio',
    evaluate: async (targets, context) => {
      const alerts: RiskAlert[] = [];
      const maxDailyLoss = (context.state.parameters.maxDailyLossPercent as number) || 0.02;
      
      const dailyPnL = context.state.portfolio.totalUnrealizedPnL;
      const dailyLossPct = Math.abs(Math.min(0, dailyPnL)) / context.state.portfolio.equity;

      if (dailyLossPct >= maxDailyLoss) {
        alerts.push({
          level: 'critical',
          type: 'daily_loss',
          message: `Daily loss ${(dailyLossPct * 100).toFixed(2)}% exceeds limit`,
          metric: dailyLossPct * 100,
          threshold: maxDailyLoss * 100,
          action: 'pause',
        });

        const adjustments = new Map<string, number>();
        for (const target of targets) {
          adjustments.set(target.symbol, 0);
        }
        return { passed: false, adjustments, alerts };
      }

      return { passed: true, adjustments: new Map(), alerts };
    },
  },

  concentrationLimit: {
    name: 'concentrationLimit',
    type: 'portfolio',
    evaluate: async (targets, context) => {
      const adjustments = new Map<string, number>();
      const alerts: RiskAlert[] = [];
      const maxConcentration = (context.state.parameters.maxConcentration as number) || 0.3;

      const sectorExposure = new Map<string, number>();
      
      for (const target of targets) {
        const security = context.state.securities.get(target.symbol);
        if (!security) continue;

        const sector = security.sector || 'Unknown';
        const positionValue = target.quantity * security.price;
        const positionPct = positionValue / context.state.portfolio.equity;

        const current = sectorExposure.get(sector) || 0;
        sectorExposure.set(sector, current + positionPct);
      }

      for (const [sector, exposure] of sectorExposure) {
        if (exposure > maxConcentration) {
          alerts.push({
            level: 'warning',
            type: 'concentration',
            message: `Sector ${sector} concentration ${(exposure * 100).toFixed(1)}% exceeds limit`,
            metric: exposure * 100,
            threshold: maxConcentration * 100,
            action: 'reduce',
          });

          const scaleFactor = maxConcentration / exposure;
          for (const target of targets) {
            const security = context.state.securities.get(target.symbol);
            if (security?.sector === sector) {
              adjustments.set(target.symbol, Math.floor(target.quantity * scaleFactor));
            }
          }
        }
      }

      return { passed: alerts.length === 0, adjustments, alerts };
    },
  },

  volatilityLimit: {
    name: 'volatilityLimit',
    type: 'portfolio',
    evaluate: async (targets, context) => {
      const adjustments = new Map<string, number>();
      const alerts: RiskAlert[] = [];
      const volTarget = (context.state.parameters.volatilityTarget as number) || 0.15;
      const maxVol = volTarget * 1.5;

      let portfolioVol = 0;
      let totalWeight = 0;

      for (const target of targets) {
        const security = context.state.securities.get(target.symbol);
        if (!security?.technicals?.volatility30d) continue;

        const positionValue = target.quantity * security.price;
        const weight = positionValue / context.state.portfolio.equity;
        portfolioVol += weight * security.technicals.volatility30d;
        totalWeight += weight;
      }

      portfolioVol = totalWeight > 0 ? portfolioVol / totalWeight : 0;

      if (portfolioVol > maxVol) {
        alerts.push({
          level: 'warning',
          type: 'volatility',
          message: `Portfolio volatility ${(portfolioVol * 100).toFixed(1)}% exceeds target`,
          metric: portfolioVol * 100,
          threshold: maxVol * 100,
          action: 'reduce',
        });

        const scaleFactor = volTarget / portfolioVol;
        for (const target of targets) {
          adjustments.set(target.symbol, Math.floor(target.quantity * scaleFactor));
        }
      }

      return { passed: alerts.length === 0, adjustments, alerts };
    },
  },

  stopLoss: {
    name: 'stopLoss',
    type: 'position',
    evaluate: async (targets, context) => {
      const adjustments = new Map<string, number>();
      const alerts: RiskAlert[] = [];
      const stopLossPct = (context.state.parameters.stopLossPercent as number) || 0.05;

      for (const [symbol, position] of context.state.portfolio.positions) {
        if (position.unrealizedPnLPercent <= -stopLossPct * 100) {
          adjustments.set(symbol, 0);
          
          alerts.push({
            level: 'critical',
            type: 'position_size',
            message: `Stop-loss triggered for ${symbol} at ${position.unrealizedPnLPercent.toFixed(2)}%`,
            metric: position.unrealizedPnLPercent,
            threshold: -stopLossPct * 100,
            action: 'liquidate',
          });
        }
      }

      return { passed: alerts.length === 0, adjustments, alerts };
    },
  },

  correlationRisk: {
    name: 'correlationRisk',
    type: 'portfolio',
    evaluate: async (targets, context) => {
      const alerts: RiskAlert[] = [];
      const maxCorr = (context.state.parameters.maxCorrelation as number) || 0.8;

      const corrRisk = context.state.riskMetrics.correlationRisk;
      if (corrRisk > maxCorr) {
        alerts.push({
          level: 'warning',
          type: 'correlation',
          message: `Portfolio correlation risk ${(corrRisk * 100).toFixed(1)}% is high`,
          metric: corrRisk * 100,
          threshold: maxCorr * 100,
          action: 'hedge',
        });
      }

      return { passed: alerts.length === 0, adjustments: new Map(), alerts };
    },
  },
};

export class RiskManagementModule {
  private config: RiskManagementConfig;
  private customModels: Map<string, RiskModel> = new Map();
  private alertHistory: RiskAlert[] = [];
  private circuitBreakerTripped: boolean = false;
  private circuitBreakerResetTime: number = 0;

  // Legacy hardcoded values (preserved for reference)
  // private readonly LEGACY_MAX_PORTFOLIO_RISK = 0.15;
  // private readonly LEGACY_MAX_POSITION_RISK = 0.02;
  // private readonly LEGACY_MAX_DRAWDOWN = 0.1;
  // private readonly LEGACY_MAX_DAILY_LOSS = 0.02;

  // NOTE: For dynamic risk adjustments based on market conditions (VIX, P&L, time),
  // use the DynamicRiskManager from server/services/dynamic-risk-manager.ts
  // This module focuses on portfolio-level risk models and constraints.
  // The DynamicRiskManager can be used to adjust the config values below before
  // constructing this module, or individual risk models can query it directly.

  constructor(config: Partial<RiskManagementConfig> = {}) {
    this.config = {
      models: config.models || [
        BUILT_IN_RISK_MODELS.positionLimit,
        BUILT_IN_RISK_MODELS.drawdownLimit,
        BUILT_IN_RISK_MODELS.dailyLossLimit,
        BUILT_IN_RISK_MODELS.stopLoss,
      ],
      maxPortfolioRisk: config.maxPortfolioRisk || 0.15,
      maxPositionRisk: config.maxPositionRisk || 0.02,
      maxDrawdown: config.maxDrawdown || 0.1,
      maxDailyLoss: config.maxDailyLoss || 0.02,
      maxConcentration: config.maxConcentration || 0.3,
      maxCorrelation: config.maxCorrelation || 0.8,
      maxVaR95: config.maxVaR95 || 0.05,
      stopLossPercent: config.stopLossPercent || 0.05,
      trailingStopPercent: config.trailingStopPercent || 0.03,
      takeProfitPercent: config.takeProfitPercent || 0.1,
      volatilityTarget: config.volatilityTarget || 0.15,
      enableCircuitBreaker: config.enableCircuitBreaker !== false,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 0.05,
    };
    logger.info('Risk Management Module initialized', { models: this.config.models.map(m => m.name) });
  }

  registerModel(model: RiskModel): void {
    this.customModels.set(model.name, model);
    logger.info('Custom risk model registered', { name: model.name, type: model.type });
  }

  getBuiltInModel(name: string): RiskModel | undefined {
    return BUILT_IN_RISK_MODELS[name];
  }

  async evaluate(targets: PortfolioTarget[], context: AlgorithmContext): Promise<RiskManagementResult> {
    const allAlerts: RiskAlert[] = [];
    let adjustedTargets = [...targets];

    if (this.circuitBreakerTripped) {
      if (Date.now() < this.circuitBreakerResetTime) {
        logger.warn('Circuit breaker active, blocking all trades');
        return {
          adjustedTargets: [],
          riskAlerts: [{
            level: 'critical',
            type: 'daily_loss',
            message: 'Circuit breaker active - all trading paused',
            metric: 0,
            threshold: this.config.circuitBreakerThreshold * 100,
            action: 'pause',
          }],
        };
      } else {
        this.circuitBreakerTripped = false;
        logger.info('Circuit breaker reset');
      }
    }

    context.state.parameters.maxPositionPercent = this.config.maxPositionRisk / 0.02 * 0.2;
    context.state.parameters.maxDrawdownPercent = this.config.maxDrawdown;
    context.state.parameters.maxDailyLossPercent = this.config.maxDailyLoss;
    context.state.parameters.maxConcentration = this.config.maxConcentration;
    context.state.parameters.volatilityTarget = this.config.volatilityTarget;
    context.state.parameters.stopLossPercent = this.config.stopLossPercent;
    context.state.parameters.maxCorrelation = this.config.maxCorrelation;

    const models = [
      ...this.config.models,
      ...Array.from(this.customModels.values()),
    ];

    for (const model of models) {
      try {
        const evaluation = await model.evaluate(adjustedTargets, context);
        allAlerts.push(...evaluation.alerts);

        if (evaluation.adjustments.size > 0) {
          adjustedTargets = adjustedTargets.map(target => {
            const newQty = evaluation.adjustments.get(target.symbol);
            if (newQty !== undefined) {
              return { ...target, quantity: newQty };
            }
            return target;
          }).filter(t => t.quantity > 0);
        }

        if (!evaluation.passed && evaluation.alerts.some(a => a.level === 'critical')) {
          logger.warn('Critical risk threshold breached', { model: model.name });
        }
      } catch (err) {
        logger.error('Risk model failed', err as Error, { model: model.name });
      }
    }

    if (this.config.enableCircuitBreaker) {
      const criticalAlerts = allAlerts.filter(a => a.level === 'critical');
      if (criticalAlerts.length >= 2) {
        this.tripCircuitBreaker();
        adjustedTargets = [];
      }
    }

    this.alertHistory.push(...allAlerts);
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-500);
    }

    logger.info('Risk evaluation complete', {
      original: targets.length,
      adjusted: adjustedTargets.length,
      alerts: allAlerts.length,
      critical: allAlerts.filter(a => a.level === 'critical').length,
    });

    return { adjustedTargets, riskAlerts: allAlerts };
  }

  calculateRiskMetrics(context: AlgorithmContext): RiskMetrics {
    const { positions, equity } = context.state.portfolio;
    
    let portfolioVol = 0;
    let portfolioBeta = 0;
    let totalWeight = 0;
    let maxWeight = 0;
    let top3Weight = 0;

    const weights: number[] = [];

    for (const [symbol, position] of positions) {
      const security = context.state.securities.get(symbol);
      if (!security) continue;

      const weight = position.marketValue / equity;
      weights.push(weight);
      totalWeight += weight;
      maxWeight = Math.max(maxWeight, weight);

      if (security.technicals?.volatility30d) {
        portfolioVol += weight * security.technicals.volatility30d;
      }
    }

    weights.sort((a, b) => b - a);
    top3Weight = weights.slice(0, 3).reduce((s, w) => s + w, 0);

    const var95 = portfolioVol * 1.645 * Math.sqrt(1 / 252);
    const var99 = portfolioVol * 2.326 * Math.sqrt(1 / 252);

    return {
      portfolioBeta,
      portfolioVolatility: portfolioVol,
      sharpeRatio: 0,
      maxDrawdown: context.state.riskMetrics.maxDrawdown,
      currentDrawdown: context.state.riskMetrics.currentDrawdown,
      valueAtRisk95: var95 * equity,
      valueAtRisk99: var99 * equity,
      concentration: top3Weight,
      correlationRisk: 0.5,
    };
  }

  tripCircuitBreaker(): void {
    this.circuitBreakerTripped = true;
    this.circuitBreakerResetTime = Date.now() + 3600000;
    logger.error('Circuit breaker tripped! Trading paused for 1 hour');
  }

  resetCircuitBreaker(): void {
    this.circuitBreakerTripped = false;
    this.circuitBreakerResetTime = 0;
    logger.info('Circuit breaker manually reset');
  }

  isCircuitBreakerActive(): boolean {
    return this.circuitBreakerTripped && Date.now() < this.circuitBreakerResetTime;
  }

  getAlertHistory(limit?: number): RiskAlert[] {
    return limit ? this.alertHistory.slice(-limit) : [...this.alertHistory];
  }

  clearAlertHistory(): void {
    this.alertHistory = [];
  }
}

export const createConservativeRisk = (): RiskManagementModule => {
  return new RiskManagementModule({
    maxDrawdown: 0.05,
    maxDailyLoss: 0.01,
    maxConcentration: 0.15,
    stopLossPercent: 0.03,
    volatilityTarget: 0.1,
    enableCircuitBreaker: true,
  });
};

export const createModerateRisk = (): RiskManagementModule => {
  return new RiskManagementModule({
    maxDrawdown: 0.1,
    maxDailyLoss: 0.02,
    maxConcentration: 0.25,
    stopLossPercent: 0.05,
    volatilityTarget: 0.15,
    enableCircuitBreaker: true,
  });
};

export const createAggressiveRisk = (): RiskManagementModule => {
  return new RiskManagementModule({
    maxDrawdown: 0.2,
    maxDailyLoss: 0.05,
    maxConcentration: 0.4,
    stopLossPercent: 0.1,
    volatilityTarget: 0.25,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 0.1,
  });
};
