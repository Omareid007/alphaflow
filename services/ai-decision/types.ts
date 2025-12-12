/**
 * AI Active Trader - AI Decision Service Types
 * Types for LLM routing and trading decision generation
 */

export type AIAction = 'buy' | 'sell' | 'hold';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface AIDecision {
  decisionId: string;
  symbol: string;
  action: AIAction;
  confidence: number;
  reasoning: string[];
  riskLevel: RiskLevel;
  suggestedQuantity?: number;
  targetPrice?: number;
  stopLoss?: number;
  modelUsed: string;
  generatedAt: string;
}

export interface AnalysisRequest {
  symbol: string;
  marketData?: MarketDataContext;
  newsContext?: NewsContext;
  strategyContext?: StrategyContext;
}

export interface MarketDataContext {
  currentPrice?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  previousClose?: number;
  fiftyDayMA?: number;
  twoHundredDayMA?: number;
}

export interface NewsContext {
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  sentimentScore?: number;
  recentHeadlines?: string[];
  newsCount?: number;
}

export interface StrategyContext {
  strategyType?: string;
  riskTolerance?: RiskLevel;
  maxPositionSize?: number;
  currentPositions?: number;
}

export enum LLMProvider {
  OPENAI = 'openai',
  GROQ = 'groq',
  TOGETHER = 'together',
  AIMLAPI = 'aimlapi',
  OPENROUTER = 'openrouter',
}

export type CostTier = 'cheap' | 'moderate' | 'premium';
export type SpeedTier = 'fast' | 'moderate' | 'slow';
export type QualityTier = 'basic' | 'good' | 'excellent';

export interface ProviderStatus {
  name: LLMProvider;
  available: boolean;
  costTier: CostTier;
  speedTier: SpeedTier;
  qualityTier: QualityTier;
  defaultModel?: string;
}

export interface LLMRouterConfig {
  preferredProvider?: LLMProvider;
  fallbackEnabled?: boolean;
  prioritizeSpeed?: boolean;
  prioritizeCost?: boolean;
}
