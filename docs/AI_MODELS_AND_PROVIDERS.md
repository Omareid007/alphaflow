# AI Models & Providers

> **Purpose**  
> Deep-dive documentation on AI models, providers, configurations, and best practices for the AI Active Trader application.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current AI Providers](#2-current-ai-providers)
3. [Model Configuration](#3-model-configuration)
4. [Prompt Patterns](#4-prompt-patterns)
5. [Response Handling](#5-response-handling)
6. [Cost & Token Management](#6-cost--token-management)
7. [Testing AI Logic](#7-testing-ai-logic)

---

## 1. Overview

AI Active Trader uses OpenAI's language models to power trading decision support. The AI layer is responsible for:

- Analyzing market conditions and news sentiment
- Generating buy/sell/hold recommendations
- Providing explainable reasoning for each decision
- Calculating confidence scores for trade signals

**Key principle:** AI provides decision support, not autonomous execution. All AI outputs are validated and subject to risk limits before execution.

---

## 2. Current AI Providers

### 2.1 OpenAI

**Primary provider** for all AI decision-making.

| Setting | Value | Notes |
|---------|-------|-------|
| API Key | `OPENAI_API_KEY` (env) | Required for operation |
| Base Model | GPT-4o-mini / GPT-4o | Configurable |
| Fallback | GPT-3.5-turbo | For cost-sensitive operations |

**File locations:**
- Provider wrapper: `server/ai/openai.ts`
- Decision engine: `server/ai/decision-engine.ts`
- Trading integration: `server/trading/alpaca-trading-engine.ts`

### 2.2 Model Selection Matrix

| Use Case | Recommended Model | Reasoning |
|----------|-------------------|-----------|
| Trade decisions | GPT-4o-mini | Balance of quality and cost |
| Complex analysis | GPT-4o | Higher accuracy for critical decisions |
| Simple formatting | GPT-3.5-turbo | Cost-effective for simple tasks |
| Summarization | GPT-4o-mini | Good balance for text processing |

---

## 3. Model Configuration

### 3.1 Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `OPENAI_API_KEY` | API authentication | Yes |
| `AI_MODEL` | Override default model | No |
| `AI_TEMPERATURE` | Response randomness (0-1) | No |

### 3.2 Default Configuration

```typescript
const defaultConfig = {
  model: "gpt-4o-mini",
  temperature: 0.3,      // Lower for more deterministic
  maxTokens: 1000,       // Limit response length
  topP: 0.9,            // Nucleus sampling
};
```

### 3.3 Trading-Specific Settings

For trade decision prompts:
- Temperature: 0.2 (more deterministic)
- Max tokens: 500 (focused responses)
- Response format: JSON

---

## 4. Prompt Patterns

### 4.1 Structured Output Prompts

Always request structured JSON output for parsing reliability:

```typescript
const prompt = `Analyze the following market data and provide a trading recommendation.

Market Data:
- Symbol: ${symbol}
- Current Price: $${price}
- 24h Change: ${change}%
- Volume: ${volume}

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

### 4.2 Context Inclusion

**DO include:**
- Current price and recent price history
- Relevant news headlines (summarized)
- Technical indicator values
- Position context (if applicable)

**DO NOT include:**
- Raw API responses
- Excessive historical data
- Account credentials or secrets
- Unrelated market data

### 4.3 Paper Trading Context

Always include paper trading context:

```typescript
const systemPrompt = `You are a trading analyst for a PAPER TRADING system.
This is NOT real money trading. Provide analysis for educational purposes.`;
```

---

## 5. Response Handling

### 5.1 Safe Parsing

Always parse AI responses with error handling:

```typescript
function parseAIDecision(response: string): AIDecision | null {
  try {
    const parsed = JSON.parse(response);
    
    // Validate required fields
    if (!parsed.action || !parsed.confidence) {
      log.warn("AI", "Invalid AI response: missing fields", { response });
      return null;
    }
    
    // Validate action value
    if (!["buy", "sell", "hold"].includes(parsed.action)) {
      log.warn("AI", "Invalid action value", { action: parsed.action });
      return null;
    }
    
    // Clamp confidence to valid range
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    
    return parsed;
  } catch (error) {
    log.error("AI", "Failed to parse AI response", { error: String(error) });
    return null;
  }
}
```

### 5.2 Fallback Behavior

If AI response is invalid:
1. Log the failure with full context
2. Return a "hold" recommendation (safe default)
3. Continue orchestrator cycle
4. Do NOT retry in tight loop

---

## 6. Cost & Token Management

### 6.1 Token Estimation

| Content Type | Approximate Tokens |
|--------------|-------------------|
| Market data (single symbol) | ~100 tokens |
| 5 news headlines | ~150 tokens |
| System prompt | ~50 tokens |
| Expected response | ~200 tokens |
| **Total per analysis** | **~500 tokens** |

### 6.2 Cost Optimization Strategies

1. **Cache recent analyses:** Don't re-analyze unchanged data
2. **Batch symbols:** Combine multiple symbols in one prompt where appropriate
3. **Limit frequency:** Space out analysis cycles (default: 60 seconds)
4. **Use cheaper models:** For non-critical operations

### 6.3 Monitoring

Track AI usage in logs:

```typescript
log.ai("Analysis complete", {
  symbol,
  model: config.model,
  tokensUsed: response.usage.total_tokens,
  latencyMs: endTime - startTime
});
```

---

## 7. Testing AI Logic

### 7.1 Unit Testing

Test parsing and decision logic with mocked responses:

```typescript
describe("AI Decision Parsing", () => {
  it("should parse valid JSON response", () => {
    const mockResponse = '{"action":"buy","confidence":0.85,"reasoning":"Strong momentum"}';
    const result = parseAIDecision(mockResponse);
    expect(result.action).toBe("buy");
    expect(result.confidence).toBe(0.85);
  });

  it("should return null for malformed JSON", () => {
    const result = parseAIDecision("not json");
    expect(result).toBeNull();
  });

  it("should clamp confidence to valid range", () => {
    const mockResponse = '{"action":"buy","confidence":1.5,"reasoning":"Test"}';
    const result = parseAIDecision(mockResponse);
    expect(result.confidence).toBe(1.0);
  });
});
```

### 7.2 Integration Testing

Test with mocked OpenAI responses:

```typescript
// Mock the OpenAI client
jest.mock("openai", () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{"action":"hold","confidence":0.5}' } }],
          usage: { total_tokens: 150 }
        })
      }
    }
  }))
}));
```

---

## 8. LLMClient Abstraction

### 8.1 Overview

The project uses a minimal, provider-agnostic LLM abstraction that:
- Uses OpenAI as the **primary** provider
- Supports **OpenRouter** as an optional secondary provider
- Uses **NO external LLM frameworks** (no langchain, llamaindex, etc.)
- Uses only `fetch` + small TypeScript wrappers

### 8.2 Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| LLMClient Interface | `server/ai/llmClient.ts` | Provider-agnostic types and interfaces |
| OpenAI Client | `server/ai/openaiClient.ts` | Fetch-based OpenAI implementation |
| OpenRouter Client | `server/ai/openrouterClient.ts` | Fetch-based OpenRouter implementation |
| Provider Selection | `server/ai/index.ts` | Selects provider based on config |
| Safe Tools | `server/ai/tools.ts` | Read-only documentation helpers |
| Doc Assistant | `server/ai/docAssistantCore.ts` | AI-powered docs Q&A |

### 8.3 Provider Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI authentication | Required for OpenAI |
| `AI_PROVIDER` | Select provider (`openai` or `openrouter`) | `openai` |
| `OPENROUTER_API_KEY` | OpenRouter authentication | Required for OpenRouter |
| `OPENAI_MODEL` | Override default OpenAI model | `gpt-4o-mini` |
| `OPENROUTER_MODEL` | Override default OpenRouter model | `openai/gpt-4o-mini` |

### 8.4 Usage

```typescript
import { llm, getLLMStatus } from "@/ai/index";

// Check provider status
const status = getLLMStatus();
console.log(`Using: ${status.provider}, Available: ${status.available}`);

// Make a call
const response = await llm.call({
  system: "You are a helpful assistant.",
  messages: [{ role: "user", content: "Hello" }],
  maxTokens: 500,
  temperature: 0.3,
});

console.log(response.text);
```

### 8.5 Tool Calling

```typescript
import { llm, LLMTool } from "@/ai/index";

const tools: LLMTool[] = [{
  type: "function",
  function: {
    name: "getWeather",
    description: "Get current weather",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name" }
      },
      required: ["location"]
    }
  }
}];

const response = await llm.call({
  system: "You are a helpful assistant.",
  messages: [{ role: "user", content: "What's the weather in NYC?" }],
  tools,
  toolChoice: "auto",
});

if (response.toolCalls) {
  for (const call of response.toolCalls) {
    console.log(`Tool: ${call.name}, Args: ${JSON.stringify(call.arguments)}`);
  }
}
```

### 8.6 Safe Helper Use Cases

The LLMClient is used for **safe, read-only helper tasks**:

| Use Case | Allowed | Notes |
|----------|---------|-------|
| Docs Q&A | Yes | Via Doc Assistant CLI |
| Log summarization | Yes | Anonymized logs only |
| Code explanations | Yes | Read-only analysis |
| Trading decisions | Special | Via existing decision engine only |
| Order placement | No | Never via LLMClient |
| Config changes | No | Never via LLMClient |

---

## 9. Doc Assistant Tool

### 9.1 Purpose

A dev-only CLI tool for asking questions about the system based on documentation.

### 9.2 Usage

```bash
npx tsx tools/doc_assistant/index.ts "How is Total P&L calculated?"
```

### 9.3 Safety

- **DEV-ONLY** - Not exposed via API or UI
- **Read-only** - Only reads from docs/*.md files
- **No secrets** - Cannot access credentials or PII
- **No trading** - Cannot place orders or modify state

See `docs/DOC_ASSISTANT.md` for full documentation.

---

## Related Documentation

| Document | Relevance |
|----------|-----------|
| `AGENT_EXECUTION_GUIDE.md` | Section 14: AI Models & Provider Governance |
| `DOC_ASSISTANT.md` | Dev-only documentation helper |
| `OBSERVABILITY.md` | AI logging category (`log.ai()`) |
| `TESTING.md` | AI-related test patterns |
| `ARCHITECTURE.md` | AI layer in system design |

---

*Last Updated: December 2024*
