/**
 * AI Active Trader - LLM Trading Governance
 * Prompt registry, guardrails, and evaluation harness for AI trading decisions
 * 
 * Features:
 * - Prompt template registry with versioning
 * - Trading guardrails and safety constraints
 * - Decision evaluation and scoring
 * - Audit trail for all LLM interactions
 * - Rate limiting and cost tracking
 * - Prompt injection protection
 */

import { createLogger } from '../common';

const logger = createLogger('llm-governance');

// Prompt template definition
export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  category: PromptCategory;
  template: string;
  variables: PromptVariable[];
  guardrails: GuardrailConfig[];
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export type PromptCategory = 
  | 'market_analysis'
  | 'trade_decision'
  | 'risk_assessment'
  | 'position_sizing'
  | 'exit_strategy'
  | 'sentiment_analysis'
  | 'news_interpretation';

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'array' | 'object';
  required: boolean;
  description: string;
  validation?: string;
}

// Guardrail configuration
export interface GuardrailConfig {
  id: string;
  type: GuardrailType;
  params: Record<string, unknown>;
  action: 'block' | 'warn' | 'modify';
  message: string;
}

export type GuardrailType =
  | 'max_position_size'
  | 'max_loss_limit'
  | 'prohibited_symbols'
  | 'trading_hours'
  | 'confidence_threshold'
  | 'sentiment_conflict'
  | 'volatility_limit'
  | 'concentration_limit'
  | 'prompt_injection'
  | 'output_validation';

// LLM request/response structures
export interface LLMRequest {
  requestId: string;
  templateId: string;
  variables: Record<string, unknown>;
  context: TradingContext;
  timestamp: Date;
}

export interface LLMResponse {
  requestId: string;
  rawOutput: string;
  parsedDecision?: TradingDecision;
  confidence: number;
  reasoning: string;
  tokensUsed: number;
  latencyMs: number;
  guardrailResults: GuardrailResult[];
  isBlocked: boolean;
  blockReason?: string;
}

export interface TradingContext {
  symbol: string;
  currentPrice: number;
  position?: {
    side: 'long' | 'short' | 'none';
    size: number;
    entryPrice: number;
    unrealizedPnL: number;
  };
  marketData: {
    volatility: number;
    trend: 'up' | 'down' | 'sideways';
    volume: number;
  };
  sentiment?: {
    score: number;
    sources: string[];
  };
  portfolio: {
    totalValue: number;
    cashAvailable: number;
    riskBudgetUsed: number;
  };
}

export interface TradingDecision {
  action: 'buy' | 'sell' | 'hold' | 'close';
  symbol: string;
  quantity?: number;
  positionSize?: number;
  confidence: number;
  reasoning: string;
  stopLoss?: number;
  takeProfit?: number;
  timeframe?: string;
  riskScore: number;
}

export interface GuardrailResult {
  guardrailId: string;
  type: GuardrailType;
  passed: boolean;
  action: 'block' | 'warn' | 'modify';
  message?: string;
  details?: Record<string, unknown>;
}

// Audit log entry
export interface AuditEntry {
  id: string;
  timestamp: Date;
  requestId: string;
  templateId: string;
  templateVersion: string;
  symbol: string;
  inputContext: TradingContext;
  rawPrompt: string;
  rawResponse: string;
  parsedDecision?: TradingDecision;
  guardrailResults: GuardrailResult[];
  wasBlocked: boolean;
  wasExecuted: boolean;
  executionResult?: {
    orderId?: string;
    fillPrice?: number;
    fillQuantity?: number;
  };
  tokensUsed: number;
  latencyMs: number;
  costEstimate: number;
}

// Evaluation metrics
export interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  sharpeRatio: number;
  profitFactor: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  totalDecisions: number;
  blockedDecisions: number;
  executedDecisions: number;
}

// Configuration
export interface GovernanceConfig {
  maxRequestsPerMinute: number;
  maxDailyTokens: number;
  minConfidenceThreshold: number;
  maxPositionSizePercent: number;
  maxLossPerTradePercent: number;
  prohibitedSymbols: string[];
  tradingHoursStart: number;
  tradingHoursEnd: number;
  costPerToken: number;
  auditRetentionDays: number;
}

const DEFAULT_CONFIG: GovernanceConfig = {
  maxRequestsPerMinute: 60,
  maxDailyTokens: 1000000,
  minConfidenceThreshold: 0.6,
  maxPositionSizePercent: 5,
  maxLossPerTradePercent: 2,
  prohibitedSymbols: [],
  tradingHoursStart: 4,   // 4 AM ET for pre-market
  tradingHoursEnd: 20,    // 8 PM ET for after-hours
  costPerToken: 0.00001,
  auditRetentionDays: 90,
};

// Default prompt templates
const DEFAULT_TEMPLATES: Omit<PromptTemplate, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'market-analysis-v1',
    name: 'Market Analysis',
    version: '1.0.0',
    category: 'market_analysis',
    template: `Analyze the current market conditions for {{symbol}}.

Current Price: \${{currentPrice}}
24h Change: {{priceChange}}%
Volatility: {{volatility}}
Volume: {{volume}}
Trend: {{trend}}

Technical Indicators:
{{technicalIndicators}}

Recent News:
{{recentNews}}

Provide a concise market analysis including:
1. Current market regime (trending, ranging, volatile)
2. Key support and resistance levels
3. Short-term outlook (1-5 days)
4. Risk factors to monitor

Format your response as JSON with keys: regime, support, resistance, outlook, risks`,
    variables: [
      { name: 'symbol', type: 'string', required: true, description: 'Trading symbol' },
      { name: 'currentPrice', type: 'number', required: true, description: 'Current price' },
      { name: 'priceChange', type: 'number', required: true, description: '24h price change' },
      { name: 'volatility', type: 'number', required: true, description: 'Current volatility' },
      { name: 'volume', type: 'number', required: true, description: 'Trading volume' },
      { name: 'trend', type: 'string', required: true, description: 'Market trend' },
      { name: 'technicalIndicators', type: 'string', required: false, description: 'Technical indicators summary' },
      { name: 'recentNews', type: 'string', required: false, description: 'Recent news headlines' },
    ],
    guardrails: [],
    maxTokens: 1000,
    temperature: 0.3,
    isActive: true,
  },
  {
    id: 'trade-decision-v1',
    name: 'Trade Decision',
    version: '1.0.0',
    category: 'trade_decision',
    systemPrompt: `You are an expert algorithmic trading system. You make data-driven decisions based on quantitative analysis. You are risk-aware and follow strict position sizing rules. Never recommend trades that exceed the specified risk limits.`,
    template: `Based on the following market data, make a trading decision for {{symbol}}.

=== MARKET DATA ===
Current Price: \${{currentPrice}}
Trend: {{trend}}
Volatility: {{volatility}}
RSI: {{rsi}}
MACD Signal: {{macdSignal}}

=== SENTIMENT ===
Sentiment Score: {{sentimentScore}} (-1 to +1)
News Headlines: {{newsHeadlines}}

=== CURRENT POSITION ===
Position: {{positionSide}}
Size: {{positionSize}} units
Entry Price: \${{entryPrice}}
Unrealized P&L: \${{unrealizedPnL}}

=== PORTFOLIO ===
Total Value: \${{portfolioValue}}
Cash Available: \${{cashAvailable}}
Risk Budget Used: {{riskBudgetUsed}}%

=== RISK LIMITS ===
Max Position Size: {{maxPositionSize}}% of portfolio
Max Loss Per Trade: {{maxLossPerTrade}}%

Provide your trading decision as JSON with the following structure:
{
  "action": "buy" | "sell" | "hold" | "close",
  "quantity": number (0 if hold),
  "confidence": number (0-1),
  "reasoning": "string explaining the decision",
  "stopLoss": number (price level),
  "takeProfit": number (price level),
  "riskScore": number (1-10, 10 being highest risk)
}`,
    variables: [
      { name: 'symbol', type: 'string', required: true, description: 'Trading symbol' },
      { name: 'currentPrice', type: 'number', required: true, description: 'Current price' },
      { name: 'trend', type: 'string', required: true, description: 'Market trend' },
      { name: 'volatility', type: 'number', required: true, description: 'Current volatility' },
      { name: 'rsi', type: 'number', required: false, description: 'RSI value' },
      { name: 'macdSignal', type: 'string', required: false, description: 'MACD signal' },
      { name: 'sentimentScore', type: 'number', required: false, description: 'Sentiment score' },
      { name: 'newsHeadlines', type: 'string', required: false, description: 'Recent news' },
      { name: 'positionSide', type: 'string', required: true, description: 'Current position side' },
      { name: 'positionSize', type: 'number', required: true, description: 'Current position size' },
      { name: 'entryPrice', type: 'number', required: false, description: 'Entry price' },
      { name: 'unrealizedPnL', type: 'number', required: false, description: 'Unrealized P&L' },
      { name: 'portfolioValue', type: 'number', required: true, description: 'Portfolio value' },
      { name: 'cashAvailable', type: 'number', required: true, description: 'Available cash' },
      { name: 'riskBudgetUsed', type: 'number', required: true, description: 'Risk budget used' },
      { name: 'maxPositionSize', type: 'number', required: true, description: 'Max position size %' },
      { name: 'maxLossPerTrade', type: 'number', required: true, description: 'Max loss per trade %' },
    ],
    guardrails: [
      {
        id: 'confidence-threshold',
        type: 'confidence_threshold',
        params: { minConfidence: 0.6 },
        action: 'block',
        message: 'Decision confidence below minimum threshold',
      },
      {
        id: 'position-size-limit',
        type: 'max_position_size',
        params: { maxPercent: 5 },
        action: 'modify',
        message: 'Position size exceeds maximum allowed',
      },
      {
        id: 'loss-limit',
        type: 'max_loss_limit',
        params: { maxPercent: 2 },
        action: 'block',
        message: 'Potential loss exceeds maximum allowed',
      },
    ],
    maxTokens: 500,
    temperature: 0.2,
    isActive: true,
  },
  {
    id: 'risk-assessment-v1',
    name: 'Risk Assessment',
    version: '1.0.0',
    category: 'risk_assessment',
    template: `Assess the risk of the proposed trade for {{symbol}}.

=== PROPOSED TRADE ===
Action: {{action}}
Quantity: {{quantity}}
Entry Price: \${{entryPrice}}
Stop Loss: \${{stopLoss}}
Take Profit: \${{takeProfit}}

=== MARKET CONDITIONS ===
Volatility: {{volatility}}
Trend: {{trend}}
Volume: {{volume}}
Liquidity Score: {{liquidityScore}}

=== PORTFOLIO CONTEXT ===
Current Exposure: {{currentExposure}}%
Correlation with Existing Positions: {{correlation}}
Sector Concentration: {{sectorConcentration}}%

Evaluate and provide a risk assessment as JSON:
{
  "riskScore": number (1-10),
  "riskFactors": ["string array of identified risks"],
  "recommendation": "proceed" | "reduce_size" | "reject",
  "suggestedAdjustments": {
    "quantity": number | null,
    "stopLoss": number | null,
    "takeProfit": number | null
  },
  "reasoning": "string"
}`,
    variables: [
      { name: 'symbol', type: 'string', required: true, description: 'Trading symbol' },
      { name: 'action', type: 'string', required: true, description: 'Trade action' },
      { name: 'quantity', type: 'number', required: true, description: 'Trade quantity' },
      { name: 'entryPrice', type: 'number', required: true, description: 'Entry price' },
      { name: 'stopLoss', type: 'number', required: false, description: 'Stop loss price' },
      { name: 'takeProfit', type: 'number', required: false, description: 'Take profit price' },
      { name: 'volatility', type: 'number', required: true, description: 'Current volatility' },
      { name: 'trend', type: 'string', required: true, description: 'Market trend' },
      { name: 'volume', type: 'number', required: false, description: 'Trading volume' },
      { name: 'liquidityScore', type: 'number', required: false, description: 'Liquidity score' },
      { name: 'currentExposure', type: 'number', required: true, description: 'Current exposure %' },
      { name: 'correlation', type: 'number', required: false, description: 'Position correlation' },
      { name: 'sectorConcentration', type: 'number', required: false, description: 'Sector concentration' },
    ],
    guardrails: [],
    maxTokens: 500,
    temperature: 0.2,
    isActive: true,
  },
];

/**
 * Prompt Registry - manages prompt templates with versioning
 */
export class PromptRegistry {
  private templates: Map<string, PromptTemplate> = new Map();
  private versionHistory: Map<string, PromptTemplate[]> = new Map();

  constructor() {
    this.loadDefaultTemplates();
  }

  private loadDefaultTemplates(): void {
    const now = new Date();
    for (const template of DEFAULT_TEMPLATES) {
      const fullTemplate: PromptTemplate = {
        ...template,
        createdAt: now,
        updatedAt: now,
      };
      this.templates.set(template.id, fullTemplate);
      this.versionHistory.set(template.id, [fullTemplate]);
    }
  }

  register(template: Omit<PromptTemplate, 'createdAt' | 'updatedAt'>): PromptTemplate {
    const now = new Date();
    const existing = this.templates.get(template.id);
    
    const fullTemplate: PromptTemplate = {
      ...template,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.templates.set(template.id, fullTemplate);
    
    const history = this.versionHistory.get(template.id) || [];
    history.push(fullTemplate);
    this.versionHistory.set(template.id, history);

    logger.info('Prompt template registered', {
      id: template.id,
      version: template.version,
      category: template.category,
    });

    return fullTemplate;
  }

  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  getByCategory(category: PromptCategory): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => t.category === category && t.isActive);
  }

  getVersion(id: string, version: string): PromptTemplate | undefined {
    const history = this.versionHistory.get(id);
    return history?.find(t => t.version === version);
  }

  getVersionHistory(id: string): PromptTemplate[] {
    return this.versionHistory.get(id) || [];
  }

  deactivate(id: string): void {
    const template = this.templates.get(id);
    if (template) {
      template.isActive = false;
      template.updatedAt = new Date();
    }
  }

  listAll(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  renderTemplate(id: string, variables: Record<string, unknown>): string {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    let rendered = template.template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value ?? ''));
    }

    return rendered;
  }
}

/**
 * Guardrail Engine - enforces safety constraints on LLM decisions
 */
export class GuardrailEngine {
  private config: GovernanceConfig;

  constructor(config?: Partial<GovernanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  evaluate(
    decision: TradingDecision,
    context: TradingContext,
    guardrails: GuardrailConfig[]
  ): GuardrailResult[] {
    const results: GuardrailResult[] = [];

    for (const guardrail of guardrails) {
      const result = this.evaluateGuardrail(guardrail, decision, context);
      results.push(result);
    }

    // Add default guardrails
    results.push(this.checkConfidenceThreshold(decision));
    results.push(this.checkPositionSize(decision, context));
    results.push(this.checkLossLimit(decision, context));
    results.push(this.checkProhibitedSymbols(decision));
    results.push(this.checkTradingHours());

    return results;
  }

  private evaluateGuardrail(
    guardrail: GuardrailConfig,
    decision: TradingDecision,
    context: TradingContext
  ): GuardrailResult {
    switch (guardrail.type) {
      case 'confidence_threshold':
        return this.checkConfidenceThreshold(decision, guardrail.params.minConfidence as number);
      case 'max_position_size':
        return this.checkPositionSize(decision, context, guardrail.params.maxPercent as number);
      case 'max_loss_limit':
        return this.checkLossLimit(decision, context, guardrail.params.maxPercent as number);
      case 'volatility_limit':
        return this.checkVolatilityLimit(context, guardrail.params.maxVolatility as number);
      default:
        return {
          guardrailId: guardrail.id,
          type: guardrail.type,
          passed: true,
          action: guardrail.action,
        };
    }
  }

  private checkConfidenceThreshold(
    decision: TradingDecision,
    threshold?: number
  ): GuardrailResult {
    const minConfidence = threshold ?? this.config.minConfidenceThreshold;
    const passed = decision.confidence >= minConfidence;

    return {
      guardrailId: 'confidence-threshold',
      type: 'confidence_threshold',
      passed,
      action: passed ? 'warn' : 'block',
      message: passed ? undefined : `Confidence ${decision.confidence.toFixed(2)} below threshold ${minConfidence}`,
      details: { confidence: decision.confidence, threshold: minConfidence },
    };
  }

  private checkPositionSize(
    decision: TradingDecision,
    context: TradingContext,
    maxPercent?: number
  ): GuardrailResult {
    const maxPositionPercent = maxPercent ?? this.config.maxPositionSizePercent;
    const positionValue = (decision.quantity || 0) * context.currentPrice;
    const positionPercent = (positionValue / context.portfolio.totalValue) * 100;
    const passed = positionPercent <= maxPositionPercent;

    return {
      guardrailId: 'position-size-limit',
      type: 'max_position_size',
      passed,
      action: passed ? 'warn' : 'modify',
      message: passed ? undefined : `Position size ${positionPercent.toFixed(1)}% exceeds max ${maxPositionPercent}%`,
      details: { positionPercent, maxPercent: maxPositionPercent },
    };
  }

  private checkLossLimit(
    decision: TradingDecision,
    context: TradingContext,
    maxPercent?: number
  ): GuardrailResult {
    const maxLossPercent = maxPercent ?? this.config.maxLossPerTradePercent;
    
    if (!decision.stopLoss || !decision.quantity) {
      return {
        guardrailId: 'loss-limit',
        type: 'max_loss_limit',
        passed: true,
        action: 'warn',
        message: 'No stop loss defined',
      };
    }

    const potentialLoss = Math.abs(context.currentPrice - decision.stopLoss) * decision.quantity;
    const lossPercent = (potentialLoss / context.portfolio.totalValue) * 100;
    const passed = lossPercent <= maxLossPercent;

    return {
      guardrailId: 'loss-limit',
      type: 'max_loss_limit',
      passed,
      action: passed ? 'warn' : 'block',
      message: passed ? undefined : `Potential loss ${lossPercent.toFixed(1)}% exceeds max ${maxLossPercent}%`,
      details: { lossPercent, maxPercent: maxLossPercent },
    };
  }

  private checkProhibitedSymbols(decision: TradingDecision): GuardrailResult {
    const isProhibited = this.config.prohibitedSymbols.includes(decision.symbol.toUpperCase());

    return {
      guardrailId: 'prohibited-symbols',
      type: 'prohibited_symbols',
      passed: !isProhibited,
      action: isProhibited ? 'block' : 'warn',
      message: isProhibited ? `Symbol ${decision.symbol} is prohibited` : undefined,
    };
  }

  private checkTradingHours(): GuardrailResult {
    const now = new Date();
    const hour = now.getHours();
    const inTradingHours = hour >= this.config.tradingHoursStart && hour < this.config.tradingHoursEnd;

    return {
      guardrailId: 'trading-hours',
      type: 'trading_hours',
      passed: inTradingHours,
      action: inTradingHours ? 'warn' : 'warn',
      message: inTradingHours ? undefined : 'Outside regular trading hours',
    };
  }

  private checkVolatilityLimit(
    context: TradingContext,
    maxVolatility?: number
  ): GuardrailResult {
    const maxVol = maxVolatility ?? 0.05;
    const passed = context.marketData.volatility <= maxVol;

    return {
      guardrailId: 'volatility-limit',
      type: 'volatility_limit',
      passed,
      action: passed ? 'warn' : 'modify',
      message: passed ? undefined : `Volatility ${context.marketData.volatility.toFixed(3)} exceeds limit ${maxVol}`,
    };
  }

  // Check for prompt injection attempts
  checkPromptInjection(input: string): GuardrailResult {
    const injectionPatterns = [
      /ignore\s+(previous|above|all)\s+(instructions|prompts)/i,
      /disregard\s+(your|the)\s+(instructions|rules)/i,
      /you\s+are\s+now\s+a/i,
      /pretend\s+(you\s+are|to\s+be)/i,
      /system\s*:\s*/i,
      /\[INST\]/i,
      /<<SYS>>/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(input)) {
        return {
          guardrailId: 'prompt-injection',
          type: 'prompt_injection',
          passed: false,
          action: 'block',
          message: 'Potential prompt injection detected',
          details: { pattern: pattern.source },
        };
      }
    }

    return {
      guardrailId: 'prompt-injection',
      type: 'prompt_injection',
      passed: true,
      action: 'warn',
    };
  }
}

/**
 * Audit Logger - tracks all LLM trading interactions
 */
export class AuditLogger {
  private entries: AuditEntry[] = [];
  private config: GovernanceConfig;

  constructor(config?: Partial<GovernanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  log(entry: Omit<AuditEntry, 'id'>): AuditEntry {
    const fullEntry: AuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.entries.push(fullEntry);
    this.pruneOldEntries();

    logger.info('Audit entry logged', {
      id: fullEntry.id,
      requestId: fullEntry.requestId,
      symbol: fullEntry.symbol,
      wasBlocked: fullEntry.wasBlocked,
      wasExecuted: fullEntry.wasExecuted,
    });

    return fullEntry;
  }

  private pruneOldEntries(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.auditRetentionDays);
    this.entries = this.entries.filter(e => e.timestamp > cutoffDate);
  }

  getEntry(id: string): AuditEntry | undefined {
    return this.entries.find(e => e.id === id);
  }

  getByRequestId(requestId: string): AuditEntry | undefined {
    return this.entries.find(e => e.requestId === requestId);
  }

  getBySymbol(symbol: string, limit?: number): AuditEntry[] {
    const filtered = this.entries.filter(e => e.symbol === symbol);
    return limit ? filtered.slice(-limit) : filtered;
  }

  getByDateRange(start: Date, end: Date): AuditEntry[] {
    return this.entries.filter(e => e.timestamp >= start && e.timestamp <= end);
  }

  getBlockedDecisions(limit?: number): AuditEntry[] {
    const blocked = this.entries.filter(e => e.wasBlocked);
    return limit ? blocked.slice(-limit) : blocked;
  }

  getExecutedDecisions(limit?: number): AuditEntry[] {
    const executed = this.entries.filter(e => e.wasExecuted);
    return limit ? executed.slice(-limit) : executed;
  }

  getRecentEntries(count: number): AuditEntry[] {
    return this.entries.slice(-count);
  }

  exportToJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}

/**
 * Evaluation Harness - measures LLM trading decision quality
 */
export class EvaluationHarness {
  private decisions: Array<{
    decision: TradingDecision;
    context: TradingContext;
    outcome?: {
      pnl: number;
      exitPrice: number;
      holdingPeriod: number;
    };
  }> = [];

  recordDecision(decision: TradingDecision, context: TradingContext): void {
    this.decisions.push({ decision, context });
  }

  recordOutcome(
    symbol: string,
    requestId: string,
    outcome: { pnl: number; exitPrice: number; holdingPeriod: number }
  ): void {
    const entry = this.decisions.find(
      d => d.decision.symbol === symbol && !d.outcome
    );
    if (entry) {
      entry.outcome = outcome;
    }
  }

  calculateMetrics(): EvaluationMetrics {
    const completedDecisions = this.decisions.filter(d => d.outcome);
    const totalDecisions = this.decisions.length;

    if (completedDecisions.length === 0) {
      return this.createEmptyMetrics(totalDecisions);
    }

    const outcomes = completedDecisions.map(d => d.outcome!);
    const wins = outcomes.filter(o => o.pnl > 0);
    const losses = outcomes.filter(o => o.pnl < 0);

    const totalPnL = outcomes.reduce((sum, o) => sum + o.pnl, 0);
    const avgPnL = totalPnL / outcomes.length;
    const avgWin = wins.length > 0 
      ? wins.reduce((sum, o) => sum + o.pnl, 0) / wins.length 
      : 0;
    const avgLoss = losses.length > 0 
      ? Math.abs(losses.reduce((sum, o) => sum + o.pnl, 0) / losses.length) 
      : 0;

    // Calculate returns for Sharpe ratio
    const returns = outcomes.map(o => o.pnl);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    for (const outcome of outcomes) {
      cumulative += outcome.pnl;
      if (cumulative > peak) peak = cumulative;
      const drawdown = (peak - cumulative) / Math.max(peak, 1);
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Profit factor
    const grossProfit = wins.reduce((sum, o) => sum + o.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, o) => sum + o.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Accuracy metrics
    const correctPredictions = completedDecisions.filter(d => {
      const predicted = d.decision.action === 'buy' || d.decision.action === 'sell';
      const actual = d.outcome!.pnl > 0;
      return predicted === actual;
    }).length;

    const blockedDecisions = this.decisions.filter(d => !d.outcome).length;

    return {
      accuracy: correctPredictions / completedDecisions.length,
      precision: wins.length / (wins.length + losses.filter(l => l.pnl < -avgLoss).length) || 0,
      recall: wins.length / completedDecisions.length,
      sharpeRatio,
      profitFactor,
      winRate: wins.length / outcomes.length,
      avgWin,
      avgLoss,
      maxDrawdown,
      totalDecisions,
      blockedDecisions,
      executedDecisions: completedDecisions.length,
    };
  }

  private createEmptyMetrics(totalDecisions: number): EvaluationMetrics {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      sharpeRatio: 0,
      profitFactor: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      maxDrawdown: 0,
      totalDecisions,
      blockedDecisions: totalDecisions,
      executedDecisions: 0,
    };
  }

  // Evaluate decision quality before execution
  evaluateDecisionQuality(
    decision: TradingDecision,
    context: TradingContext
  ): { score: number; feedback: string[] } {
    const feedback: string[] = [];
    let score = 50;

    // Confidence check
    if (decision.confidence >= 0.8) {
      score += 15;
      feedback.push('High confidence decision');
    } else if (decision.confidence < 0.5) {
      score -= 20;
      feedback.push('Low confidence - consider skipping');
    }

    // Risk-reward check
    if (decision.stopLoss && decision.takeProfit) {
      const risk = Math.abs(context.currentPrice - decision.stopLoss);
      const reward = Math.abs(decision.takeProfit - context.currentPrice);
      const rr = reward / risk;
      
      if (rr >= 2) {
        score += 20;
        feedback.push(`Good risk-reward ratio: ${rr.toFixed(1)}:1`);
      } else if (rr < 1) {
        score -= 15;
        feedback.push(`Poor risk-reward ratio: ${rr.toFixed(1)}:1`);
      }
    } else {
      score -= 10;
      feedback.push('Missing stop loss or take profit');
    }

    // Trend alignment
    if (
      (decision.action === 'buy' && context.marketData.trend === 'up') ||
      (decision.action === 'sell' && context.marketData.trend === 'down')
    ) {
      score += 10;
      feedback.push('Trade aligned with market trend');
    } else if (
      (decision.action === 'buy' && context.marketData.trend === 'down') ||
      (decision.action === 'sell' && context.marketData.trend === 'up')
    ) {
      score -= 15;
      feedback.push('Trade against market trend - higher risk');
    }

    // Volatility adjustment
    if (context.marketData.volatility > 0.03) {
      score -= 10;
      feedback.push('High volatility environment - consider smaller position');
    }

    // Risk score check
    if (decision.riskScore >= 8) {
      score -= 20;
      feedback.push('High risk score - extra caution advised');
    } else if (decision.riskScore <= 3) {
      score += 10;
      feedback.push('Low risk score');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      feedback,
    };
  }

  clear(): void {
    this.decisions = [];
  }
}

/**
 * Rate Limiter for LLM requests
 */
export class RateLimiter {
  private requestCounts: Map<string, number[]> = new Map();
  private tokenCounts: Map<string, number> = new Map();
  private config: GovernanceConfig;

  constructor(config?: Partial<GovernanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  canMakeRequest(key: string = 'default'): boolean {
    this.cleanOldRequests(key);
    const requests = this.requestCounts.get(key) || [];
    return requests.length < this.config.maxRequestsPerMinute;
  }

  recordRequest(key: string = 'default', tokens: number = 0): void {
    const requests = this.requestCounts.get(key) || [];
    requests.push(Date.now());
    this.requestCounts.set(key, requests);

    const dailyTokens = this.tokenCounts.get(this.getDayKey()) || 0;
    this.tokenCounts.set(this.getDayKey(), dailyTokens + tokens);
  }

  private cleanOldRequests(key: string): void {
    const requests = this.requestCounts.get(key) || [];
    const cutoff = Date.now() - 60000;
    const cleaned = requests.filter(t => t > cutoff);
    this.requestCounts.set(key, cleaned);
  }

  private getDayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  getRemainingRequests(key: string = 'default'): number {
    this.cleanOldRequests(key);
    const requests = this.requestCounts.get(key) || [];
    return Math.max(0, this.config.maxRequestsPerMinute - requests.length);
  }

  getDailyTokensUsed(): number {
    return this.tokenCounts.get(this.getDayKey()) || 0;
  }

  getRemainingDailyTokens(): number {
    return Math.max(0, this.config.maxDailyTokens - this.getDailyTokensUsed());
  }

  getEstimatedCost(): number {
    return this.getDailyTokensUsed() * this.config.costPerToken;
  }
}

/**
 * Main LLM Governance Controller
 */
export class LLMGovernanceController {
  private promptRegistry: PromptRegistry;
  private guardrailEngine: GuardrailEngine;
  private auditLogger: AuditLogger;
  private evaluationHarness: EvaluationHarness;
  private rateLimiter: RateLimiter;
  private config: GovernanceConfig;

  constructor(config?: Partial<GovernanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.promptRegistry = new PromptRegistry();
    this.guardrailEngine = new GuardrailEngine(config);
    this.auditLogger = new AuditLogger(config);
    this.evaluationHarness = new EvaluationHarness();
    this.rateLimiter = new RateLimiter(config);
  }

  // Prepare a request with all governance checks
  async prepareRequest(
    templateId: string,
    variables: Record<string, unknown>,
    context: TradingContext
  ): Promise<{ prompt: string; blocked: boolean; reason?: string }> {
    const template = this.promptRegistry.get(templateId);
    if (!template) {
      return { prompt: '', blocked: true, reason: `Template not found: ${templateId}` };
    }

    if (!this.rateLimiter.canMakeRequest()) {
      return { prompt: '', blocked: true, reason: 'Rate limit exceeded' };
    }

    // Check for prompt injection in variables
    for (const value of Object.values(variables)) {
      if (typeof value === 'string') {
        const injectionCheck = this.guardrailEngine.checkPromptInjection(value);
        if (!injectionCheck.passed) {
          return { prompt: '', blocked: true, reason: injectionCheck.message };
        }
      }
    }

    const prompt = this.promptRegistry.renderTemplate(templateId, variables);

    return { prompt, blocked: false };
  }

  // Process LLM response with guardrails
  processResponse(
    response: LLMResponse,
    context: TradingContext,
    template: PromptTemplate
  ): { decision: TradingDecision | null; blocked: boolean; results: GuardrailResult[] } {
    if (!response.parsedDecision) {
      return {
        decision: null,
        blocked: true,
        results: [{
          guardrailId: 'output-validation',
          type: 'output_validation',
          passed: false,
          action: 'block',
          message: 'Failed to parse LLM decision',
        }],
      };
    }

    const results = this.guardrailEngine.evaluate(
      response.parsedDecision,
      context,
      template.guardrails
    );

    const blocked = results.some(r => !r.passed && r.action === 'block');

    // Evaluate decision quality
    const quality = this.evaluationHarness.evaluateDecisionQuality(
      response.parsedDecision,
      context
    );

    logger.info('Response processed', {
      symbol: response.parsedDecision.symbol,
      action: response.parsedDecision.action,
      confidence: response.parsedDecision.confidence,
      blocked,
      qualityScore: quality.score,
      guardrailsPassed: results.filter(r => r.passed).length,
      guardrailsFailed: results.filter(r => !r.passed).length,
    });

    return {
      decision: blocked ? null : response.parsedDecision,
      blocked,
      results,
    };
  }

  // Record token usage
  recordUsage(tokens: number): void {
    this.rateLimiter.recordRequest('default', tokens);
  }

  // Get components for direct access
  getPromptRegistry(): PromptRegistry {
    return this.promptRegistry;
  }

  getGuardrailEngine(): GuardrailEngine {
    return this.guardrailEngine;
  }

  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  getEvaluationHarness(): EvaluationHarness {
    return this.evaluationHarness;
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  // Get usage statistics
  getStats(): {
    remainingRequests: number;
    dailyTokensUsed: number;
    remainingDailyTokens: number;
    estimatedCost: number;
    metrics: EvaluationMetrics;
  } {
    return {
      remainingRequests: this.rateLimiter.getRemainingRequests(),
      dailyTokensUsed: this.rateLimiter.getDailyTokensUsed(),
      remainingDailyTokens: this.rateLimiter.getRemainingDailyTokens(),
      estimatedCost: this.rateLimiter.getEstimatedCost(),
      metrics: this.evaluationHarness.calculateMetrics(),
    };
  }
}

// Factory function
export function createLLMGovernanceController(
  config?: Partial<GovernanceConfig>
): LLMGovernanceController {
  return new LLMGovernanceController(config);
}
