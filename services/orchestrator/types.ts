/**
 * AI Active Trader - Orchestrator Service Types
 * Type definitions for trading cycles, sagas, and orchestration
 */

export enum OrchestratorMode {
  AUTONOMOUS = 'autonomous',
  SEMI_AUTO = 'semi_auto',
  MANUAL = 'manual',
}

export type CycleStatus = 'idle' | 'running' | 'paused' | 'completed';
export type SagaStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensating';
export type CycleType = 'analysis' | 'heartbeat' | 'rebalance';

export interface TradingCycle {
  cycleId: string;
  status: CycleStatus;
  startedAt: Date;
  completedAt?: Date;
  symbols: string[];
  decisionsCount: number;
  tradesCount: number;
  cycleType: CycleType;
}

export interface CycleConfig {
  symbols: string[];
  intervalMs: number;
  enabled: boolean;
  cycleType?: CycleType;
}

export interface SagaStep {
  stepId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  data?: Record<string, unknown>;
}

export interface SagaState {
  sagaId: string;
  type: string;
  currentStep: number;
  totalSteps: number;
  status: SagaStatus;
  steps: SagaStep[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  correlationId: string;
  initialData: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface OrchestratorState {
  mode: OrchestratorMode;
  currentCycle: TradingCycle | null;
  activeSagas: Map<string, SagaState>;
  lastActivityAt: Date | null;
}

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  supportedAssets: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface DecisionForExecution {
  decisionId: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string[];
}

export interface TradeExecutionSagaData {
  decisionId: string;
  symbol: string;
  action: 'buy' | 'sell';
  quantity?: number;
  orderId?: string;
}
