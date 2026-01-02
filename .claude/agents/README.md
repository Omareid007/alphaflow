# Claude Code Agents

This directory contains specialized agents for Claude Code to assist with specific workflows.

## Available Agents

### OpenSpec Architect (`openspec-architect.md`)

**Purpose**: Assists with OpenSpec change proposals and spec-driven development workflows.

**Key Features**:
- Pre-work context gathering (checks existing specs and changes)
- Proposal creation workflow (scaffold, validate, review)
- Implementation guidance with approval gates
- Archiving workflow after deployment
- Integration with 8 existing trading platform capabilities
- Error recovery and troubleshooting

**When to Invoke**:
- Planning new features
- Making architectural changes
- Modifying APIs or schemas
- Creating/reviewing OpenSpec proposals
- Archiving completed changes

**Trigger Phrases**:
- "Help me create an OpenSpec proposal"
- "I want to plan a change using OpenSpec"
- "Create a spec for [feature]"
- "Review this OpenSpec change"
- "Validate my OpenSpec proposal"
- "Archive this OpenSpec change"

**Agent Statistics**:
- Lines: 1,060
- Size: 30KB
- Workflows: 5 common patterns
- Templates: 7 (proposal, tasks, design, deltas)
- Integration: 8 capabilities, full tech stack

**Quick Start**:
```bash
# View active changes
openspec list

# Create new proposal
# Agent will guide through: context → scaffold → deltas → validate

# Validate proposal
openspec validate <change-id> --strict

# Archive after deployment
openspec archive <change-id> --yes
```

## Usage Guidelines

1. **Invoke by Context**: Agents are triggered by specific phrases or workflow contexts
2. **Follow Agent Instructions**: Each agent provides step-by-step guidance
3. **Use Provided Tools**: Agents specify which tools (openspec, Grep, Glob, etc.) to use
4. **Validate Work**: Agents include validation steps before completion

## Adding New Agents

When creating new agents, follow this structure:

```markdown
# [Agent Name]

**Purpose**: [Single sentence description]

**When to Use**: [Situations that trigger this agent]

**Trigger Phrases**: [List of example phrases]

## Core Capabilities

[Detailed workflow steps]

## Available Tools

[List of tools this agent uses]

## Best Practices

[Guidelines for using this agent effectively]

## Examples

[Real-world usage examples]
```

## Integration with CLAUDE.md

These agents extend the path-scoped rules in `.claude/rules/` by providing workflow-specific guidance for complex multi-step processes like OpenSpec proposal management.

**Path-scoped rules** (`.claude/rules/*.md`): Apply automatically when editing matching files
**Agents** (`.claude/agents/*.md`): Invoked explicitly for specific workflows

## Current Capabilities Integration

The OpenSpec Architect agent is aware of all 8 trading platform capabilities:

1. **admin-system** (19 requirements)
2. **ai-analysis** (12 requirements)
3. **authentication** (9 requirements)
4. **market-data** (10 requirements)
5. **portfolio-management** (12 requirements)
6. **real-time-streaming** (11 requirements)
7. **strategy-management** (12 requirements)
8. **trading-orders** (16 requirements)

Total: 101 requirements across 8 capabilities

## References

- OpenSpec Instructions: `/home/runner/workspace/openspec/AGENTS.md`
- Project Context: `/home/runner/workspace/openspec/project.md`
- Specifications: `/home/runner/workspace/openspec/specs/`
- Active Changes: `/home/runner/workspace/openspec/changes/`

### Trading Strategy Developer (`strategy-developer.md`)

**Purpose**: Assists with trading strategy development, backtesting, and deployment lifecycle.

**Key Features**:
- Strategy creation with technical indicators (RSI, MACD, Bollinger Bands, SMA, EMA, ATR, ADX, Stochastic)
- Entry/exit rule design and configuration
- Position sizing (percent, fixed, risk-based)
- Comprehensive backtesting workflow with performance metrics
- Strategy optimization and parameter tuning
- Deployment lifecycle (draft → backtest → paper → live)
- Performance debugging and troubleshooting
- Integration with trading-utilities MCP (8 tools)
- Strategy versioning and iteration

**When to Invoke**:
- Creating new trading strategies
- Configuring technical indicators and rules
- Running backtests and analyzing results
- Deploying strategies to paper/live trading
- Debugging strategy performance issues
- Optimizing strategy parameters
- Managing strategy lifecycle

**Trigger Phrases**:
- "Help me create a trading strategy"
- "I want to build a momentum/mean-reversion/MA crossover strategy"
- "Backtest my strategy"
- "Configure strategy parameters"
- "Deploy strategy to paper trading"
- "Why is my strategy underperforming?"
- "Optimize strategy indicators"
- "Review backtest results"

**Agent Statistics**:
- Lines: 636
- Size: 18KB
- Workflows: 8 major workflows
- Examples: 3 complete strategy examples
- Indicators: 18+ technical indicators documented
- Integration: Trading-utilities MCP (8 tools), Alpaca broker, OpenSpec

**Quick Start**:
```bash
# Create strategy
curl -X POST http://localhost:5000/api/strategies \
  -d '{"name": "RSI Mean Reversion", "type": "mean_reversion", "config": {...}}'

# Run backtest
curl -X POST http://localhost:5000/api/backtests/run \
  -d '{"strategyId": "...", "universe": ["AAPL"], "startDate": "2023-01-01", ...}'

# Deploy to paper
curl -X POST http://localhost:5000/api/strategies/{id}/deploy \
  -d '{"mode": "paper"}'

# Monitor performance
curl -X GET http://localhost:5000/api/strategies/{id}/performance
```

**Technical Indicators Knowledge**:
- **Momentum**: RSI, Stochastic, Williams %R, ROC, CCI
- **Trend**: SMA, EMA, WMA, MACD, ADX
- **Volatility**: ATR, Bollinger Bands, Keltner Channels
- **Volume**: OBV, MFI, VWAP

**Performance Metrics**:
- Sharpe Ratio: >1.5 (good), >2.0 (excellent)
- Sortino Ratio: >1.5 (good), >3.0 (excellent)
- Max Drawdown: <-10% (good), <-15% (acceptable)
- Win Rate: >55% (good), >65% (excellent)
- Profit Factor: >1.5 (good), >2.5 (excellent)

**Risk Management**:
- Max position: 5% of portfolio
- Max sector exposure: 25% of portfolio
- Max daily loss: 5%
- Warning threshold: 80% of limits

### API Testing Specialist (`api-testing-specialist.md`)

**Purpose**: Comprehensive API endpoint testing specialist that analyzes OpenSpec specifications, generates integration tests, validates API responses, tests authentication flows, error handling, rate limiting, and SSE streaming endpoints.

**Key Features**:
- OpenSpec-driven test generation (1:1 scenario mapping)
- Complete response code coverage (400, 401, 403, 404, 422, 429, 500)
- Authentication flow testing (session cookies, admin tokens)
- SSE streaming endpoint validation
- Rate limiting verification
- Test fixture factories and Mock Service Worker setup
- E2E user journey testing
- Coverage analysis and reporting
- Integration with 8 capabilities and 245+ endpoints

**When to Invoke**:
- Implementing new API endpoints
- Creating OpenSpec change proposals with API changes
- Validating API behavior and responses
- Debugging API issues
- Ensuring comprehensive test coverage
- Testing authentication/authorization flows
- Validating SSE real-time updates
- Creating regression test suites

**Trigger Phrases**:
- "Create API tests for [endpoint/feature]"
- "Generate tests from OpenSpec"
- "Test API authentication flows"
- "Validate API error handling"
- "Test rate limiting behavior"
- "Create SSE streaming tests"
- "Generate integration tests"

**Agent Statistics**:
- Lines: 1,464
- Size: 41KB
- Workflows: 4 major workflows
- Examples: 15+ comprehensive test patterns
- Coverage: 8 capabilities, 245+ endpoints
- Integration: Vitest, Playwright, MSW, OpenSpec

**Quick Start**:
```bash
# Generate tests from OpenSpec requirement
cat openspec/specs/authentication/spec.md
# Map scenarios → test cases

# Create test file
touch tests/server/routes/password-reset.test.ts

# Run tests with coverage
npx vitest run --coverage tests/server/routes/password-reset.test.ts

# View coverage report
npx vitest run --coverage --reporter=html
open coverage/index.html
```

**Test Patterns Covered**:
- **Authentication**: Session management, cookie security, protected routes
- **Error Handling**: All HTTP status codes, validation errors, business logic errors
- **SSE Streaming**: Portfolio, orders, prices, strategy execution
- **Rate Limiting**: Auth endpoints (5/15min), trading (10/min), data (60/min)
- **Integration**: E2E user flows, external API mocking
- **Security**: XSS prevention, auth bypass attempts, authorization checks

**Coverage Targets**:
- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

**Testing Tools**:
- **Vitest**: Unit and integration tests with mocking
- **Playwright**: Browser automation for E2E tests
- **MSW**: External API mocking (Alpaca, SendGrid, LLM providers)
- **Test Helpers**: Session creation, authenticated requests, test data factories

**OpenSpec Integration**:
Maps OpenSpec scenarios directly to test cases:
```typescript
// OpenSpec Scenario: Valid credentials
// → it("should authenticate with valid credentials")

// OpenSpec Scenario: Invalid credentials
// → it("should reject invalid credentials")
```

**Example Test Structure**:
```typescript
describe("Requirement: Market Order Submission", () => {
  describe("POST /api/orders", () => {
    it("should submit market order successfully (OpenSpec Scenario: Success)", async () => {
      // Arrange: Setup mocks based on OpenSpec preconditions
      // Act: Execute API call
      // Assert: Validate THEN/AND clauses from OpenSpec
    });
  });
});
```

**Common Use Cases**:
1. New endpoint implementation → Generate test suite from OpenSpec
2. Bug fix → Add regression test for scenario
3. Security audit → Validate auth/authz for all endpoints
4. Performance review → Test rate limiting enforcement
5. Feature deployment → Ensure E2E flow coverage

## Agent Comparison

| Agent | Focus | Lines | When to Use |
|-------|-------|-------|-------------|
| OpenSpec Architect | Specification & Design | 1,060 | Planning features, architectural changes |
| Strategy Developer | Trading Strategies | 636 | Creating/optimizing trading strategies |
| API Testing Specialist | Test Generation | 1,464 | Testing endpoints, validating API behavior |

## Workflow Integration

**Typical Development Flow**:
1. **OpenSpec Architect**: Create change proposal with requirements
2. **API Testing Specialist**: Generate test suite from OpenSpec scenarios
3. **Implementation**: Build feature with tests passing
4. **Strategy Developer**: If trading feature, configure and backtest
5. **OpenSpec Architect**: Archive change after deployment

**Test-Driven Development (TDD)**:
1. Read OpenSpec requirement → API Testing Specialist
2. Generate failing tests → API Testing Specialist
3. Implement endpoint to pass tests
4. Validate coverage → API Testing Specialist
5. Deploy feature → OpenSpec Architect (archive)

## Agent Best Practices

1. **Always read context first**: Each agent has pre-work steps
2. **Follow validation steps**: Agents include quality checks
3. **Use provided templates**: Consistent structure across workflows
4. **Reference OpenSpec**: All agents integrate with capabilities
5. **Validate before completion**: Run checks before finalizing

## Future Agents (Planned)

- **UI Component Specialist**: React component testing with accessibility
- **Performance Optimizer**: Analyze and optimize API/database performance
- **Security Auditor**: Comprehensive security testing and compliance
- **Database Migration Manager**: Schema changes and data migrations
- **Documentation Generator**: Auto-generate docs from code and OpenSpec
