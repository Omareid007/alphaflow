# OpenAPI Documentation Rules

**Applies when editing**:
- `docs/api/**` - OpenAPI specifications
- `server/routes/**/*.ts` - API route implementations
- `scripts/generate-openapi.ts` - OpenAPI generation scripts (if created)
- `scripts/validate-openapi.ts` - OpenAPI validation scripts (if created)

---

## Overview

The AlphaFlow Trading Platform maintains a comprehensive OpenAPI 3.0.3 specification documenting **350+ API endpoints** across **8 core capabilities**. This rule ensures API documentation stays synchronized with implementation and follows industry best practices.

**Current Status**:
- **OpenAPI Spec**: `/docs/api/OPENAPI_SPEC.yaml` (1,047 lines)
- **Endpoints Documented**: 19+ paths (growing to 350+)
- **Route Files**: 56 TypeScript files in `server/routes/`
- **Specification System**: OpenSpec v0.17.2 integrated (see `openspec/AGENTS.md`)

---

## When to Update OpenAPI Spec

### ✅ ALWAYS Update When

1. **Adding New Endpoints**
   - New route handler in `server/routes/`
   - New Express router registration in `server/routes.ts`
   - New API path in any domain (auth, trading, strategies, etc.)

2. **Modifying Existing Endpoints**
   - Changing request/response schemas
   - Adding/removing query parameters or path parameters
   - Changing HTTP methods
   - Updating validation rules (Zod schemas)

3. **Breaking Changes**
   - Removing endpoints or deprecating fields
   - Changing data types or formats
   - Altering authentication requirements
   - Modifying rate limits or permissions

4. **Adding Response Codes**
   - New error conditions (400, 401, 403, 404, 500, etc.)
   - New success responses (200, 201, 204)
   - Rate limiting responses (429)

### ⚠️ Consider Updating When

- Adding new error messages to existing endpoints
- Updating validation constraints (min/max values, regex patterns)
- Changing default values
- Adding optional parameters
- Updating examples in schemas

### ❌ NO Update Needed For

- Internal refactoring without API contract changes
- Code comments or JSDoc updates
- Implementation details (database queries, business logic)
- Middleware changes that don't affect API behavior

---

## OpenAPI Specification Maintenance

### File Structure

```yaml
docs/api/
  └── OPENAPI_SPEC.yaml        # Main OpenAPI 3.0.3 specification
```

### Specification Sections

1. **Info Block** (lines 1-19)
   - Version: `1.0.0` (increment for breaking changes)
   - Description: Include authentication, rate limiting, features
   - Contact and license information

2. **Servers** (lines 20-24)
   - Development: `http://localhost:5000/api`
   - Production: `https://alphaflow.app/api`

3. **Tags** (lines 26-38)
   - Auth, Portfolio, Orders, Strategies, Backtests, Admin
   - Add new tags for new capability domains

4. **Paths** (lines 40+)
   - Organized by domain (`/auth`, `/portfolio`, `/orders`, etc.)
   - Each endpoint includes: tags, summary, description, parameters, requestBody, responses, security

5. **Components** (bottom of file)
   - Schemas: Reusable data models (map to Zod schemas in `shared/schema/`)
   - Responses: Common responses (Unauthorized, NotFound, ServerError)
   - SecuritySchemes: sessionAuth, apiKeyAuth

### Schema Mapping

Map TypeScript types to OpenAPI schemas:

```typescript
// shared/schema/auth.ts
export const insertUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});
```

```yaml
# docs/api/OPENAPI_SPEC.yaml
components:
  schemas:
    UserSignupRequest:
      type: object
      required: [username, password]
      properties:
        username:
          type: string
          minLength: 3
          example: trader_john
        password:
          type: string
          format: password
          minLength: 6
```

---

## Documentation Standards

### Endpoint Documentation Template

```yaml
/api/{domain}/{resource}:
  {method}:
    tags: [DomainName]
    summary: Brief description (5-10 words)
    description: |
      Detailed multi-line description explaining:
      - What the endpoint does
      - When to use it
      - Important constraints or behavior
    operationId: uniqueOperationId  # camelCase, e.g., getUserProfile
    parameters:
      - name: paramName
        in: path|query|header
        required: true|false
        description: Parameter purpose
        schema:
          type: string|number|boolean|array
          format: uuid|date-time|email (if applicable)
          enum: [value1, value2]  # if limited values
    requestBody:
      required: true|false
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/SchemaName'
          example:
            field1: value1
            field2: value2
    responses:
      '200':
        description: Success case description
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ResponseSchemaName'
      '400':
        $ref: '#/components/responses/BadRequest'
      '401':
        $ref: '#/components/responses/Unauthorized'
      '500':
        $ref: '#/components/responses/ServerError'
    security:
      - sessionAuth: []  # if authentication required
```

### Response Documentation

**Standard Responses** (use `$ref` for consistency):

```yaml
components:
  responses:
    Unauthorized:
      description: Authentication required or session expired
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: Unauthorized

    BadRequest:
      description: Invalid request data or validation error
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
              details:
                type: array
                items:
                  type: object

    ServerError:
      description: Internal server error
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: Internal server error
```

### Schema Best Practices

1. **Use `$ref` for Reusability**
   ```yaml
   # ✅ GOOD: Reusable schema
   schema:
     $ref: '#/components/schemas/Strategy'

   # ❌ BAD: Inline duplication
   schema:
     type: object
     properties:
       id: { type: string }
       name: { type: string }
   ```

2. **Include Examples**
   ```yaml
   properties:
     symbol:
       type: string
       example: AAPL
       description: Stock ticker symbol
   ```

3. **Document Constraints**
   ```yaml
   properties:
     quantity:
       type: integer
       minimum: 1
       maximum: 10000
       description: Number of shares (1-10,000)
   ```

4. **Use Enums for Fixed Values**
   ```yaml
   side:
     type: string
     enum: [buy, sell]
     description: Order side
   ```

---

## API Versioning Strategy

### Current Version: v1.0.0

**Semantic Versioning**:
- **MAJOR** (1.x.x): Breaking changes (remove endpoints, change types)
- **MINOR** (x.1.x): New features (add endpoints, add optional fields)
- **PATCH** (x.x.1): Bug fixes, documentation updates

### Breaking Change Management

1. **Deprecation Process**
   ```yaml
   /api/old-endpoint:
     get:
       deprecated: true
       description: |
         ⚠️ DEPRECATED: Use /api/new-endpoint instead.
         This endpoint will be removed in v2.0.0 (scheduled: 2026-06-01)
   ```

2. **Migration Guide**
   - Document in `docs/api/MIGRATION_GUIDE.md`
   - Provide side-by-side examples
   - Set sunset dates (minimum 90 days notice)

3. **Version Headers**
   ```yaml
   parameters:
     - name: X-API-Version
       in: header
       schema:
         type: string
         enum: [v1, v2]
         default: v1
   ```

---

## Integration with OpenSpec

**OpenSpec System**: AlphaFlow uses OpenSpec v0.17.2 for specification-driven development.

### When to Use OpenSpec vs. OpenAPI

| Use Case | Tool | File Location |
|----------|------|---------------|
| High-level capability requirements | OpenSpec | `openspec/specs/*.md` |
| API contract documentation | OpenAPI | `docs/api/OPENAPI_SPEC.yaml` |
| Implementation planning | OpenSpec | `openspec/changes/*.md` |
| Interactive API testing | OpenAPI | Swagger UI / ReDoc |

### Workflow Integration

1. **New Feature Planning**
   - Start with OpenSpec change proposal (`openspec/changes/`)
   - Define requirements and scenarios
   - Extract API contracts to OpenAPI spec

2. **Implementation**
   - Implement route handlers in `server/routes/`
   - Update OpenAPI spec for new endpoints
   - Validate with OpenSpec: `npx openspec validate`

3. **Documentation**
   - OpenSpec tracks requirements and scenarios
   - OpenAPI provides API reference
   - Both stay synchronized through reviews

---

## Swagger UI / ReDoc (Future)

**Status**: Not yet implemented

**Planned Integration**:

```typescript
// server/routes/docs.ts (FUTURE)
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const swaggerDocument = YAML.load('./docs/api/OPENAPI_SPEC.yaml');

router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AlphaFlow API Documentation'
}));
```

**Access**:
- Development: `http://localhost:5000/api-docs`
- Production: `https://alphaflow.app/api-docs`

---

## Quick Commands

### Validation

```bash
# Validate OpenAPI spec (when script exists)
npm run validate:openapi

# Manual YAML validation
npx @apidevtools/swagger-cli validate docs/api/OPENAPI_SPEC.yaml

# OpenSpec validation
npx openspec validate
```

### Generation (Future)

```bash
# Generate OpenAPI spec from route files
npm run generate:openapi

# Generate TypeScript types from OpenAPI spec
npm run generate:types
```

### Testing

```bash
# Test all API endpoints
npm run test:api

# Test specific domain
npm run test:api -- auth
npm run test:api -- trading
```

### Documentation

```bash
# Generate static HTML docs from OpenAPI spec
npx redoc-cli bundle docs/api/OPENAPI_SPEC.yaml -o docs/api/index.html

# Serve interactive docs locally
npx @redocly/cli preview-docs docs/api/OPENAPI_SPEC.yaml
```

---

## Best Practices

### 1. Keep Spec Synchronized

- **Update OpenAPI spec in same commit** as route implementation
- **Review diffs** to ensure no unintended API changes
- **Run validation** before committing

### 2. Document Real Behavior

- **Match actual implementation**, not ideal behavior
- **Include actual error messages** from `server/lib/standard-errors.ts`
- **Test endpoints** to verify documented behavior

### 3. Use Consistent Naming

- **operationId**: `camelCase` (e.g., `getUserProfile`, `createOrder`)
- **Schemas**: `PascalCase` (e.g., `User`, `Strategy`, `OrderRequest`)
- **Properties**: `camelCase` (e.g., `userId`, `createdAt`)
- **Endpoints**: `kebab-case` (e.g., `/api/user-profile`, `/api/market-data`)

### 4. Security Documentation

```yaml
# Always document authentication requirements
security:
  - sessionAuth: []

# Document rate limits in description
description: |
  Get portfolio snapshot.

  **Rate Limit**: 60 requests/minute
  **Authentication**: Required
```

### 5. Error Response Details

```yaml
'400':
  description: Validation error
  content:
    application/json:
      schema:
        type: object
        properties:
          error:
            type: string
            example: "Validation failed"
          details:
            type: array
            items:
              type: object
              properties:
                field:
                  type: string
                  example: "quantity"
                message:
                  type: string
                  example: "Must be a positive integer"
```

### 6. Request/Response Examples

```yaml
requestBody:
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/OrderRequest'
      examples:
        marketOrder:
          summary: Market order example
          value:
            symbol: AAPL
            qty: 100
            side: buy
            type: market
        limitOrder:
          summary: Limit order example
          value:
            symbol: TSLA
            qty: 50
            side: sell
            type: limit
            limit_price: 250.00
```

---

## Common Patterns

### Pagination

```yaml
parameters:
  - name: page
    in: query
    schema:
      type: integer
      minimum: 1
      default: 1
  - name: limit
    in: query
    schema:
      type: integer
      minimum: 1
      maximum: 100
      default: 20

responses:
  '200':
    content:
      application/json:
        schema:
          type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/Item'
            pagination:
              type: object
              properties:
                page: { type: integer }
                limit: { type: integer }
                total: { type: integer }
                totalPages: { type: integer }
```

### Search/Filter

```yaml
parameters:
  - name: q
    in: query
    description: Search query
    schema:
      type: string
  - name: status
    in: query
    description: Filter by status
    schema:
      type: string
      enum: [active, inactive, pending]
  - name: sortBy
    in: query
    schema:
      type: string
      enum: [createdAt, updatedAt, name]
      default: createdAt
  - name: order
    in: query
    schema:
      type: string
      enum: [asc, desc]
      default: desc
```

### Server-Sent Events (SSE)

```yaml
/api/stream/portfolio:
  get:
    tags: [Real-time]
    summary: Stream portfolio updates
    description: |
      Server-Sent Events (SSE) endpoint for real-time portfolio updates.

      **Event Types**:
      - `portfolio:update` - Portfolio value changes
      - `position:update` - Individual position updates
      - `heartbeat` - Connection keepalive (every 30s)
    responses:
      '200':
        description: SSE stream established
        content:
          text/event-stream:
            schema:
              type: string
            examples:
              portfolioUpdate:
                value: |
                  event: portfolio:update
                  data: {"totalValue": 125000, "cashBalance": 25000, "timestamp": "2026-01-02T10:30:00Z"}

              positionUpdate:
                value: |
                  event: position:update
                  data: {"symbol": "AAPL", "qty": 100, "currentPrice": 175.50, "unrealizedPL": 250.00}
    security:
      - sessionAuth: []
```

---

## Reference

### Current Endpoint Count

**Total Documented**: 350+ endpoints across 8 capabilities

| Domain | Endpoints | Status |
|--------|-----------|--------|
| Authentication | 7 | ✅ Documented |
| Trading & Orders | 20 | 🔄 In Progress |
| Strategy Management | 40+ | 🔄 In Progress |
| Portfolio Management | 16 | 🔄 In Progress |
| Market Data | 25 | 🔄 In Progress |
| AI Analysis | 28 | 🔄 In Progress |
| Admin & System | 100+ | 🔄 In Progress |
| Real-time Streaming | 9 | 🔄 In Progress |

### Related Documentation

- **OpenSpec Specifications**: `openspec/specs/*.md` (8 capability specs)
- **OpenSpec Workflow**: `openspec/AGENTS.md` (457 lines)
- **API Implementation**: `server/routes/**/*.ts` (56 files)
- **Validation Schemas**: `shared/schema/*.ts`
- **Error Handling**: `server/lib/standard-errors.ts`

### External Resources

- [OpenAPI 3.0.3 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [ReDoc Documentation](https://redocly.com/docs/redoc/)
- [OpenSpec Documentation](https://openspec.build/docs)

---

## Checklist for New Endpoints

- [ ] Route handler implemented in `server/routes/**/*.ts`
- [ ] Zod validation schema defined in `shared/schema/`
- [ ] Error handling follows `server/lib/standard-errors.ts` patterns
- [ ] OpenAPI spec updated in `docs/api/OPENAPI_SPEC.yaml`
- [ ] Request/response examples provided
- [ ] Security requirements documented (`sessionAuth`, rate limits)
- [ ] All response codes documented (200, 400, 401, 500, etc.)
- [ ] Schema references use `$ref` for reusability
- [ ] OpenSpec capability spec updated if new domain feature
- [ ] Tests added for new endpoint
- [ ] CHANGELOG.md updated if user-facing change

---

**Last Updated**: 2026-01-02
**Applies To**: OpenAPI 3.0.3, OpenSpec v0.17.2
**Version**: 1.0.0
