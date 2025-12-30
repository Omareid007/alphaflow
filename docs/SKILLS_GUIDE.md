# Skills Guide

This guide explains how to use the custom skills available in this project.

## What Are Skills?

Skills are specialized knowledge modules that provide Claude Code with domain-specific expertise. They're stored in `~/.claude/skills/` and automatically loaded when relevant topics are discussed.

## Available Skills (14 Total)

### Trading & Finance Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `trading-platform` | Broker integration, trade execution | Implementing trading features |
| `risk-management` | Position sizing, pre-trade validation | Risk controls, limits |
| `market-analysis` | 16 technical indicators, regime detection | Backtesting, signals |
| `backtest-framework` | Shared modules, genetic algorithms | Optimizer scripts |

### Development Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `typescript-patterns` | Type safety, async patterns | Code quality |
| `testing-patterns` | Unit/integration/E2E testing | Writing tests |
| `refactoring-strategies` | Extract Method, DI patterns | Code improvements |
| `api-documentation` | OpenAPI 3.0 generation | API docs |
| `database-migrations` | Drizzle ORM migrations | Schema changes |
| `security-scanning` | SAST, OWASP compliance | Security audits |

### Infrastructure Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `ai-llm-patterns` | LLM Gateway, 9-provider fallbacks | AI integration |
| `npm-dependencies` | Dependency auditing, security | Package management |
| `project-structure` | Codebase navigation, imports | Onboarding |
| `email-notifications` | SendGrid integration, trade alerts | Email features |

## How Skills Are Invoked

Skills are automatically invoked when:
1. You mention a relevant topic in conversation
2. You explicitly reference a skill name
3. Claude Code determines skill knowledge is needed

### Example Invocations

```
"Help me implement a new trading strategy"
→ Invokes: trading-platform, risk-management, market-analysis

"I need to add a database migration"
→ Invokes: database-migrations

"Run a security scan on the codebase"
→ Invokes: security-scanning

"Help me understand the LLM Gateway"
→ Invokes: ai-llm-patterns
```

## Skill File Structure

Each skill follows this structure:

```markdown
# [Skill Name]

## Overview
Brief description of what this skill covers.

## Key Concepts
- Concept 1
- Concept 2

## Patterns & Best Practices
Detailed patterns with code examples.

## Integration Points
How this skill integrates with other parts of the system.

## Common Pitfalls
Things to avoid.

## References
Links to documentation, files.
```

## Creating Custom Skills

To create a new skill:

1. Create file in `~/.claude/skills/your-skill-name.md`
2. Follow the structure above
3. Include code examples relevant to this codebase
4. Reference specific files/functions

### Example: Creating a "websocket-patterns" Skill

```markdown
# WebSocket Patterns

## Overview
Real-time communication patterns for trading data streams.

## Key Patterns

### 1. Connection Management
```typescript
// server/trading/alpaca-stream.ts
class AlpacaStream {
  private ws: WebSocket;
  private reconnectAttempts = 0;

  connect() {
    this.ws = new WebSocket(ALPACA_WS_URL);
    this.ws.on('close', this.handleReconnect);
  }
}
```

## Integration
- Works with: `server/connectors/alpaca.ts`
- Used by: Autonomous trading, real-time updates
```

## Skill Locations

| Location | Purpose |
|----------|---------|
| `~/.claude/skills/` | User-level skills (all projects) |
| Project root | Project-specific skills (future) |

## Best Practices

1. **Keep skills focused** - One domain per skill
2. **Include real code examples** - Reference actual project files
3. **Update when code changes** - Keep examples current
4. **Cross-reference** - Link related skills together

## Troubleshooting

### Skill Not Being Invoked
- Check file exists in `~/.claude/skills/`
- Verify file has `.md` extension
- Ensure content is relevant to the topic

### Skill Content Outdated
- Update code examples to match current codebase
- Verify file paths still exist
- Update version numbers if applicable

## Related Documentation

- [Agents Guide](./AGENTS_GUIDE.md) - Task-specific agents
- [Commands Reference](./COMMANDS_REFERENCE.md) - Available commands
- [CLAUDE.md](../CLAUDE.md) - Project configuration
