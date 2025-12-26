# API Usage Examples

This document provides complete examples for all newly added backend API endpoints.

## Strategy Management Endpoints

### 1. Deploy Strategy (POST /api/strategies/:id/deploy)

Deploy a strategy to paper or live trading mode.

**Example: Deploy to Paper Trading**
```bash
curl -X POST http://localhost:5000/api/strategies/strategy-123/deploy \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-session-id" \
  -d '{
    "mode": "paper"
  }'
```

**Example: Deploy to Live Trading**
```bash
curl -X POST http://localhost:5000/api/strategies/strategy-123/deploy \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-session-id" \
  -d '{
    "mode": "live"
  }'
```

**Success Response (200)**
```json
{
  "success": true,
  "strategy": {
    "id": "strategy-123",
    "name": "My Trading Strategy",
    "type": "momentum",
    "isActive": true,
    "parameters": "{\"deploymentMode\":\"paper\",\"deployedAt\":\"2025-01-15T10:30:00.000Z\",...}",
    "createdAt": "2025-01-10T08:00:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  "mode": "paper",
  "message": "Strategy deployed to paper mode successfully"
}
```

**Error Response (400)**
```json
{
  "error": "Invalid mode. Must be 'paper' or 'live'"
}
```

**JavaScript/TypeScript Example**
```typescript
async function deployStrategy(strategyId: string, mode: 'paper' | 'live') {
  const response = await fetch(`/api/strategies/${strategyId}/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ mode }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return await response.json();
}

// Usage
try {
  const result = await deployStrategy('strategy-123', 'paper');
  console.log('Strategy deployed:', result.message);
} catch (error) {
  console.error('Deployment failed:', error.message);
}
```

---

### 2. Pause Strategy (POST /api/strategies/:id/pause)

Pause a running strategy without deleting it.

**cURL Example**
```bash
curl -X POST http://localhost:5000/api/strategies/strategy-123/pause \
  -H "Cookie: session=your-session-id"
```

**Success Response (200)**
```json
{
  "success": true,
  "strategy": {
    "id": "strategy-123",
    "name": "My Trading Strategy",
    "type": "momentum",
    "isActive": false,
    "parameters": "{\"paused\":true,\"pausedAt\":\"2025-01-15T10:35:00.000Z\",...}",
    "createdAt": "2025-01-10T08:00:00.000Z",
    "updatedAt": "2025-01-15T10:35:00.000Z"
  },
  "message": "Strategy paused successfully"
}
```

**Error Response (400)**
```json
{
  "error": "Strategy is already paused"
}
```

**React Hook Example**
```typescript
import { useMutation } from '@tanstack/react-query';

function usePauseStrategy() {
  return useMutation({
    mutationFn: async (strategyId: string) => {
      const response = await fetch(`/api/strategies/${strategyId}/pause`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      return await response.json();
    },
    onSuccess: (data) => {
      console.log('Strategy paused:', data.message);
    },
  });
}

// Usage in component
function StrategyCard({ strategyId }: { strategyId: string }) {
  const pauseMutation = usePauseStrategy();

  return (
    <button
      onClick={() => pauseMutation.mutate(strategyId)}
      disabled={pauseMutation.isPending}
    >
      {pauseMutation.isPending ? 'Pausing...' : 'Pause Strategy'}
    </button>
  );
}
```

---

### 3. Resume Strategy (POST /api/strategies/:id/resume)

Resume a paused strategy.

**cURL Example**
```bash
curl -X POST http://localhost:5000/api/strategies/strategy-123/resume \
  -H "Cookie: session=your-session-id"
```

**Success Response (200)**
```json
{
  "success": true,
  "strategy": {
    "id": "strategy-123",
    "name": "My Trading Strategy",
    "type": "momentum",
    "isActive": true,
    "parameters": "{\"resumedAt\":\"2025-01-15T10:40:00.000Z\",...}",
    "createdAt": "2025-01-10T08:00:00.000Z",
    "updatedAt": "2025-01-15T10:40:00.000Z"
  },
  "message": "Strategy resumed successfully"
}
```

**Axios Example**
```typescript
import axios from 'axios';

async function resumeStrategy(strategyId: string) {
  try {
    const { data } = await axios.post(
      `/api/strategies/${strategyId}/resume`,
      {},
      { withCredentials: true }
    );

    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error || 'Failed to resume strategy');
    }
    throw error;
  }
}
```

---

### 4. Delete Strategy (DELETE /api/strategies/:id)

Permanently delete a strategy. If the strategy is running, it will be stopped first.

**cURL Example**
```bash
curl -X DELETE http://localhost:5000/api/strategies/strategy-123 \
  -H "Cookie: session=your-session-id"
```

**Success Response (200)**
```json
{
  "success": true,
  "message": "Strategy deleted successfully"
}
```

**Error Response (404)**
```json
{
  "error": "Strategy not found"
}
```

**TypeScript Example with Confirmation**
```typescript
async function deleteStrategy(strategyId: string): Promise<void> {
  const confirmed = window.confirm(
    'Are you sure you want to delete this strategy? This action cannot be undone.'
  );

  if (!confirmed) {
    return;
  }

  const response = await fetch(`/api/strategies/${strategyId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const result = await response.json();
  console.log(result.message);
}
```

---

## AI Decisions & Events Endpoints

### 5. Get AI Decisions (GET /api/decisions)

Alias for `/api/ai-decisions`. Get recent AI trading decisions.

**cURL Example**
```bash
curl http://localhost:5000/api/decisions?limit=20 \
  -H "Cookie: session=your-session-id"
```

**Success Response (200)**
```json
[
  {
    "id": "decision-456",
    "symbol": "AAPL",
    "action": "buy",
    "confidence": "0.85",
    "reasoning": "Strong upward momentum with bullish technicals",
    "strategyId": "strategy-123",
    "status": "pending",
    "traceId": "trace-789",
    "executedTradeId": null,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  },
  {
    "id": "decision-455",
    "symbol": "TSLA",
    "action": "hold",
    "confidence": "0.60",
    "reasoning": "Market conditions uncertain",
    "strategyId": "strategy-123",
    "status": "completed",
    "traceId": "trace-788",
    "executedTradeId": "trade-999",
    "createdAt": "2025-01-15T09:30:00.000Z",
    "updatedAt": "2025-01-15T09:35:00.000Z"
  }
]
```

**React Query Hook**
```typescript
import { useQuery } from '@tanstack/react-query';

interface AIDecision {
  id: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: string;
  reasoning: string;
  strategyId: string | null;
  status: string;
  createdAt: string;
}

function useAIDecisions(limit: number = 20) {
  return useQuery({
    queryKey: ['ai-decisions', limit],
    queryFn: async (): Promise<AIDecision[]> => {
      const response = await fetch(`/api/decisions?limit=${limit}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI decisions');
      }

      return await response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

// Usage in component
function AIDecisionsList() {
  const { data: decisions, isLoading, error } = useAIDecisions(50);

  if (isLoading) return <div>Loading decisions...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {decisions?.map((decision) => (
        <div key={decision.id}>
          <strong>{decision.symbol}</strong>: {decision.action}
          ({(parseFloat(decision.confidence) * 100).toFixed(0)}% confidence)
          <p>{decision.reasoning}</p>
        </div>
      ))}
    </div>
  );
}
```

---

### 6. Get AI Events (GET /api/ai/events)

Get combined AI system events including decisions and orchestrator activity.

**cURL Example**
```bash
curl "http://localhost:5000/api/ai/events?limit=50&offset=0" \
  -H "Cookie: session=your-session-id"
```

**Success Response (200)**
```json
{
  "events": [
    {
      "id": "decision-456",
      "type": "ai_decision",
      "timestamp": "2025-01-15T10:00:00.000Z",
      "symbol": "AAPL",
      "action": "buy",
      "confidence": 0.85,
      "reasoning": "Strong upward momentum with bullish technicals",
      "metadata": {
        "strategyId": "strategy-123",
        "traceId": "trace-789",
        "status": "pending",
        "executedTradeId": null
      }
    },
    {
      "id": "orch-1736937600000",
      "type": "orchestrator_event",
      "timestamp": "2025-01-15T09:55:00.000Z",
      "symbol": "MSFT",
      "action": "position_opened",
      "metadata": {
        "quantity": 10,
        "price": 415.50,
        "reason": "AI signal execution"
      }
    }
  ],
  "total": 145,
  "hasMore": true
}
```

**TypeScript Example with Pagination**
```typescript
interface AIEvent {
  id: string;
  type: 'ai_decision' | 'orchestrator_event';
  timestamp: string;
  symbol: string;
  action: string;
  confidence?: number;
  reasoning?: string;
  metadata: Record<string, any>;
}

interface AIEventsResponse {
  events: AIEvent[];
  total: number;
  hasMore: boolean;
}

async function getAIEvents(limit: number = 50, offset: number = 0): Promise<AIEventsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`/api/ai/events?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return await response.json();
}

// Usage with infinite scroll
function AIEventsTimeline() {
  const [events, setEvents] = useState<AIEvent[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await getAIEvents(50, offset);
      setEvents((prev) => [...prev, ...response.events]);
      setOffset((prev) => prev + 50);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMore();
  }, []);

  return (
    <div>
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

---

## Complete Integration Example

Here's a complete example showing how to use all endpoints together in a strategy management component:

```typescript
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface Strategy {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  parameters: string;
}

function StrategyManager() {
  const queryClient = useQueryClient();
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  // Fetch strategies
  const { data: strategies } = useQuery({
    queryKey: ['strategies'],
    queryFn: async (): Promise<Strategy[]> => {
      const res = await fetch('/api/strategies', { credentials: 'include' });
      return res.json();
    },
  });

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'paper' | 'live' }) => {
      const res = await fetch(`/api/strategies/${id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strategies'] }),
  });

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/strategies/${id}/pause`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strategies'] }),
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/strategies/${id}/resume`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strategies'] }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/strategies/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strategies'] }),
  });

  return (
    <div className="strategy-manager">
      <h2>Strategy Manager</h2>

      {strategies?.map((strategy) => (
        <div key={strategy.id} className="strategy-card">
          <h3>{strategy.name}</h3>
          <p>Type: {strategy.type}</p>
          <p>Status: {strategy.isActive ? 'Running' : 'Paused'}</p>

          <div className="actions">
            <button
              onClick={() => deployMutation.mutate({ id: strategy.id, mode: 'paper' })}
            >
              Deploy to Paper
            </button>

            <button
              onClick={() => deployMutation.mutate({ id: strategy.id, mode: 'live' })}
            >
              Deploy to Live
            </button>

            {strategy.isActive ? (
              <button onClick={() => pauseMutation.mutate(strategy.id)}>
                Pause
              </button>
            ) : (
              <button onClick={() => resumeMutation.mutate(strategy.id)}>
                Resume
              </button>
            )}

            <button
              onClick={() => {
                if (confirm('Delete this strategy?')) {
                  deleteMutation.mutate(strategy.id);
                }
              }}
              className="danger"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default StrategyManager;
```

---

## Error Handling Best Practices

All endpoints follow consistent error handling. Here's a reusable error handler:

```typescript
interface APIError {
  error: string;
  reason?: string;
  [key: string]: any;
}

async function handleAPICall<T>(
  promise: Promise<Response>
): Promise<T> {
  try {
    const response = await promise;

    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw with context
      throw new Error(`API call failed: ${error.message}`);
    }
    throw error;
  }
}

// Usage
async function deployStrategy(id: string, mode: 'paper' | 'live') {
  return handleAPICall<{ success: boolean; strategy: Strategy; message: string }>(
    fetch(`/api/strategies/${id}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mode }),
    })
  );
}
```

---

## Testing Commands

Run these commands to test each endpoint:

```bash
# Set your session cookie
export SESSION="your-session-cookie-here"

# Deploy to paper mode
curl -X POST http://localhost:5000/api/strategies/test-id/deploy \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$SESSION" \
  -d '{"mode":"paper"}'

# Pause strategy
curl -X POST http://localhost:5000/api/strategies/test-id/pause \
  -H "Cookie: session=$SESSION"

# Resume strategy
curl -X POST http://localhost:5000/api/strategies/test-id/resume \
  -H "Cookie: session=$SESSION"

# Delete strategy
curl -X DELETE http://localhost:5000/api/strategies/test-id \
  -H "Cookie: session=$SESSION"

# Get AI decisions
curl http://localhost:5000/api/decisions?limit=20 \
  -H "Cookie: session=$SESSION"

# Get AI events
curl "http://localhost:5000/api/ai/events?limit=50&offset=0" \
  -H "Cookie: session=$SESSION"
```
