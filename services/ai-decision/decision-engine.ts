/**
 * AI Active Trader - Decision Engine
 * Generates trading decisions using simple heuristics
 * Can be enhanced later to call actual LLMs
 */

import { AIDecision, AIAction, RiskLevel, AnalysisRequest, MarketDataContext } from './types';
import { llmRouter } from './llm-router';
import { createLogger } from '../shared/common';

const logger = createLogger('ai-decision:decision-engine');

function generateDecisionId(): string {
  return `dec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function calculateConfidence(marketData?: MarketDataContext): number {
  if (!marketData || !marketData.currentPrice) {
    return 0.5;
  }

  let confidence = 0.6;

  if (marketData.fiftyDayMA && marketData.twoHundredDayMA) {
    confidence += 0.1;
  }
  if (marketData.volume && marketData.volume > 0) {
    confidence += 0.05;
  }
  if (marketData.changePercent !== undefined) {
    confidence += 0.05;
  }

  return Math.min(confidence, 0.95);
}

function determineAction(marketData?: MarketDataContext): { action: AIAction; reasoning: string[] } {
  const reasoning: string[] = [];
  
  if (!marketData || !marketData.currentPrice) {
    reasoning.push('Insufficient market data available');
    reasoning.push('Defaulting to HOLD recommendation');
    return { action: 'hold', reasoning };
  }

  const { currentPrice, fiftyDayMA, twoHundredDayMA, changePercent, volume } = marketData;

  if (fiftyDayMA && twoHundredDayMA) {
    if (fiftyDayMA > twoHundredDayMA) {
      reasoning.push('50-day MA above 200-day MA indicates bullish trend');
      
      if (currentPrice > fiftyDayMA) {
        reasoning.push('Price above 50-day MA confirms upward momentum');
        return { action: 'buy', reasoning };
      }
    } else {
      reasoning.push('50-day MA below 200-day MA indicates bearish trend');
      
      if (currentPrice < fiftyDayMA) {
        reasoning.push('Price below 50-day MA confirms downward momentum');
        return { action: 'sell', reasoning };
      }
    }
  }

  if (changePercent !== undefined) {
    if (changePercent > 3) {
      reasoning.push(`Strong positive momentum: ${changePercent.toFixed(2)}% gain`);
      reasoning.push('Consider taking profits or holding');
      return { action: 'hold', reasoning };
    } else if (changePercent < -3) {
      reasoning.push(`Significant decline: ${changePercent.toFixed(2)}% loss`);
      reasoning.push('Consider defensive position');
      return { action: 'sell', reasoning };
    }
  }

  if (volume !== undefined && volume > 0) {
    reasoning.push('Volume data available for confirmation');
  }

  reasoning.push('No strong directional signals detected');
  reasoning.push('Recommending HOLD until clearer trend emerges');
  return { action: 'hold', reasoning };
}

function determineRiskLevel(action: AIAction, confidence: number, marketData?: MarketDataContext): RiskLevel {
  if (confidence < 0.5) {
    return 'high';
  }

  if (action === 'hold') {
    return 'low';
  }

  if (marketData?.changePercent !== undefined) {
    const absChange = Math.abs(marketData.changePercent);
    if (absChange > 5) {
      return 'high';
    } else if (absChange > 2) {
      return 'medium';
    }
  }

  return confidence > 0.75 ? 'low' : 'medium';
}

function calculateSuggestedQuantity(
  action: AIAction, 
  confidence: number, 
  riskLevel: RiskLevel,
  currentPrice?: number
): number | undefined {
  if (action === 'hold' || !currentPrice) {
    return undefined;
  }

  const baseQuantity = 100;
  
  let multiplier = 1;
  if (confidence > 0.8) multiplier = 1.5;
  else if (confidence > 0.7) multiplier = 1.2;
  else if (confidence < 0.6) multiplier = 0.5;

  if (riskLevel === 'high') multiplier *= 0.5;
  else if (riskLevel === 'low') multiplier *= 1.2;

  return Math.round(baseQuantity * multiplier);
}

function calculateTargetPrice(
  action: AIAction,
  currentPrice?: number,
  riskLevel?: RiskLevel
): number | undefined {
  if (action === 'hold' || !currentPrice) {
    return undefined;
  }

  const targetPercent = riskLevel === 'low' ? 0.05 : riskLevel === 'medium' ? 0.08 : 0.12;

  if (action === 'buy') {
    return Number((currentPrice * (1 + targetPercent)).toFixed(2));
  } else {
    return Number((currentPrice * (1 - targetPercent)).toFixed(2));
  }
}

function calculateStopLoss(
  action: AIAction,
  currentPrice?: number,
  riskLevel?: RiskLevel
): number | undefined {
  if (action === 'hold' || !currentPrice) {
    return undefined;
  }

  const stopPercent = riskLevel === 'low' ? 0.02 : riskLevel === 'medium' ? 0.03 : 0.05;

  if (action === 'buy') {
    return Number((currentPrice * (1 - stopPercent)).toFixed(2));
  } else {
    return Number((currentPrice * (1 + stopPercent)).toFixed(2));
  }
}

export async function analyzeSymbol(
  symbol: string,
  marketData?: MarketDataContext
): Promise<AIDecision> {
  const decisionId = generateDecisionId();
  const startTime = Date.now();

  logger.info('Starting symbol analysis', { symbol, decisionId });

  const provider = llmRouter.selectBestProvider();
  const modelUsed = provider 
    ? `${provider.name}:${provider.defaultModel}` 
    : 'heuristics:v1';

  const confidence = calculateConfidence(marketData);
  const { action, reasoning } = determineAction(marketData);
  const riskLevel = determineRiskLevel(action, confidence, marketData);

  const decision: AIDecision = {
    decisionId,
    symbol: symbol.toUpperCase(),
    action,
    confidence,
    reasoning,
    riskLevel,
    suggestedQuantity: calculateSuggestedQuantity(action, confidence, riskLevel, marketData?.currentPrice),
    targetPrice: calculateTargetPrice(action, marketData?.currentPrice, riskLevel),
    stopLoss: calculateStopLoss(action, marketData?.currentPrice, riskLevel),
    modelUsed,
    generatedAt: new Date().toISOString(),
  };

  const duration = Date.now() - startTime;

  logger.info('Decision generated', {
    decisionId,
    symbol,
    action,
    confidence,
    riskLevel,
    modelUsed,
    durationMs: duration,
  });

  return decision;
}

export async function analyzeRequest(request: AnalysisRequest): Promise<AIDecision> {
  return analyzeSymbol(request.symbol, request.marketData);
}
