# AI Analysis Capability

## Purpose

Multi-provider AI analysis system with trade signal generation, risk scoring, sentiment analysis, LLM fallback chains, debate consensus mechanism, and comprehensive decision logging. Supports 9 LLM providers with automatic failover, response caching, and technical analysis fallback when all providers fail.

## Requirements

### Requirement: AI Trade Signal Generation

The system SHALL generate trade signals (buy/sell/hold) with confidence scores using AI analysis.

#### Scenario: Successful signal generation

- **WHEN** a user requests AI analysis with symbol and market data
- **THEN** the system SHALL analyze the opportunity using the LLM gateway
- **AND** return action ("buy", "sell", or "hold")
- **AND** return confidence score (0-1 decimal)
- **AND** return reasoning (2-3 sentence explanation)
- **AND** return risk level ("low", "medium", or "high")
- **AND** optionally return suggested quantity (0.01-0.25 as percentage of portfolio)
- **AND** optionally return target price and stop loss levels
- **AND** create an AI decision record in the database
- **AND** return HTTP 200 with decision ID and creation timestamp

#### Scenario: Signal generation with strategy context

- **WHEN** a user provides strategy ID with the analysis request
- **THEN** the system SHALL retrieve strategy parameters
- **AND** include strategy context in the AI prompt
- **AND** generate decision aligned with strategy type and parameters

#### Scenario: All LLM providers fail

- **WHEN** all configured LLM providers are unavailable or return errors
- **THEN** the system SHALL fall back to technical analysis without LLM
- **AND** calculate decision using price indicators (RSI, MACD, moving averages)
- **AND** return decision with confidence based on indicator confluence
- **AND** include "Technical Fallback" in reasoning
- **AND** return HTTP 200 with fallback decision

#### Scenario: Invalid market data

- **WHEN** a user provides incomplete or invalid market data
- **THEN** the system SHALL reject the request with HTTP 400 Bad Request
- **AND** return validation error specifying missing required fields

### Requirement: Multi-Provider LLM Fallback Chain

The system SHALL attempt multiple LLM providers in sequence with automatic failover.

#### Scenario: Primary provider succeeds

- **WHEN** the primary provider (based on role and criticality) is available
- **THEN** the system SHALL use the primary provider
- **AND** log the successful call with provider, model, tokens, and cost
- **AND** set fallbackUsed to false
- **AND** cache the response according to role configuration

#### Scenario: Primary provider fails, fallback succeeds

- **WHEN** the primary provider fails with rate limit or error
- **THEN** the system SHALL attempt the next provider in the fallback chain
- **AND** set fallbackUsed to true
- **AND** set fallbackReason to "Rate limit exceeded" or "Provider error"
- **AND** return successful response from fallback provider
- **AND** log the fallback attempt and reason

#### Scenario: Provider rate limit with retry

- **WHEN** a provider returns HTTP 429 (rate limit exceeded)
- **THEN** the system SHALL wait 1000ms before trying next provider
- **AND** mark the call as rate-limited in logs
- **AND** continue to next provider in fallback chain

#### Scenario: Budget exhausted error

- **WHEN** a provider returns HTTP 402 (payment required) or budget exceeded error
- **THEN** the system SHALL immediately fall back to technical analysis
- **AND** skip remaining providers in chain
- **AND** log the budget exhaustion event

### Requirement: Risk Scoring

The system SHALL calculate risk scores (0-10 scale) for trading decisions.

#### Scenario: Risk score calculation

- **WHEN** AI generates a trade signal
- **THEN** the system SHALL calculate risk level based on:
  - Confidence score (higher confidence = lower risk)
  - Market volatility indicators
  - Position sizing relative to portfolio
  - Stop loss distance from entry price
- **AND** categorize risk as "low" (0-3.3), "medium" (3.4-6.6), or "high" (6.7-10)
- **AND** include risk level in decision response
- **AND** store risk level in AI decision record

#### Scenario: High risk decision blocking

- **WHEN** a decision has risk level "high" and confidence below 0.6
- **THEN** the system SHALL set decision status to "skipped"
- **AND** set skipReason to "High risk, low confidence"
- **AND** not execute the trade automatically

### Requirement: Sentiment Analysis from News and Social

The system SHALL aggregate sentiment from multiple sources and provide unified sentiment scores.

#### Scenario: Multi-source sentiment aggregation

- **WHEN** a user requests sentiment for one or more symbols
- **THEN** the system SHALL query GDELT, NewsAPI, and HuggingFace FinBERT
- **AND** aggregate sentiment scores from all sources
- **AND** calculate weighted overall sentiment (-1 to +1 scale)
- **AND** convert to UI-compatible score (-50 to +50)
- **AND** determine recommendation ("bullish", "bearish", "neutral", or "conflicted")
- **AND** detect conflicting signals between sources
- **AND** return sentiment with confidence score (0-1)
- **AND** include source breakdown with individual scores
- **AND** return HTTP 200 with sentiment array

#### Scenario: Sentiment cache hit

- **WHEN** sentiment for a symbol was recently fetched
- **THEN** the system SHALL return cached sentiment data
- **AND** set cacheHit to true in response
- **AND** avoid redundant API calls to sentiment sources

#### Scenario: Sentiment source failure

- **WHEN** one or more sentiment sources fail or timeout
- **THEN** the system SHALL continue with available sources
- **AND** calculate sentiment from successful sources only
- **AND** include error flags for failed sources
- **AND** adjust confidence score based on available data

### Requirement: AI Decision Logging and Audit Trail

The system SHALL log all AI decisions with complete audit trail.

#### Scenario: Decision creation with tracing

- **WHEN** an AI analysis completes
- **THEN** the system SHALL create an aiDecisions record with:
  - Unique decision ID
  - Symbol, action, confidence, reasoning
  - Strategy ID (if applicable)
  - Trace ID for end-to-end tracing
  - Market context (JSON with market data, news, risk level)
  - Entry price, suggested quantity, target price, stop loss
  - Status ("pending", "executed", "skipped", "failed", "cancelled")
- **AND** store creation timestamp
- **AND** return decision ID to caller

#### Scenario: Decision execution tracking

- **WHEN** a decision leads to a trade execution
- **THEN** the system SHALL update the decision record with:
  - executedTradeId (link to trades table)
  - filledPrice (actual execution price)
  - filledAt (timestamp)
  - Status changed to "executed"
- **AND** allow tracking from decision through order to position

#### Scenario: Decision skip tracking

- **WHEN** a decision is rejected by risk rules
- **THEN** the system SHALL update decision status to "skipped"
- **AND** set skipReason with specific rejection reason
- **AND** log the skip event for analysis

#### Scenario: Enriched decision history

- **WHEN** a user requests enriched AI decision history
- **THEN** the system SHALL return decisions with:
  - Linked order data (order ID, status, filled price)
  - Linked trade data (trade ID, execution details)
  - Linked position data (current position, P&L)
  - Timeline stages (decision → risk_gate → order → fill → position)
  - Stage status (completed, pending, skipped, failed)
  - Stage timestamps and details
- **AND** support filtering by status (pending, executed, skipped)
- **AND** support pagination with limit and offset

### Requirement: LLM Provider Selection and Routing

The system SHALL route LLM requests based on role and criticality to optimize cost and quality.

#### Scenario: High criticality routing

- **WHEN** a request has criticality "high"
- **THEN** the system SHALL use premium models in fallback chain
- **AND** prioritize Claude Sonnet 4, DeepSeek R1, or GPT-4o mini
- **AND** accept higher cost per 1k tokens (up to $0.003)

#### Scenario: Medium criticality routing

- **WHEN** a request has criticality "medium"
- **THEN** the system SHALL use balanced cost/quality models
- **AND** prioritize GPT-4o mini, Gemini Flash, or Llama 3.1-70b
- **AND** target cost range $0.0001-$0.0006 per 1k tokens

#### Scenario: Low criticality routing

- **WHEN** a request has criticality "low"
- **THEN** the system SHALL use fast, cheap models
- **AND** prioritize Llama 3.1-8b, Gemini Flash Lite, or Cloudflare Workers AI
- **AND** target cost below $0.0001 per 1k tokens

#### Scenario: Role-based model selection

- **WHEN** a request specifies role "technical_analyst"
- **THEN** the system SHALL use reasoning-capable models (DeepSeek R1, Claude, GPT-4o)
- **WHEN** a request specifies role "market_news_summarizer"
- **THEN** the system SHALL use fast summarization models (Llama 3.1-8b, Gemini)
- **WHEN** a request specifies role "risk_manager"
- **THEN** the system SHALL use conservative instruction-following models (Claude, GPT-4o)

### Requirement: Provider Quota and Budget Management

The system SHALL track LLM usage costs and enforce budget limits.

#### Scenario: Cost tracking per call

- **WHEN** an LLM call completes successfully
- **THEN** the system SHALL log to llmCalls table with:
  - Role, provider, model
  - Prompt tokens, completion tokens, total tokens
  - Estimated cost (tokens / 1000 \* costPer1kTokens)
  - Latency in milliseconds
  - Status ("success" or "error")
  - Cache hit indicator
  - Fallback used indicator and reason
  - Trace ID for correlation
- **AND** allow cost aggregation by role, provider, and time period

#### Scenario: Usage statistics retrieval

- **WHEN** a user requests LLM usage statistics
- **THEN** the system SHALL aggregate data by role and provider
- **AND** calculate total calls, total cost, average latency per role
- **AND** calculate success rate per provider
- **AND** return statistics for last 1000 calls
- **AND** return HTTP 200 with usage stats

#### Scenario: Budget limit check

- **WHEN** a provider returns budget exhausted error
- **THEN** the system SHALL mark provider as unavailable
- **AND** skip to next provider in fallback chain
- **AND** fall back to technical analysis if all providers exhausted

### Requirement: Technical Analysis Fallback

The system SHALL provide technical analysis without LLM when all providers fail.

#### Scenario: Indicator-based decision

- **WHEN** technical fallback is triggered
- **THEN** the system SHALL calculate RSI (14-period)
- **AND** calculate MACD (12, 26, 9)
- **AND** calculate moving averages (20, 50)
- **AND** analyze price vs moving averages
- **AND** determine action based on indicator confluence:
  - Buy if RSI < 40 AND price above MA20 AND MACD bullish
  - Sell if RSI > 60 AND price below MA20 AND MACD bearish
  - Hold otherwise
- **AND** set confidence based on signal agreement (0.5-0.7 range)
- **AND** include "Technical Analysis Fallback" in reasoning

#### Scenario: Fallback with news sentiment

- **WHEN** technical fallback is used and news context is provided
- **THEN** the system SHALL adjust confidence based on sentiment
- **AND** increase confidence by 0.1 if sentiment aligns with technical signal
- **AND** decrease confidence by 0.1 if sentiment conflicts with technical signal

### Requirement: Debate Consensus Mechanism

The system SHALL support multi-agent debate for complex trading decisions.

#### Scenario: Full debate session

- **WHEN** a user initiates a debate for symbols
- **THEN** the system SHALL create debate session with trace ID
- **AND** gather market context (quotes, bars, account, positions, clock)
- **AND** run each analyst role in sequence:
  - Bull analyst (finds upside catalysts)
  - Bear analyst (finds downside risks)
  - Risk manager (assesses position sizing)
  - Technical analyst (analyzes price action)
  - Fundamental analyst (evaluates valuation)
- **AND** each analyst SHALL:
  - Receive market context and prior analyst opinions
  - Return stance (bullish/bearish/neutral/abstain)
  - Return confidence (0-1)
  - Return key signals, risks, invalidation points
  - Return proposed action and order intent
  - Return evidence references and rationale
- **AND** run judge role to synthesize all opinions
- **AND** judge SHALL return final decision, order intent, risk checks, confidence, and dissent tracking
- **AND** create debate consensus record
- **AND** enqueue order if decision is buy/sell/scale_in/scale_out
- **AND** mark session as completed with duration and total cost
- **AND** return HTTP 200 with session and consensus

#### Scenario: Debate with custom roles

- **WHEN** a user specifies enabledRoles in config
- **THEN** the system SHALL run only the specified roles
- **AND** skip excluded roles
- **AND** proceed to judge with available analyst inputs

#### Scenario: Debate role failure

- **WHEN** an analyst role fails during debate
- **THEN** the system SHALL mark session as failed
- **AND** store partial results (messages from successful roles)
- **AND** return HTTP 500 with error details

### Requirement: AI-powered Market Analysis

The system SHALL provide market condition analysis with dynamic order limits.

#### Scenario: Market condition detection

- **WHEN** market condition analyzer runs
- **THEN** the system SHALL analyze VIX, volume, price action
- **AND** classify market as "bullish", "bearish", "neutral", "volatile", or "ranging"
- **AND** calculate AI confidence score (0-1)
- **AND** determine dynamic order limit based on conditions
- **AND** store last analysis timestamp and result

#### Scenario: Dynamic limit adjustment

- **WHEN** market conditions change
- **THEN** the system SHALL adjust currentOrderLimit between minOrderLimit and maxOrderLimit
- **AND** increase limit in bullish, low-volatility markets
- **AND** decrease limit in bearish, high-volatility markets
- **AND** store dynamic limit in agent status

#### Scenario: Market analysis refresh

- **WHEN** a user manually triggers market analysis refresh
- **THEN** the system SHALL run immediate analysis cycle
- **AND** update market condition and confidence
- **AND** adjust dynamic order limits
- **AND** return HTTP 200 with analysis results

### Requirement: Provider Enable/Disable Controls

The system SHALL allow runtime control of LLM provider availability.

#### Scenario: Provider availability check

- **WHEN** the system checks provider availability
- **THEN** it SHALL verify API key is configured for that provider
- **AND** check if provider is marked as enabled
- **AND** return true only if both conditions met

#### Scenario: Available providers list

- **WHEN** a user requests available providers
- **THEN** the system SHALL return array of provider names that:
  - Have valid API keys configured
  - Are marked as available/enabled
  - Are instantiated in PROVIDER_CLIENTS map
- **AND** include providers: openai, groq, together, aimlapi, openrouter, claude, gemini, cloudflare, huggingface

### Requirement: AI Usage Analytics

The system SHALL provide comprehensive analytics on AI decision performance.

#### Scenario: AI events aggregation

- **WHEN** a user requests AI events for dashboard
- **THEN** the system SHALL retrieve recent AI decisions (up to 100)
- **AND** transform into event format with:
  - Type (derived from action: buy/sell/hold)
  - Title and headline (action + symbol)
  - Description and explanation (reasoning)
  - Confidence score
  - Creation timestamp
  - Metadata (strategy ID, signals)
- **AND** support filtering by event type
- **AND** support pagination with limit parameter
- **AND** return HTTP 200 with events array (or empty array on error)

#### Scenario: LLM cache statistics

- **WHEN** a user requests cache statistics
- **THEN** the system SHALL return:
  - Overall hit rate (hits / (hits + misses))
  - Total hits and misses
  - Tokens saved from cache hits
  - Estimated cost saved ($)
  - Current cache size (entry count)
  - Per-role statistics (hits, misses, hit rate for each LLM role)
- **AND** return HTTP 200 with cache stats

#### Scenario: Cache management

- **WHEN** a user clears entire cache
- **THEN** the system SHALL delete all cached responses
- **AND** return HTTP 200 with success message
- **WHEN** a user clears cache for specific role
- **THEN** the system SHALL delete cached responses for that role only
- **AND** return HTTP 200 with role-specific success message
- **WHEN** a user resets cache statistics
- **THEN** the system SHALL reset hit/miss counters to zero
- **AND** reset tokens saved and cost saved to zero
- **AND** preserve actual cache entries
- **AND** return HTTP 200 with success message

## Security

### API Key Protection

LLM provider API keys MUST:

- Be stored in environment variables only
- Never be logged or returned in API responses
- Be redacted in structured logs using Pino auto-redaction
- Be validated before making provider calls

### Rate Limiting

AI analysis endpoints MUST enforce rate limiting:

- `/api/ai/analyze` - Standard user rate limits apply
- `/api/ai-decisions/analyze` - Standard user rate limits apply
- Debate sessions - Limited by token budget and timeout configuration

### Authentication

All AI analysis endpoints MUST:

- Require valid session cookie OR admin token
- Use `requireAuth` middleware
- Attach user ID to requests for decision tracking
- Return HTTP 401 for unauthenticated requests

### Input Validation

All AI analysis requests MUST:

- Validate symbol format (alphanumeric, max 10 chars)
- Validate market data structure (required: currentPrice)
- Sanitize user prompts to prevent prompt injection
- Enforce max token limits per role
- Validate confidence scores are 0-1 range
- Validate risk levels are "low", "medium", or "high"

### Prompt Injection Prevention

System prompts MUST:

- Be hardcoded in server code, not user-configurable
- Separate user input from system instructions
- Use structured JSON response format to prevent output manipulation
- Validate AI responses match expected schema before storing

### Cost Controls

The system MUST:

- Set maxTokens limits for each role (500-2500 tokens)
- Track cumulative costs per user/session
- Fall back to cheaper models when budget concerns arise
- Log all provider costs for auditing

## API Endpoints

| Method | Path                               | Auth Required | Description                                       |
| ------ | ---------------------------------- | ------------- | ------------------------------------------------- |
| POST   | /api/ai/analyze                    | Yes           | Generate AI trade signal                          |
| GET    | /api/ai/status                     | Yes           | Get AI decision engine status                     |
| GET    | /api/ai/events                     | Yes           | Get recent AI activity for dashboard              |
| GET    | /api/ai/sentiment                  | Yes           | Get sentiment signals for symbols                 |
| GET    | /api/ai/cache/stats                | Yes           | Get LLM response cache statistics                 |
| POST   | /api/ai/cache/clear                | Yes           | Clear all LLM response cache                      |
| POST   | /api/ai/cache/clear/:role          | Yes           | Clear cache for specific role                     |
| POST   | /api/ai/cache/reset-stats          | Yes           | Reset cache statistics                            |
| GET    | /api/ai-decisions                  | Yes           | Get recent AI decisions                           |
| GET    | /api/ai-decisions/history          | Yes           | Get paginated decision history with filters       |
| POST   | /api/ai-decisions                  | Yes           | Create new AI decision record                     |
| GET    | /api/ai-decisions/enriched         | Yes           | Get decisions with linked orders/trades/positions |
| GET    | /api/llm/configs                   | Yes           | Get all LLM role configurations                   |
| PUT    | /api/llm/configs/:role             | Yes           | Update LLM role configuration                     |
| GET    | /api/llm/calls                     | Yes           | Get recent LLM calls history                      |
| GET    | /api/llm/stats                     | Yes           | Get LLM call statistics                           |
| POST   | /api/debate/sessions               | Yes           | Start multi-agent debate session                  |
| GET    | /api/debate/sessions               | Yes           | List debate sessions                              |
| GET    | /api/debate/sessions/:id           | Yes           | Get debate session details                        |
| GET    | /api/agent/status                  | Yes           | Get autonomous agent status                       |
| POST   | /api/agent/toggle                  | Yes           | Toggle autonomous agent on/off                    |
| GET    | /api/agent/market-analysis         | Yes           | Get market condition analysis                     |
| POST   | /api/agent/market-analysis/refresh | No Auth       | Manually trigger market analysis                  |
| GET    | /api/agent/dynamic-limits          | Yes           | Get dynamic order limits                          |
| POST   | /api/agent/set-limits              | Yes           | Set min/max order limits                          |
| GET    | /api/agent/health                  | Yes           | Get agent health status                           |
| POST   | /api/agent/auto-start              | Yes           | Enable/disable agent auto-start                   |
| POST   | /api/autonomous/execute-trades     | No Auth       | Execute trades from AI decisions                  |

## Database Schema

### aiDecisions table

- `id` (varchar, primary key) - Unique decision identifier
- `userId` (varchar, foreign key → users.id, cascade delete)
- `strategyId` (varchar, foreign key → strategies.id, set null)
- `symbol` (text, not null) - Trading symbol
- `action` (text, not null) - "buy", "sell", or "hold"
- `confidence` (numeric) - Confidence score (0-1)
- `reasoning` (text) - AI explanation
- `marketContext` (text) - JSON with market data, news, risk level
- `createdAt` (timestamp, not null) - Decision creation time
- `executedTradeId` (varchar) - Link to executed trade
- `status` (text, default "pending") - "pending", "executed", "skipped", "failed", "cancelled"
- `stopLoss` (numeric) - Stop loss price
- `takeProfit` (numeric) - Take profit price
- `entryPrice` (numeric) - Intended entry price
- `filledPrice` (numeric) - Actual fill price
- `filledAt` (timestamp) - Fill timestamp
- `skipReason` (text) - Reason for skip/failure
- `traceId` (text) - End-to-end trace ID
- `metadata` (text) - Additional JSON metadata

### aiDecisionFeatures table

- `id` (varchar, primary key)
- `decisionId` (varchar, foreign key → aiDecisions.id, cascade delete)
- `symbol` (text, not null)
- `volatility` (numeric) - Market volatility
- `trendStrength` (numeric) - Trend strength
- `signalAgreement` (numeric) - Indicator confluence
- `sentimentScore` (numeric) - Sentiment score
- `peRatio` (numeric) - Price-to-earnings ratio
- `pbRatio` (numeric) - Price-to-book ratio
- `rsi` (numeric) - RSI indicator
- `macdSignal` (text) - MACD signal
- `volumeRatio` (numeric) - Volume vs average
- `priceChangePercent` (numeric) - Price change %
- `marketCondition` (text) - Market regime
- `dataQuality` (numeric) - Data quality score
- `activeSources` (integer) - Number of active data sources
- `featureVector` (text) - JSON feature vector for ML
- `createdAt` (timestamp, not null)

### aiTradeOutcomes table

- `id` (varchar, primary key)
- `decisionId` (varchar, foreign key → aiDecisions.id, cascade delete)
- `tradeId` (varchar, foreign key → trades.id, set null)
- `symbol` (text, not null)
- `action` (text, not null)
- `predictionConfidence` (numeric) - Original confidence
- `entryPrice` (numeric)
- `exitPrice` (numeric)
- `quantity` (numeric)
- `realizedPnl` (numeric) - Dollar P&L
- `realizedPnlPercent` (numeric) - Percentage P&L
- `holdingTimeMs` (integer) - Duration in milliseconds
- `isWin` (boolean) - Trade outcome
- `slippagePercent` (numeric) - Execution slippage
- `targetPriceHit` (boolean) - Did trade reach target?
- `stopLossHit` (boolean) - Was trade stopped out?
- `maxDrawdown` (numeric) - Worst unrealized loss
- `maxGain` (numeric) - Best unrealized gain
- `marketSessionAtEntry` (text) - Market session timing
- `marketSessionAtExit` (text)
- `strategyId` (varchar, foreign key → strategies.id, set null)
- `exitReason` (text) - Why trade closed
- `createdAt` (timestamp, not null)
- `closedAt` (timestamp)

### aiCalibrationLog table

- `id` (varchar, primary key)
- `calibrationType` (text, not null) - "confidence", "symbol", "timing", "risk", "overall"
- `dataWindowDays` (integer, default 30) - Analysis window
- `totalDecisions` (integer) - Decisions analyzed
- `winCount` (integer) - Winning trades
- `lossCount` (integer) - Losing trades
- `avgConfidenceOnWins` (numeric) - Confidence for winners
- `avgConfidenceOnLosses` (numeric) - Confidence for losers
- `avgHoldingTimeWins` (integer) - Hold time for winners
- `avgHoldingTimeLosses` (integer) - Hold time for losers
- `topWinningSymbols` (text) - Best performing symbols
- `topLosingSymbols` (text) - Worst performing symbols
- `recommendedAdjustments` (text) - Model tuning recommendations
- `modelVersion` (text) - Model identifier
- `createdAt` (timestamp, not null)

### llmCalls table

- `id` (varchar, primary key)
- `role` (text, not null) - LLM role ("technical_analyst", "risk_manager", etc.)
- `provider` (text, not null) - Provider name ("openai", "claude", etc.)
- `model` (text, not null) - Model identifier
- `promptTokens` (integer) - Tokens in prompt
- `completionTokens` (integer) - Tokens in completion
- `totalTokens` (integer) - Total tokens used
- `estimatedCost` (text) - Cost in dollars
- `latencyMs` (integer) - Response time
- `status` (text) - "success" or "error"
- `systemPrompt` (text) - System prompt (truncated)
- `userPrompt` (text) - User prompt (truncated)
- `response` (text) - LLM response (truncated)
- `errorMessage` (text) - Error if failed
- `cacheHit` (boolean) - Was response cached?
- `fallbackUsed` (boolean) - Did primary provider fail?
- `fallbackReason` (text) - Why fallback was used
- `traceId` (text) - Trace ID for correlation
- `metadata` (text) - Additional JSON metadata
- `createdAt` (timestamp, not null)

### llmRoleConfigs table

- `id` (varchar, primary key)
- `role` (text, unique, not null) - LLM role
- `description` (text) - Role description
- `fallbackChain` (text, not null) - JSON array of model configs
- `maxTokens` (integer) - Max tokens per request
- `temperature` (text) - Temperature setting
- `enableCitations` (boolean) - Require source citations
- `isActive` (boolean, default true) - Is this config active?
- `createdAt` (timestamp, not null)
- `updatedAt` (timestamp)

### debateSessions table

- `id` (varchar, primary key)
- `traceId` (text, not null) - Trace ID
- `symbols` (text array, not null) - Symbols being debated
- `status` (text, not null) - "running", "completed", "failed"
- `triggeredBy` (text) - Who/what triggered debate
- `strategyVersionId` (varchar)
- `config` (jsonb) - Debate configuration
- `marketContext` (jsonb) - Market data snapshot
- `startedAt` (timestamp, not null)
- `completedAt` (timestamp)
- `durationMs` (integer) - Duration in milliseconds
- `totalCost` (text) - Total LLM cost

### debateMessages table

- `id` (varchar, primary key)
- `sessionId` (varchar, foreign key → debateSessions.id, cascade delete)
- `role` (text, not null) - "bull", "bear", "risk_manager", "technical_analyst", "fundamental_analyst", "judge"
- `stance` (text) - "bullish", "bearish", "neutral", "abstain"
- `confidence` (text) - Confidence score
- `keySignals` (text array) - Bullish/bearish signals
- `risks` (text array) - Identified risks
- `invalidationPoints` (text array) - Conditions that invalidate thesis
- `proposedAction` (text) - "buy", "sell", "hold", "scale_in", "scale_out"
- `proposedOrder` (jsonb) - Order intent object
- `evidenceRefs` (text array) - Data sources cited
- `rawOutput` (text) - Full rationale
- `provider` (text) - LLM provider used
- `model` (text) - Model used
- `tokensUsed` (integer)
- `estimatedCost` (text)
- `latencyMs` (integer)
- `createdAt` (timestamp, not null)

### debateConsensus table

- `id` (varchar, primary key)
- `sessionId` (varchar, foreign key → debateSessions.id, cascade delete)
- `decision` (text, not null) - Final decision
- `orderIntent` (jsonb) - Order to execute (if any)
- `reasonsSummary` (text) - Explanation
- `riskChecks` (jsonb) - Risk validation results
- `confidence` (text) - Final confidence
- `dissent` (jsonb) - Dissenting opinions
- `workItemId` (varchar) - Queued work item for order
- `brokerOrderId` (varchar) - Alpaca order ID
- `createdAt` (timestamp, not null)

## Error Handling

All AI analysis endpoints MUST use standardized error responses:

**400 Bad Request**: Invalid request format, missing required fields, validation errors
**401 Unauthorized**: Missing or invalid authentication
**429 Too Many Requests**: LLM rate limit exceeded (with RateLimit-\* headers)
**500 Internal Server Error**: LLM provider failures, database errors, unexpected failures

Error response format:

```json
{
  "error": "Failed to analyze trading opportunity",
  "statusCode": 500,
  "details": {
    "traceId": "abc123...",
    "provider": "openai",
    "fallbackUsed": true,
    "fallbackReason": "Rate limit exceeded"
  }
}
```

LLM-specific error handling:

- **Rate Limit (429)**: Wait 1000ms, try next provider, log fallback
- **Auth Error (401/403)**: Skip to next provider immediately
- **Budget Exceeded (402)**: Fall back to technical analysis
- **All Providers Failed**: Return technical analysis fallback with HTTP 200
- **Invalid Response Format**: Return default "hold" decision with low confidence

## Dependencies

- `@anthropic-ai/sdk` - Claude AI provider
- `openai` - OpenAI GPT models
- `@google/generative-ai` - Google Gemini
- `groq-sdk` - Groq inference
- `@huggingface/inference` - HuggingFace models
- `p-limit` - Concurrency limiting for AI calls
- `p-retry` - Retry logic with exponential backoff
- `crypto` - Token generation, cache key hashing
- Custom connectors: GDELT, NewsAPI, Finnhub, Valyu, FINRA, SEC EDGAR, FRED, Frankfurter

## Files

**Routes**:

- `server/routes/ai-analysis.ts` - AI analysis endpoints
- `server/routes/ai-decisions.ts` - Decision CRUD and enrichment
- `server/routes/llm.ts` - LLM configuration and stats
- `server/routes/debate.ts` - Debate sessions

**AI Core**:

- `server/ai/llmGateway.ts` - Centralized LLM gateway with fallback chains
- `server/ai/decision-engine.ts` - AI decision generation logic
- `server/ai/roleBasedRouter.ts` - Role-based LLM routing
- `server/ai/debateArena.ts` - Multi-agent debate orchestration
- `server/ai/technical-analysis-fallback.ts` - Non-LLM indicator analysis

**LLM Clients**:

- `server/ai/llmClient.ts` - Base LLM client interface
- `server/ai/claudeClient.ts` - Anthropic Claude
- `server/ai/openaiClient.ts` - OpenAI GPT
- `server/ai/geminiClient.ts` - Google Gemini
- `server/ai/groqClient.ts` - Groq
- `server/ai/huggingfaceClient.ts` - HuggingFace
- `server/ai/openrouterClient.ts` - OpenRouter
- `server/ai/cloudflareClient.ts` - Cloudflare Workers AI
- `server/ai/togetherClient.ts` - Together AI
- `server/ai/aimlClient.ts` - AIML API

**Services**:

- `server/services/sentiment-aggregator.ts` - Multi-source sentiment aggregation
- `server/autonomous/orchestrator.ts` - Autonomous trading orchestration
- `server/ai/market-condition-analyzer.ts` - Market regime detection

**Schema**:

- `shared/schema/ai-decisions.ts` - AI decision database schema
- `server/ai/ai-types.ts` - TypeScript interfaces for AI domain

**Utilities**:

- `server/utils/logger.ts` - Pino structured logging with AI module logger
