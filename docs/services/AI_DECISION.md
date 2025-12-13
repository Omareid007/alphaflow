# AI Decision Service Specification

> **Domain:** Intelligence & Decision Generation  
> **Owner:** AI Team  
> **Status:** Design
>
> [INDEX.md](../INDEX.md) | Canonical: [AI_MODELS_AND_PROVIDERS.md](../AI_MODELS_AND_PROVIDERS.md), [API_REFERENCE.md](../API_REFERENCE.md), [ORCHESTRATOR_AND_AGENT_RUNTIME.md](../ORCHESTRATOR_AND_AGENT_RUNTIME.md)

---

## Service Overview

The AI Decision Service is the brain of the trading platform. It consumes market data, news, and position information to generate explainable trading decisions using LLM-powered analysis.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI DECISION SERVICE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   LLM Router    │  │  Data Fusion    │  │ Feature Store   │            │
│  │                 │  │                 │  │                 │            │
│  │ • Model select  │  │ • Aggregate     │  │ • Historical    │            │
│  │ • Fallback      │  │ • Normalize     │  │ • Real-time     │            │
│  │ • Rate limit    │  │ • Score         │  │ • Derived       │            │
│  │ • Cost optimize │  │ • Conflict res  │  │ • Embeddings    │            │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            │
│           │                    │                    │                      │
│           └────────────────────┴────────────────────┘                      │
│                                │                                            │
│                    ┌───────────▼───────────┐                               │
│                    │   Decision Engine     │                               │
│                    │   (Core Analysis)     │                               │
│                    └───────────┬───────────┘                               │
│                                │                                            │
│           ┌────────────────────┼────────────────────┐                      │
│           ▼                    ▼                    ▼                      │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                │
│  │   OpenAI    │      │    Groq     │      │  Together   │                │
│  │  gpt-4o     │      │  mixtral    │      │   llama     │                │
│  └─────────────┘      └─────────────┘      └─────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Specification

### REST Endpoints

#### Decision Generation

```yaml
# Generate Decision (Async - returns immediately with decision ID)
POST /api/v1/decisions/generate
Request:
  symbol: string (required)
  strategyId: string (required)
  context?: {
    marketCondition?: string
    newsContext?: string[]
    technicalIndicators?: object
  }
Response:
  decisionId: string
  status: "pending"
  estimatedTime: number (seconds)

# Get Decision
GET /api/v1/decisions/:decisionId
Response:
  decisionId: string
  symbol: string
  strategyId: string
  action: "BUY" | "SELL" | "HOLD"
  confidence: number (0-1)
  reasoning: string
  factors: Factor[]
  riskAssessment: RiskAssessment
  suggestedQuantity?: number
  suggestedPrice?: number
  stopLoss?: number
  takeProfit?: number
  status: "pending" | "completed" | "failed"
  createdAt: string
  completedAt?: string

# List Decisions
GET /api/v1/decisions?strategyId=xxx&symbol=AAPL&limit=50
Response:
  decisions: Decision[]
  nextCursor?: string

# Get Decision Features (for ML training)
GET /api/v1/decisions/:decisionId/features
Response:
  features: {
    technical: TechnicalFeatures
    fundamental: FundamentalFeatures
    sentiment: SentimentFeatures
    market: MarketFeatures
  }
```

#### Model Management

```yaml
# List Available Models
GET /api/v1/models
Response:
  models: [
    {
      id: "openai-gpt-4o",
      provider: "openai",
      capabilities: ["analysis", "reasoning"],
      costPer1kTokens: 0.01,
      latencyMs: 2000,
      available: true
    }
  ]

# Get Model Usage
GET /api/v1/models/usage?period=7d
Response:
  usage: [
    {
      modelId: "openai-gpt-4o",
      requests: 1500,
      tokens: 450000,
      cost: 4.50,
      avgLatencyMs: 1800
    }
  ]
```

#### Calibration

```yaml
# Trigger Calibration Analysis
POST /api/v1/calibration/analyze
Request:
  period: "7d" | "30d" | "90d"
Response:
  analysisId: string
  status: "started"

# Get Calibration Results
GET /api/v1/calibration/:analysisId
Response:
  analysisId: string
  period: string
  accuracy: number
  winRate: number
  profitFactor: number
  recommendations: Recommendation[]
  patterns: {
    winning: Pattern[]
    losing: Pattern[]
  }
```

### Event Subscriptions

| Event Type | Description | Action |
|------------|-------------|--------|
| `market.quote.received` | New price quote | Update context, check triggers |
| `market.news.published` | News article published | Sentiment analysis |
| `trade.position.updated` | Position changed | Update portfolio context |
| `orchestrator.analysis.requested` | Analysis requested | Generate decision |

### Event Publications

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `ai.decision.generated` | Decision completed | Full decision object |
| `ai.decision.validated` | Decision passed validation | Validation results |
| `ai.calibration.completed` | Calibration finished | Calibration report |
| `ai.model.switched` | Fallback model activated | Model info |

---

## Data Model

### Database Schema

```sql
-- ai schema
CREATE SCHEMA ai;

-- Decisions table
CREATE TABLE ai.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(10) NOT NULL,
  strategy_id UUID NOT NULL,
  action VARCHAR(4) NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD')),
  confidence DECIMAL(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT NOT NULL,
  model_id VARCHAR(50) NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER,
  
  -- Suggested trade parameters
  suggested_quantity DECIMAL(15, 4),
  suggested_price DECIMAL(15, 4),
  stop_loss DECIMAL(15, 4),
  take_profit DECIMAL(15, 4),
  
  -- Risk assessment
  risk_score DECIMAL(5, 4),
  volatility_assessment VARCHAR(20),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  executed BOOLEAN DEFAULT FALSE,
  execution_result VARCHAR(20),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Feature snapshot (for ML training)
  feature_snapshot JSONB
);

-- Decision Factors table
CREATE TABLE ai.decision_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES ai.decisions(id),
  factor_type VARCHAR(50) NOT NULL,
  factor_name VARCHAR(100) NOT NULL,
  value DECIMAL(15, 4),
  weight DECIMAL(5, 4),
  direction VARCHAR(10) CHECK (direction IN ('bullish', 'bearish', 'neutral')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calibration logs
CREATE TABLE ai.calibration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period VARCHAR(10) NOT NULL,
  accuracy DECIMAL(5, 4),
  win_rate DECIMAL(5, 4),
  profit_factor DECIMAL(10, 4),
  total_decisions INTEGER,
  winning_patterns JSONB,
  losing_patterns JSONB,
  recommendations JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_decisions_symbol ON ai.decisions(symbol);
CREATE INDEX idx_decisions_strategy ON ai.decisions(strategy_id);
CREATE INDEX idx_decisions_created ON ai.decisions(created_at);
CREATE INDEX idx_decisions_action ON ai.decisions(action);
CREATE INDEX idx_factors_decision ON ai.decision_factors(decision_id);
```

---

## LLM Router

### Model Selection Logic

```typescript
interface ModelSelectionCriteria {
  taskType: 'analysis' | 'summarization' | 'fast-decision';
  urgency: 'low' | 'medium' | 'high';
  costBudget: number;  // Max $ for this request
  requiredCapabilities: string[];
}

const MODEL_PRIORITY = [
  {
    id: 'openai-gpt-4o',
    provider: 'openai',
    costPer1kTokens: 0.01,
    latencyMs: 2000,
    capabilities: ['analysis', 'reasoning', 'function-calling'],
    rateLimit: 500  // requests/min
  },
  {
    id: 'groq-mixtral',
    provider: 'groq',
    costPer1kTokens: 0.0007,
    latencyMs: 500,
    capabilities: ['analysis', 'fast-decision'],
    rateLimit: 30
  },
  {
    id: 'together-llama',
    provider: 'together',
    costPer1kTokens: 0.0008,
    latencyMs: 800,
    capabilities: ['analysis', 'summarization'],
    rateLimit: 100
  }
];

function selectModel(criteria: ModelSelectionCriteria): Model {
  // 1. Filter by capabilities
  const capable = MODEL_PRIORITY.filter(m => 
    criteria.requiredCapabilities.every(c => m.capabilities.includes(c))
  );
  
  // 2. Filter by cost budget
  const affordable = capable.filter(m => 
    m.costPer1kTokens * 10 <= criteria.costBudget  // Assume ~10k tokens
  );
  
  // 3. Select by urgency
  if (criteria.urgency === 'high') {
    return affordable.sort((a, b) => a.latencyMs - b.latencyMs)[0];
  }
  
  // 4. Default: lowest cost
  return affordable.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0];
}
```

### Fallback Chain

```
OpenAI GPT-4o → Groq Mixtral → Together Llama → Local Cache
     ↓ (rate limit)     ↓ (rate limit)    ↓ (rate limit)    ↓
  Retry (5s)        Retry (2s)        Retry (1s)      Default HOLD
```

---

## Data Fusion Engine

### Input Sources

| Source | Data Type | Weight | Update Frequency |
|--------|-----------|--------|------------------|
| Alpaca | Price, Volume | 0.25 | Real-time |
| Finnhub | Fundamentals | 0.15 | Daily |
| NewsAPI | Headlines | 0.15 | Real-time |
| Technical Indicators | RSI, MACD, etc. | 0.25 | 1-minute |
| Sentiment | Social, News | 0.10 | 15-minute |
| Market Context | VIX, Sector | 0.10 | Real-time |

### Conflict Resolution

```typescript
interface DataPoint {
  source: string;
  value: number | string;
  confidence: number;
  timestamp: Date;
}

function resolveConflict(points: DataPoint[]): DataPoint {
  // Strategy: Weighted by recency and source reliability
  const weightedPoints = points.map(p => ({
    ...p,
    weight: p.confidence * getRecencyScore(p.timestamp) * SOURCE_RELIABILITY[p.source]
  }));
  
  // For numeric values: weighted average
  // For categorical: majority vote with weights
  return selectBestPoint(weightedPoints);
}
```

---

## Prompt Templates

### Trading Decision Prompt

```typescript
const DECISION_PROMPT = `
You are an expert quantitative trader analyzing {symbol} for the {strategy_name} strategy.

## Current Market Context
- Price: ${price} (${change_percent}% today)
- Volume: ${volume} (${volume_vs_avg}x average)
- Market Session: ${session}
- VIX: ${vix}

## Technical Indicators
${technical_indicators}

## Recent News (last 24h)
${news_summary}

## Current Position
${position_summary}

## Strategy Parameters
- Risk Mode: ${risk_mode}
- Max Position Size: ${max_position_pct}%
- Stop Loss: ${stop_loss_pct}%

## Task
Analyze the current market conditions and provide a trading decision.

Respond with JSON:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0-1.0,
  "reasoning": "Detailed explanation",
  "factors": [
    {"name": "factor_name", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0}
  ],
  "suggestedQuantity": number or null,
  "stopLoss": number or null,
  "takeProfit": number or null,
  "riskLevel": "low" | "medium" | "high"
}
`;
```

---

## Configuration

```yaml
ai-decision:
  server:
    port: 3002
    host: "0.0.0.0"
  
  llm:
    primary:
      provider: openai
      model: gpt-4o
      apiKey: ${OPENAI_API_KEY}
      maxTokens: 4096
      temperature: 0.3
    fallbacks:
      - provider: groq
        model: mixtral-8x7b-32768
        apiKey: ${GROQ_API_KEY}
      - provider: together
        model: meta-llama/Llama-3-70b-chat-hf
        apiKey: ${TOGETHER_API_KEY}
  
  dataFusion:
    sources:
      - name: alpaca
        weight: 0.25
        timeout: 5000
      - name: finnhub
        weight: 0.15
        timeout: 10000
      - name: newsapi
        weight: 0.15
        timeout: 10000
  
  calibration:
    schedule: "0 0 * * *"  # Daily at midnight
    minDecisions: 50       # Minimum decisions for analysis
  
  eventBus:
    url: ${NATS_URL}
    publishPrefix: "ai-trader.ai"
    subscriptions:
      - "ai-trader.market.*"
      - "ai-trader.trade.position.*"
      - "ai-trader.orchestrator.analysis.requested"
```

---

## Health & Metrics

### Health Endpoint

```json
GET /health
{
  "status": "healthy",
  "checks": {
    "database": "connected",
    "openai": "available",
    "groq": "available",
    "eventBus": "connected"
  },
  "activeModel": "openai-gpt-4o",
  "decisionsToday": 45,
  "avgLatencyMs": 1850
}
```

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `ai_decisions_total` | Counter | Total decisions by action |
| `ai_decision_latency_ms` | Histogram | Decision generation time |
| `ai_decision_confidence` | Histogram | Confidence score distribution |
| `ai_model_requests_total` | Counter | Requests per model |
| `ai_model_tokens_total` | Counter | Tokens consumed per model |
| `ai_model_cost_usd` | Counter | Cost per model |
| `ai_calibration_accuracy` | Gauge | Current accuracy score |
