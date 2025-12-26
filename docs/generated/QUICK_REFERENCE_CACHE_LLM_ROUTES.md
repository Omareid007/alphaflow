# Quick Reference: Cache & LLM Routes

## Files Created

```
server/routes/
├── cache.ts          (131 lines, 4.0 KB, 6 endpoints)
└── llm.ts            (94 lines, 2.7 KB, 4 endpoints)
```

## Endpoint Quick Reference

### Cache Routes (`/api/cache`)

```
GET    /api/cache/llm/stats                Get LLM cache statistics
POST   /api/cache/llm/clear                Clear entire LLM cache
POST   /api/cache/llm/clear/:role          Clear LLM cache for role
POST   /api/cache/llm/reset-stats          Reset LLM cache stats
GET    /api/cache/api?provider=alpaca      Get API cache stats & entries
POST   /api/cache/api/purge                Purge API cache entries
```

### LLM Routes (`/api/llm`)

```
GET    /api/llm/configs                    Get all role-based router configs
PUT    /api/llm/configs/:role              Update role-based router config
GET    /api/llm/calls?role=X&limit=20      Get recent LLM calls (filtered)
GET    /api/llm/stats                      Get LLM call statistics
```

## Valid Roles

- `market_news_summarizer`
- `technical_analyst`
- `risk_manager`
- `execution_planner`
- `post_trade_reporter`

## Example Requests

### Get LLM Cache Stats
```bash
curl -X GET http://localhost:3000/api/cache/llm/stats
```

### Clear Technical Analyst Cache
```bash
curl -X POST http://localhost:3000/api/cache/llm/clear/technical_analyst
```

### Get All Configs
```bash
curl -X GET http://localhost:3000/api/llm/configs
```

### Update Risk Manager Config
```bash
curl -X PUT http://localhost:3000/api/llm/configs/risk_manager \
  -H "Content-Type: application/json" \
  -d '{"provider":"gpt4","temperature":0.3}'
```

### Get Recent Calls (Last 10)
```bash
curl -X GET http://localhost:3000/api/llm/calls?limit=10
```

### Purge API Cache for Alpaca
```bash
curl -X POST http://localhost:3000/api/cache/api/purge \
  -H "Content-Type: application/json" \
  -d '{"provider":"alpaca"}'
```

## Integration Checklist

- [ ] Add imports to routes.ts
- [ ] Mount routers in main app
- [ ] Remove old inline handlers (lines 2693-2733, 4304-4344, 4821-4872)
- [ ] Update client API paths if needed
- [ ] Test all endpoints
- [ ] Verify no breaking changes

## Migration Path Reference

Old Path → New Path
- `/api/ai/cache/stats` → `/api/cache/llm/stats`
- `/api/ai/cache/clear` → `/api/cache/llm/clear`
- `/api/ai/cache/clear/:role` → `/api/cache/llm/clear/:role`
- `/api/ai/cache/reset-stats` → `/api/cache/llm/reset-stats`
- `/api/admin/api-cache` → `/api/cache/api`
- `/api/admin/api-cache/purge` → `/api/cache/api/purge`
- `/api/admin/model-router/configs` → `/api/llm/configs`
- `/api/admin/model-router/configs/:role` → `/api/llm/configs/:role`
- `/api/admin/model-router/calls` → `/api/llm/calls`
- `/api/admin/model-router/stats` → `/api/llm/stats`

## Dependencies

### cache.ts imports
- `express` (Router, Request, Response)
- `../utils/logger` (log)
- `../lib/standard-errors` (badRequest, serverError)
- `../lib/persistentApiCache` (getCacheStats, invalidateCache, etc.)
- `../ai/llmGateway` (getLLMCacheStats, clearLLMCache, etc.)

### llm.ts imports
- `express` (Router, Request, Response)
- `../utils/logger` (log)
- `../lib/standard-errors` (badRequest)
- `../ai/roleBasedRouter` (roleBasedRouter, getAllRoleConfigs, etc.)

## Parameter Reference

### Cache API Purge
```typescript
{
  provider?: string;      // e.g., "alpaca", "finnhub"
  key?: string;          // Specific cache key to invalidate
  expiredOnly?: boolean; // Purge only expired entries
}
```

### LLM Calls Query
```typescript
?role=technical_analyst&limit=10
```

### Role Config Update
```typescript
{
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  // other RoleConfig fields
}
```

## Error Handling

All endpoints use standard error responses:

```json
{
  "error": "Error message",
  "details": {}  // Optional
}
```

Status codes:
- 200: Success
- 400: Bad Request (validation error)
- 404: Not Found
- 500: Server Error

## Features Implemented

1. **Type Safety**: Full TypeScript support
2. **Error Handling**: Standard error helpers
3. **Logging**: Context-aware logging
4. **Validation**: Parameter validation
5. **Documentation**: Clear comments and structure
6. **Pattern Consistency**: Follows routes/strategies.ts pattern

## Testing Commands

```bash
# Test LLM cache endpoints
curl http://localhost:3000/api/cache/llm/stats
curl -X POST http://localhost:3000/api/cache/llm/clear
curl http://localhost:3000/api/cache/llm/clear/technical_analyst

# Test LLM config endpoints
curl http://localhost:3000/api/llm/configs
curl http://localhost:3000/api/llm/calls
curl http://localhost:3000/api/llm/stats

# Test API cache endpoints
curl http://localhost:3000/api/cache/api
curl -X POST http://localhost:3000/api/cache/api/purge -d '{"provider":"alpaca"}'
```

## File Sizes & Stats

| File | Lines | Size | Endpoints |
|------|-------|------|-----------|
| cache.ts | 132 | 4.0 KB | 6 |
| llm.ts | 94 | 2.7 KB | 4 |
| **Total** | **226** | **6.7 KB** | **10** |

## Architecture Notes

- Both files follow Express Router pattern
- No circular dependencies
- All functions are async for consistency
- Error messages are descriptive
- Logging includes module context
- Query/path/body parameters properly typed

## Support References

- Pattern: `/home/runner/workspace/server/routes/strategies.ts`
- Logger: `/home/runner/workspace/server/utils/logger.ts`
- Errors: `/home/runner/workspace/server/lib/standard-errors.ts`
- Integration Guide: `/home/runner/workspace/ROUTE_EXTRACTION_GUIDE.md`
