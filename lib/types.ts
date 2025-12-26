export type StrategyStatus = 'Draft' | 'Backtested' | 'Deployed' | 'Paused' | 'Stopped';
export type DeploymentMode = 'paper' | 'live';
export type DeploymentStatus = 'active' | 'paused' | 'stopped';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'filled' | 'partial' | 'pending' | 'cancelled';
export type AiEventType = 'signal' | 'sentiment' | 'news' | 'risk' | 'suggestion';
export type FeedCategory = 'news' | 'social' | 'market' | 'fundamental';
export type FeedStatus = 'active' | 'delayed' | 'offline';
export type PresetName = 'Conservative' | 'Balanced' | 'Aggressive' | 'Custom';
export type FieldType = 'number' | 'text' | 'select' | 'range' | 'toggle' | 'multi-select';

export interface FieldConstraints {
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  default: string | number | boolean | string[];
  constraints?: FieldConstraints;
  helpText?: string;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  fields: Field[];
  advancedFields?: Field[];
}

export interface StepSchema {
  steps: WizardStep[];
}

export interface Preset {
  id: string;
  name: PresetName;
  description: string;
  valuesByFieldKey: Record<string, string | number | boolean | string[]>;
}

export interface AlgorithmTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  icon: string;
  stepSchema: StepSchema;
  presets: Preset[];
}

export interface PerformanceSummary {
  totalReturn: number;
  dayReturn: number;
  weekReturn: number;
  monthReturn: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
}

export interface RiskSummary {
  riskLevel: 'Low' | 'Medium' | 'High';
  volatility: number;
  exposure: number;
  var95: number;
}

export interface Strategy {
  id: string;
  name: string;
  templateId: string;
  status: StrategyStatus;
  configValues: Record<string, string | number | boolean | string[]>;
  performanceSummary?: PerformanceSummary;
  riskSummary?: RiskSummary;
  lastBacktestId?: string;
  deploymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BacktestMetrics {
  cagr: number;
  sharpe: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  exposure: number;
  totalTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}

export interface BacktestChartSeries {
  equityCurve: ChartDataPoint[];
  drawdown: ChartDataPoint[];
  returns: ChartDataPoint[];
}

export interface SuggestedEdit {
  fieldKey: string;
  currentValue: string | number | boolean | string[];
  suggestedValue: string | number | boolean | string[];
  rationale: string;
}

export interface Interpretation {
  summary: string;
  strengths: string[];
  risks: string[];
  suggestedEdits: SuggestedEdit[];
}

export interface BacktestRun {
  id: string;
  strategyId: string;
  strategyName: string;
  metrics: BacktestMetrics;
  chartSeries: BacktestChartSeries;
  interpretation: Interpretation;
  configSnapshot: Record<string, string | number | boolean | string[]>;
  createdAt: string;
}

export interface Deployment {
  id: string;
  strategyId: string;
  mode: DeploymentMode;
  status: DeploymentStatus;
  startedAt: string;
  lastHeartbeat: string;
}

export interface Allocation {
  symbol: string;
  name: string;
  weight: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

export interface PortfolioSnapshot {
  equity: number;
  cash: number;
  exposure: number;
  dayPL: number;
  dayPLPercent: number;
  weekPL: number;
  monthPL: number;
  drawdown: number;
  allocations: Allocation[];
  timestamp: string;
}

export interface LedgerEntry {
  id: string;
  time: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  price: number;
  fee: number;
  status: OrderStatus;
  strategyId: string;
  strategyName: string;
  realizedPnl?: number;
  unrealizedPnl?: number;
}

export interface AiEvent {
  id: string;
  time: string;
  type: AiEventType;
  headline: string;
  explanation: string;
  confidence: number;
  impactedStrategies: { id: string; name: string }[];
  symbol?: string;
  action?: string;
}

export interface FeedSource {
  id: string;
  name: string;
  category: FeedCategory;
  status: FeedStatus;
  lastUpdate: string;
}

export interface SentimentSignal {
  id: string;
  sourceId: string;
  sourceName: string;
  symbol: string;
  score: number;
  trend: 'up' | 'down' | 'neutral';
  explanation: string;
  timestamp: string;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  tags: string[];
  eligible: boolean;
}

export interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  notifications: {
    trades: boolean;
    aiAlerts: boolean;
    riskWarnings: boolean;
    dailyDigest: boolean;
  };
  riskGuardrails: {
    maxPositionSize: number;
    maxDrawdown: number;
    maxDailyLoss: number;
    requireConfirmation: boolean;
  };
}
