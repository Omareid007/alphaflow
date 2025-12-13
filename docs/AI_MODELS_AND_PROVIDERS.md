# AI Models & Providers

> **Canonical document for LLM providers, model selection, intelligent routing, and AI decision transparency.**
>
> Start here: [INDEX.md](INDEX.md) | Related: [ORCHESTRATOR_AND_AGENT_RUNTIME.md](ORCHESTRATOR_AND_AGENT_RUNTIME.md) (runtime), [CONNECTORS_AND_INTEGRATIONS.md](CONNECTORS_AND_INTEGRATIONS.md) (data sources)

---

## Canonical References

| Topic | Go To |
|-------|-------|
| Trading agent runtime | [ORCHESTRATOR_AND_AGENT_RUNTIME.md](ORCHESTRATOR_AND_AGENT_RUNTIME.md) |
| External API connectors | [CONNECTORS_AND_INTEGRATIONS.md](CONNECTORS_AND_INTEGRATIONS.md) |
| Observability & tracing | [OBSERVABILITY.md](OBSERVABILITY.md) |
| AI agent governance | [AGENT_EXECUTION_GUIDE.md](AGENT_EXECUTION_GUIDE.md) |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Multi-Provider Architecture](#2-multi-provider-architecture)
3. [Provider Configuration](#3-provider-configuration)
4. [LLM Router](#4-llm-router)
5. [Data Sources & Enrichment](#5-data-sources--enrichment)
6. [Data Fusion Engine](#6-data-fusion-engine)
7. [Enhanced Decision Logging](#7-enhanced-decision-logging)
8. [Prompt Patterns](#8-prompt-patterns)
9. [Cost & Token Management](#9-cost--token-management)
10. [Testing AI Logic](#10-testing-ai-logic)
11. [Current State (December 2025)](#11-current-state-december-2025)
12. [Enhancements Compared to Previous Version](#12-enhancements-compared-to-previous-version)
13. [Old vs New - Summary of Changes](#13-old-vs-new---summary-of-changes)

---

## 1. Overview

AI Active Trader uses multiple AI providers and data sources to power trading decision support:

- **Multi-LLM Architecture**: OpenAI (primary), Groq, Together.ai, AIML API, OpenRouter
- **Data Fusion**: Combines market data, sentiment analysis, and fundamentals
- **Signal Enrichment**: Hugging Face FinBERT for financial sentiment
- **Explainable Decisions**: Full transparency into AI reasoning

**Key principle:** AI provides decision support, not autonomous execution. All AI outputs are validated and subject to risk limits before execution.

---

## 2. Multi-Provider Architecture

### 2.1 Provider Overview

| Provider | Purpose | Models | Pricing |
|----------|---------|--------|---------|
| **OpenAI** | Primary provider | GPT-4o-mini, GPT-4o | Premium |
| **Groq** | Ultra-fast inference | Llama 3.1 8B/70B/405B | $0.05-$3.00/1M tokens |
| **Together.ai** | 200+ open models | Llama, Mistral, etc. | $0.10-$0.27/1M tokens |
| **AIML API** | 400+ models | Various | Pay-as-you-go |
| **OpenRouter** | Fallback provider | Multiple providers | Variable |

### 2.2 File Locations

| Component | Location | Purpose |
|-----------|----------|---------|
| LLMClient Interface | `server/ai/llmClient.ts` | Provider-agnostic types |
| OpenAI Client | `server/ai/openaiClient.ts` | OpenAI implementation |
| Groq Client | `server/ai/groqClient.ts` | Groq implementation |
| Together.ai Client | `server/ai/togetherClient.ts` | Together.ai implementation |
| AIML API Client | `server/ai/aimlClient.ts` | AIML API implementation |
| OpenRouter Client | `server/ai/openrouterClient.ts` | OpenRouter implementation |
| LLM Router | `server/ai/llmRouter.ts` | Intelligent task routing |
| Provider Selection | `server/ai/index.ts` | Provider management |

---

## 3. Provider Configuration

### 3.1 Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI authentication | Yes (or OPENAI_API_KEY) |
| `GROQ_API_KEY` | Groq authentication | Optional |
| `TOGETHER_API_KEY` | Together.ai authentication | Optional |
| `AIMLAPI_KEY` | AIML API authentication | Optional |
| `OPENROUTER_API_KEY` | OpenRouter authentication | Optional |
| `AI_PROVIDER` | Override default provider | Optional |
| `VALYU_API_KEY` | Valyu.ai financial data | Optional |
| `HUGGINGFACE_API_KEY` | Hugging Face inference | Optional |

### 3.2 Default Configuration

```typescript
// OpenAI (Primary)
const openaiDefaults = {
  model: "gpt-4o-mini",
  temperature: 0.3,
  maxTokens: 1000,
};

// Groq (Fast & Cheap)
const groqDefaults = {
  model: "llama-3.1-8b-instant",
  temperature: 0.3,
  maxTokens: 1000,
};

// Together.ai
const togetherDefaults = {
  model: "meta-llama/Llama-3.2-3B-Instruct-Turbo",
  temperature: 0.3,
  maxTokens: 1000,
};
```

---

## 4. LLM Router

The LLM Router intelligently routes tasks to appropriate providers based on complexity, cost, and speed requirements.

### 4.1 Routing Priorities

| Priority | Strategy |
|----------|----------|
| **Speed** | Groq → Together.ai → AIML API → OpenAI |
| **Cost** | Groq → Together.ai → AIML API → OpenAI |
| **Quality** | OpenAI → OpenRouter → Together.ai → Groq |
| **Balanced** | Complexity-based selection |

### 4.2 Usage

```typescript
import { llmRouter, routedLLMCall } from "@/ai/index";

// Simple call with routing
const response = await routedLLMCall({
  system: "You are a trading analyst.",
  messages: [{ role: "user", content: "Analyze AAPL" }],
}, {
  priority: "balanced",
  complexity: "moderate",
});

// Check available providers
const providers = llmRouter.getAvailableProviders();
// Returns: ["openai", "groq", "together", ...]
```

### 4.3 Fallback Behavior

- If preferred provider fails, router automatically tries next provider
- Rate limit errors trigger exponential backoff and retry
- Auth errors skip provider and try next
- All providers failed → throws aggregated error

---

## 5. Data Sources & Enrichment

### 5.1 Market Data Connectors

| Connector | Data Type | Location |
|-----------|-----------|----------|
| Alpaca | Stocks, Crypto, Positions | `server/connectors/alpaca.ts` |
| Finnhub | Stock quotes, Company profiles | `server/connectors/finnhub.ts` |
| CoinGecko | Crypto prices, Market data | `server/connectors/coingecko.ts` |
| CoinMarketCap | Crypto rankings, Volume | `server/connectors/coinmarketcap.ts` |
| Valyu.ai | Earnings, Ratios, SEC filings | `server/connectors/valyu.ts` |

### 5.2 Valyu.ai Financial Data

Natural language queries for structured financial data:

```typescript
import { valyu } from "@/connectors/valyu";

// Get earnings data
const earnings = await valyu.getEarnings("AAPL");
// Returns: { symbol, eps, revenue, rawData }

// Get financial ratios
const ratios = await valyu.getFinancialRatios("AAPL");
// Returns: { symbol, peRatio, roe, debtToEquity, revenueGrowth }

// Get SEC filings
const filing = await valyu.getSECFiling("AAPL", "10-K");
// Returns: { symbol, filingType, content, url }
```

### 5.3 Hugging Face Sentiment Analysis

Financial sentiment analysis using FinBERT:

```typescript
import { huggingface } from "@/connectors/huggingface";

// Analyze single text
const sentiment = await huggingface.analyzeSentiment(
  "Apple reports record quarterly revenue",
  "finbert"
);
// Returns: [{ label: "positive", score: 0.92 }]

// Generate enrichment signal from headlines
const signal = await huggingface.generateEnrichmentSignal(
  "AAPL",
  ["Apple beats earnings", "Strong iPhone demand"],
  priceChange
);
// Returns: EnrichmentSignal with sentimentScore, trendStrength, etc.
```

---

## 6. Data Fusion Engine

The Data Fusion Engine combines multiple data sources into unified market intelligence.

### 6.1 Architecture

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Market Data   │  │   Sentiment     │  │  Fundamentals   │
│  (Alpaca, etc)  │  │  (HF FinBERT)   │  │  (Valyu.ai)     │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                  ┌─────────────────────┐
                  │  Data Fusion Engine │
                  │  - Weighted merge   │
                  │  - Conflict handling│
                  │  - Quality scoring  │
                  └──────────┬──────────┘
                              ▼
                  ┌─────────────────────┐
                  │ FusedMarketIntell   │
                  │ - Price confidence  │
                  │ - Signal agreement  │
                  │ - Trend strength    │
                  └─────────────────────┘
```

### 6.2 Usage

```typescript
import { fuseMarketData, formatForLLM } from "@/ai/data-fusion-engine";

const intelligence = fuseMarketData({
  symbol: "AAPL",
  assetType: "stock",
  marketData: [...],
  sentimentData: [...],
  fundamentalData: [...],
});

// Format for LLM prompt
const llmContext = formatForLLM(intelligence);
```

### 6.3 Output Structure

```typescript
interface FusedMarketIntelligence {
  symbol: string;
  assetType: "stock" | "crypto";
  price: { current, change, changePercent, confidence, sources };
  sentiment: { overall, score, confidence, agreementLevel, sources };
  fundamentals?: { eps, peRatio, revenueGrowth, confidence, sources };
  trendStrength: number;       // -1 to 1
  signalAgreement: number;     // 0 to 1
  dataQuality: { completeness, freshness, reliability };
  warnings: string[];
}
```

---

## 7. Enhanced Decision Logging

Full transparency into AI trading decisions.

### 7.1 Log Structure

```typescript
interface EnhancedDecisionLog {
  id: string;
  timestamp: Date;
  cycleId?: string;
  
  input: InputSnapshot;        // All inputs captured
  reasoning: {
    steps: ReasoningStep[];    // Step-by-step analysis
    summary: string;
    keyFactors: string[];
  };
  alternatives: AlternativeConsidered[];  // Why other actions rejected
  decision: AIDecision;
  providerInfo: { provider, model, tokensUsed, latencyMs, cost };
  metadata: { dataSourcesUsed, enrichmentApplied, fusionConfidence };
}
```

### 7.2 Usage

```typescript
import { createEnhancedDecisionLog, formatDecisionLogForDisplay } from "@/ai/enhanced-decision-log";

const log = createEnhancedDecisionLog(
  decision,
  marketData,
  newsContext,
  strategy,
  fusedIntelligence,
  { provider: "openai", model: "gpt-4o-mini" }
);

// Format for display
console.log(formatDecisionLogForDisplay(log));
```

### 7.3 Reasoning Steps

Each decision includes categorized reasoning steps:

| Category | Description |
|----------|-------------|
| market_analysis | Price action, momentum analysis |
| sentiment_analysis | News sentiment interpretation |
| fundamental_analysis | Earnings, ratios, growth |
| risk_assessment | Risk level evaluation |
| signal_synthesis | Combining multiple signals |
| final_decision | Conclusion and action |

---

## 8. Prompt Patterns

### 8.1 Structured Output Prompts

```typescript
const prompt = `Analyze the following market data and provide a trading recommendation.

Market Data:
- Symbol: ${symbol}
- Current Price: $${price}
- 24h Change: ${change}%

News Headlines:
${headlines.join('\n')}

Respond with JSON in this exact format:
{
  "action": "buy" | "sell" | "hold",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "keyFactors": ["factor1", "factor2"]
}`;
```

### 8.2 Context Enrichment

With Data Fusion Engine:

```typescript
const fusedContext = formatForLLM(fusedIntelligence);

const enrichedPrompt = `${basePrompt}

## Fused Market Intelligence
${fusedContext}

Based on this enriched data, what is your recommendation?`;
```

---

## 9. Cost & Token Management

### 9.1 Cost Optimization by Provider

| Use Case | Recommended Provider | Cost/1M Tokens |
|----------|---------------------|----------------|
| Simple classification | Groq (Llama 3.1 8B) | $0.05 |
| General analysis | Together.ai | $0.10-$0.27 |
| Complex reasoning | OpenAI (GPT-4o-mini) | ~$0.15 |
| Critical decisions | OpenAI (GPT-4o) | ~$2.50 |

### 9.2 Token Estimation

| Content Type | Approximate Tokens |
|--------------|-------------------|
| Market data (single symbol) | ~100 tokens |
| 5 news headlines | ~150 tokens |
| System prompt | ~50 tokens |
| Fused intelligence context | ~200 tokens |
| Expected response | ~200 tokens |
| **Total per analysis** | **~700 tokens** |

### 9.3 Cost Optimization Strategies

1. **Use LLM Router**: Automatically selects cheapest capable provider
2. **Cache analyses**: Don't re-analyze unchanged data
3. **Batch symbols**: Combine multiple symbols where appropriate
4. **Limit frequency**: Space out analysis cycles (default: 60 seconds)
5. **Use cheaper models**: Groq for simple tasks, OpenAI for complex

---

## 10. Testing AI Logic

### 10.1 Unit Testing

```typescript
describe("LLM Router", () => {
  it("should route to cheapest provider for cost priority", async () => {
    const response = await routedLLMCall(request, { priority: "cost" });
    expect(response.model).toContain("groq");
  });

  it("should fallback on provider failure", async () => {
    // Mock primary provider failure
    const response = await routedLLMCall(request);
    expect(response).toBeDefined();
  });
});
```

### 10.2 Data Fusion Testing

```typescript
describe("Data Fusion Engine", () => {
  it("should fuse market and sentiment data", () => {
    const result = fuseMarketData({
      symbol: "AAPL",
      marketData: [mockMarketData],
      sentimentData: [mockSentiment],
    });
    
    expect(result.price.sources).toContain("alpaca");
    expect(result.sentiment.overall).toBeDefined();
    expect(result.signalAgreement).toBeGreaterThanOrEqual(0);
  });
});
```

---

## Related Documentation

| Document | Relevance |
|----------|-----------|
| `AGENT_EXECUTION_GUIDE.md` | Section 14: AI Models & Provider Governance |
| `CONNECTORS_AND_INTEGRATIONS.md` | Data source connectors |
| `ORCHESTRATOR_AND_AGENT_RUNTIME.md` | AI integration in trading loop |
| `ARCHITECTURE.md` | AI layer in system design |
| `TESTING.md` | AI-related test patterns |

---

## 11. Current State (December 2025)

### 11.1 AI Decision Service Implementation

The AI Decision Service has been extracted as a standalone microservice (`services/ai-decision/`) running on port 3002:

| Component | Location | Description |
|-----------|----------|-------------|
| Service Entry | `services/ai-decision/index.ts` | Express server with health checks |
| LLM Router | `services/ai-decision/llm-router.ts` | Intelligent provider selection with circuit breakers |
| Decision Engine | `services/ai-decision/decision-engine.ts` | Core decision logic |
| Types | `services/ai-decision/types.ts` | Type definitions for AI decisions |

### 11.2 LLM Router Architecture

The `LLMRouter` class provides resilient multi-provider routing:

```typescript
const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig> = {
  [LLMProvider.OPENAI]: {
    envVar: 'OPENAI_API_KEY',
    costTier: 'premium',
    speedTier: 'moderate',
    qualityTier: 'excellent',
    defaultModel: 'gpt-4o-mini',
  },
  [LLMProvider.GROQ]: {
    envVar: 'GROQ_API_KEY',
    costTier: 'cheap',
    speedTier: 'fast',
    qualityTier: 'good',
    defaultModel: 'llama-3.1-8b-instant',
  },
  // Together, AIMLAPI, OpenRouter...
};
```

**Provider Selection Logic:**
1. Check for preferred provider (if configured)
2. Sort by speed tier (if `prioritizeSpeed: true`)
3. Sort by cost tier (if `prioritizeCost: true`)
4. Fall back to default priority order: OpenAI → Groq → Together → AIMLAPI → OpenRouter

### 11.3 Circuit Breaker Integration

Each provider has a dedicated circuit breaker for resilience:

```typescript
getCircuitBreaker(provider: LLMProvider): CircuitBreaker {
  return this.circuitRegistry.getOrCreate({
    name: `llm:${provider}`,
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000,
  });
}
```

### 11.4 Health Check Integration

LLM provider availability is monitored via health checks:

```typescript
healthChecker.registerCheck('llm-providers', async () => {
  const available = llmRouter.getAvailableProviders();
  return {
    status: available.length > 0 ? 'pass' : 'warn',
    message: `${available.length} LLM provider(s) available`,
  };
});
```

### 11.5 Provider Metrics Tracking

The router tracks per-provider metrics:

```typescript
interface ProviderMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  lastUsed: Date | null;
  consecutiveFailures: number;
}
```

---

## 12. Enhancements Compared to Previous Version

| Aspect | Previous (Monolith) | Current (Microservices) |
|--------|---------------------|-------------------------|
| **Service Location** | `server/ai/` directory | `services/ai-decision/` standalone |
| **Provider Resilience** | Manual retry logic | Circuit breakers with automatic recovery |
| **Provider Selection** | Simple fallback chain | Tiered selection (speed/cost/quality) |
| **Health Monitoring** | None | Health check endpoints for all providers |
| **Metrics Tracking** | Basic logging | Per-provider metrics with latency tracking |
| **Configuration** | Hardcoded priorities | Runtime-configurable router options |
| **Fallback Behavior** | Sequential retry | Priority-aware fallback with circuit state |

### Key Improvements

1. **Circuit Breaker Pattern**: Prevents cascade failures when a provider is down
2. **Tiered Provider Selection**: Choose providers based on speed, cost, or quality requirements
3. **Metrics Collection**: Track success rates, latencies, and failure patterns per provider
4. **Health Check Integration**: Proactive monitoring of provider availability
5. **Standalone Service**: Independent scaling and deployment of AI capabilities

---

## 13. Old vs New - Summary of Changes

### Architecture Changes

| Category | Old Approach | New Approach |
|----------|--------------|--------------|
| **Deployment** | Embedded in monolith | Standalone microservice on port 3002 |
| **Communication** | Direct function calls | REST API + NATS events |
| **Resilience** | Try-catch with retries | Circuit breakers per provider |
| **Scaling** | Entire app scales together | AI service scales independently |

### API Changes

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /health/live` | Liveness probe | ✅ Implemented |
| `GET /health/ready` | Readiness check | ✅ Implemented |
| `GET /health/startup` | Startup check | ✅ Implemented |
| `POST /analyze` | Request AI analysis | ✅ Implemented |
| `GET /providers` | List available providers | ✅ Implemented |

### Configuration Changes

**New Environment Variables:**
- `LLM_PRIORITIZE_SPEED`: Enable speed-first provider selection
- `LLM_PRIORITIZE_COST`: Enable cost-first provider selection
- `LLM_PREFERRED_PROVIDER`: Force specific provider

### File Structure Changes

```
# Old (Monolith)
server/
  ai/
    llmClient.ts
    llmRouter.ts
    openaiClient.ts
    groqClient.ts
    ...

# New (Microservices)
services/
  ai-decision/
    index.ts          # Service entry point
    llm-router.ts     # Enhanced router with circuit breakers
    decision-engine.ts # Core decision logic
    types.ts          # Type definitions
```

---

## Related Documentation

| Document | Relevance |
|----------|-----------|
| `AGENT_EXECUTION_GUIDE.md` | Section 14: AI Models & Provider Governance |
| `CONNECTORS_AND_INTEGRATIONS.md` | Data source connectors |
| `ORCHESTRATOR_AND_AGENT_RUNTIME.md` | AI integration in trading loop |
| `ARCHITECTURE.md` | AI layer in system design |
| `TESTING.md` | AI-related test patterns |

---

## When to Update This Document

Update this document when:
- Adding or removing an LLM provider (OpenAI, Groq, Together.ai, etc.)
- Changing model defaults or routing priorities in `llm-router.ts`
- Modifying the Data Fusion Engine or enrichment pipeline
- Updating prompt patterns or decision log formats
- Adding new environment variables for AI configuration
- Changing circuit breaker or fallback behavior

---

*Last Updated: December 2025*
*Version: 2.0.0 (Microservices Migration)*
