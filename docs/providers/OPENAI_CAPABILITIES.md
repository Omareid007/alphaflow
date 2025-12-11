# OpenAI API - Capability Mapping

## Provider Overview
| Attribute | Value |
|-----------|-------|
| **Provider** | OpenAI |
| **Type** | LLM / AI Inference |
| **Models** | GPT-4o, GPT-4o-mini (default), GPT-4-turbo |
| **Rate Limits** | Tier-based (TPM/RPM) |
| **Documentation** | https://platform.openai.com/docs |

---

## Current Usage Summary

### Actively Used (✅)
| Feature | Implementation | File |
|---------|---------------|------|
| Chat Completions | Basic `POST /chat/completions` | `server/ai/openaiClient.ts` |
| Tool Calling | `tools` parameter, parse `tool_calls` | `server/ai/openaiClient.ts` |
| System Prompts | `system` message role | `server/ai/openaiClient.ts` |
| Temperature Control | `temperature` parameter | `server/ai/openaiClient.ts` |
| Max Tokens | `max_tokens` parameter | `server/ai/openaiClient.ts` |

### Not Yet Implemented (❌)
| Feature | OpenAI Capability | Impact |
|---------|------------------|--------|
| **Structured Outputs** | `strict: true` on tools | Guaranteed JSON schema compliance |
| **Response Format** | `response_format: { type: "json_schema" }` | Structured user responses |
| **Batch API** | `/v1/batch` | 50% cost savings, async processing |
| **Streaming** | `stream: true` | Real-time responses |
| **Vision** | Image inputs | Chart analysis (future) |
| **Embeddings** | `/v1/embeddings` | Semantic similarity |
| **Moderation** | `/v1/moderations` | Content filtering |
| **Fine-tuning** | Custom models | Domain-specific training |
| **Assistants API** | Persistent context | Multi-turn conversations |

---

## High-Impact Underused Capabilities

### 1. Structured Outputs with Strict Mode (CRITICAL)
**Current State:** Tool calling without `strict: true`
**Problem:** Model may return malformed JSON, wrong types, missing fields
**Solution:** Enable strict mode for guaranteed schema compliance

```typescript
// Current (fragile)
const tools = [{
  type: "function",
  function: {
    name: "trading_decision",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string" },
        symbol: { type: "string" },
        confidence: { type: "number" }
      }
    }
  }
}];

// Improved (guaranteed schema)
const tools = [{
  type: "function",
  function: {
    name: "trading_decision",
    strict: true,  // <-- CRITICAL
    parameters: {
      type: "object",
      properties: {
        action: { 
          type: "string", 
          enum: ["buy", "sell", "hold"]  // Constrained values
        },
        symbol: { type: "string" },
        confidence: { type: "number" },
        reasoning: { type: "string" }
      },
      required: ["action", "symbol", "confidence", "reasoning"],
      additionalProperties: false  // <-- REQUIRED for strict
    }
  }
}];

// Also requires
body.parallel_tool_calls = false;  // <-- REQUIRED for structured outputs
```

**Benefits:**
- 100% schema compliance - no parsing errors
- Guaranteed enum values - no invalid actions
- All required fields present - no null checks needed
- Eliminates try/catch around JSON.parse

### 2. Response Format for Structured Responses
**Use Case:** When AI responds directly to user (not calling tools)

```typescript
// For analysis responses that need structure
const body = {
  model: "gpt-4o-2024-08-06",
  messages: [...],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "market_analysis",
      strict: true,
      schema: {
        type: "object",
        properties: {
          sentiment: { type: "string", enum: ["bullish", "bearish", "neutral"] },
          key_factors: { 
            type: "array", 
            items: { type: "string" } 
          },
          risk_score: { type: "number" },
          recommendation: { type: "string" }
        },
        required: ["sentiment", "key_factors", "risk_score", "recommendation"],
        additionalProperties: false
      }
    }
  }
};
```

### 3. Batch API (50% Cost Savings)
**Endpoint:** `/v1/batch`
**Impact:** Massive cost reduction for non-urgent AI processing

**Perfect Use Cases:**
- End-of-day portfolio analysis
- Universe screening (50+ symbols)
- Historical decision backtesting
- Bulk sentiment analysis

```typescript
// Step 1: Prepare JSONL file
const batchRequests = tradingUniverse.map((symbol, index) => ({
  custom_id: `analysis-${symbol}`,
  method: "POST",
  url: "/v1/chat/completions",
  body: {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Analyze this stock..." },
      { role: "user", content: `Symbol: ${symbol}\nData: ${JSON.stringify(data)}` }
    ],
    tools: analysisTools,
    parallel_tool_calls: false
  }
}));

// Write to JSONL
const jsonl = batchRequests.map(r => JSON.stringify(r)).join('\n');

// Step 2: Upload and create batch
const file = await openai.files.create({
  file: Buffer.from(jsonl),
  purpose: "batch"
});

const batch = await openai.batches.create({
  input_file_id: file.id,
  endpoint: "/v1/chat/completions",
  completion_window: "24h"
});

// Step 3: Poll for completion
// Batch completes within 24h at 50% cost
```

**Cost Comparison:**
| Scenario | Standard API | Batch API | Savings |
|----------|-------------|-----------|---------|
| 50 stock analysis | $0.50 | $0.25 | 50% |
| 100 daily decisions | $1.00 | $0.50 | 50% |
| Universe screening | $2.00 | $1.00 | 50% |

### 4. Streaming for Real-Time UI
**Current:** Wait for full response
**Improved:** Stream tokens for better UX

```typescript
const response = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({
    ...request,
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
  
  for (const line of lines) {
    const data = JSON.parse(line.slice(6));
    if (data.choices[0].delta.content) {
      // Emit partial response to UI
      emit('ai_response', data.choices[0].delta.content);
    }
  }
}
```

### 5. Embeddings for Semantic Analysis
**Endpoint:** `/v1/embeddings`
**Use Cases:**
- News similarity clustering
- Historical pattern matching
- Semantic search over AI decisions

```typescript
const response = await fetch(`${baseUrl}/embeddings`, {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({
    model: "text-embedding-3-small",
    input: "AAPL earnings beat expectations with strong iPhone sales"
  })
});

const { data } = await response.json();
const embedding = data[0].embedding;  // 1536-dimensional vector

// Compare with historical news embeddings
const similarity = cosineSimilarity(embedding, historicalEmbedding);
```

---

## Capability Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Structured Outputs (`strict: true`) | HIGH | LOW | P0 |
| Batch API | HIGH | MEDIUM | P0 |
| Response Format | MEDIUM | LOW | P1 |
| Streaming | MEDIUM | MEDIUM | P2 |
| Embeddings | LOW | LOW | P3 |
| Vision | LOW | MEDIUM | P4 |

---

## Implementation Plan

### Phase 1: Structured Outputs (Immediate)

**File:** `server/ai/openaiClient.ts`

```typescript
// Add strict mode support to LLMRequest
interface LLMRequest {
  // ... existing
  strictMode?: boolean;  // Enable structured outputs
}

// Update call() method
async call(req: LLMRequest): Promise<LLMResponse> {
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: req.temperature ?? DEFAULT_TEMPERATURE,
  };

  if (req.tools && req.tools.length > 0) {
    // Add strict mode to all tools if enabled
    body.tools = req.strictMode 
      ? req.tools.map(tool => ({
          ...tool,
          function: { ...tool.function, strict: true }
        }))
      : req.tools;
    
    // Disable parallel calls for structured outputs
    if (req.strictMode) {
      body.parallel_tool_calls = false;
    }
    
    if (req.toolChoice) {
      body.tool_choice = req.toolChoice;
    }
  }
  // ...
}
```

### Phase 2: Batch API

**New File:** `server/ai/batchProcessor.ts`

```typescript
export class OpenAIBatchProcessor {
  async createBatch(requests: BatchRequest[]): Promise<string> {
    // 1. Write JSONL
    // 2. Upload file
    // 3. Create batch
    // 4. Return batch ID
  }

  async checkBatch(batchId: string): Promise<BatchStatus> {
    // Poll batch status
  }

  async retrieveResults(batchId: string): Promise<BatchResult[]> {
    // Download and parse results
  }

  async processUniverseAnalysis(symbols: string[]): Promise<AnalysisResult[]> {
    // High-level helper for bulk analysis
  }
}
```

---

## Model Selection Guide

| Use Case | Model | Reason |
|----------|-------|--------|
| Quick decisions | gpt-4o-mini | Fast, cheap, good enough |
| Complex analysis | gpt-4o | Better reasoning |
| Batch processing | gpt-4o-mini | Cost optimization |
| Function calling | gpt-4o-mini+ | All support tools |

### Cost Comparison (per 1M tokens)
| Model | Input | Output | Best For |
|-------|-------|--------|----------|
| gpt-4o-mini | $0.15 | $0.60 | High volume |
| gpt-4o | $2.50 | $10.00 | Complex tasks |
| gpt-4o (batch) | $1.25 | $5.00 | Async bulk |

---

## Best Practices

### Tool Definitions
```typescript
// DO: Constrain with enums
{
  action: { type: "string", enum: ["buy", "sell", "hold"] }
}

// DON'T: Open-ended strings
{
  action: { type: "string" }  // Model might return "purchase", "long", etc.
}
```

### Schema Design
```typescript
// DO: Simple flat structure
{
  symbol: "string",
  action: "string",
  confidence: "number"
}

// DON'T: Deep nesting (reduces accuracy)
{
  trade: {
    details: {
      action: {
        type: "string"
      }
    }
  }
}
```

### Error Handling
```typescript
// DO: Retry with exponential backoff
async function callWithRetry(req, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await openai.call(req);
    } catch (error) {
      if (error.isRateLimit) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

---

## Recommendations

### Immediate Actions
1. **Enable strict mode** on all tool definitions
2. **Add `parallel_tool_calls: false`** to request body
3. **Validate tool schemas** against OpenAI requirements

### Short-term
1. **Implement batch processor** for universe screening
2. **Add response format** for structured analysis output
3. **Optimize model selection** by task type

### Long-term
1. Consider fine-tuning on trading decisions
2. Add embeddings for pattern matching
3. Implement streaming for real-time UI
