# Agents Guide

This guide explains how to use the custom agents and Task tool subagents available in this project.

## Types of Agents

### 1. Task Tool Subagents (Built-in)

These are spawned via the `Task` tool and run autonomously:

| Subagent Type | Purpose | When to Use |
|---------------|---------|-------------|
| `general-purpose` | Multi-step tasks, code search | Complex research |
| `Explore` | Codebase exploration, file patterns | Finding files/code |
| `Plan` | Implementation planning | Architecture decisions |
| `claude-code-guide` | Claude Code/SDK documentation | How-to questions |

### 2. Custom Agents (Project-specific)

Located in `~/.claude/agents/`, these provide specialized analysis:

| Agent | Purpose | Category |
|-------|---------|----------|
| `code-refactoring-planner` | Analyze refactoring opportunities | analysis |
| `api-documentation-generator` | Discover routes, generate OpenAPI | documentation |
| `test-coverage-analyzer` | Parse coverage, identify gaps | testing |
| `migration-analyzer` | Schema diff, safe migrations | database |
| `vulnerability-tracker` | CVE tracking, npm audit | security |

## Using Task Tool Subagents

### Explore Agent (Quick Codebase Search)

```
"Find all files that handle authentication"
→ Uses Explore agent to search codebase

"What components use the useStrategies hook?"
→ Uses Explore agent with grep patterns
```

Best for:
- Finding files by pattern
- Searching code for keywords
- Quick codebase questions

### General-Purpose Agent (Complex Tasks)

```
"Research how the order execution flow works end-to-end"
→ Spawns general-purpose agent for deep analysis

"Find and fix all TypeScript errors in server/trading/"
→ Multi-step task requiring multiple tool calls
```

Best for:
- Multi-file analysis
- Complex research tasks
- Tasks requiring multiple rounds of exploration

### Plan Agent (Architecture Decisions)

```
"Plan how to implement futures trading support"
→ Spawns Plan agent to create implementation plan

"Design a new caching layer for market data"
→ Creates architectural proposal
```

Best for:
- Feature planning
- Architectural decisions
- Implementation strategies

## Using Custom Agents

Custom agents are defined in `~/.claude/agents/` and invoked through conversation context.

### Code Refactoring Planner

**Purpose**: Identify god objects, duplicates, type issues

**Invocation**:
```
"Analyze the trading module for refactoring opportunities"
"Find god objects in the codebase"
"What code should be split into smaller files?"
```

**Output Format**:
- List of files needing refactoring
- Specific recommendations
- Priority ranking

### API Documentation Generator

**Purpose**: Generate OpenAPI specs from Express routes

**Invocation**:
```
"Generate API documentation for all routes"
"Document the /api/trades endpoints"
"Create OpenAPI spec for the authentication routes"
```

**Output Format**:
- OpenAPI 3.0 YAML/JSON
- Endpoint summaries
- Request/response schemas

### Test Coverage Analyzer

**Purpose**: Identify testing gaps

**Invocation**:
```
"Analyze test coverage for the trading module"
"What files have no tests?"
"Recommend which functions to test first"
```

**Output Format**:
- Coverage percentage by file
- Uncovered functions list
- Test priority recommendations

### Migration Analyzer

**Purpose**: Database schema changes

**Invocation**:
```
"Compare schema.ts with the current database"
"What migrations are needed?"
"Generate a safe migration plan"
```

**Output Format**:
- Schema diff report
- Migration SQL
- Rollback instructions

### Vulnerability Tracker

**Purpose**: Security issue management

**Invocation**:
```
"Run a security audit"
"Check for npm vulnerabilities"
"Track CVEs affecting this project"
```

**Output Format**:
- Vulnerability summary
- CVE details
- Remediation steps

## Agent File Structure

Custom agents follow this structure:

```markdown
# [Agent Name]

## Role
What this agent does and its expertise.

## Capabilities
- Capability 1
- Capability 2

## Tools Used
- Tool 1: Purpose
- Tool 2: Purpose

## Output Format
Expected output structure.

## Example Invocations
How to invoke this agent.
```

## Creating Custom Agents

To create a new agent:

1. Create file: `~/.claude/agents/your-agent.md`
2. Define role and capabilities
3. List tools the agent uses
4. Provide output format template
5. Add example invocations

### Example: Performance Profiler Agent

```markdown
# Performance Profiler

## Role
Analyze application performance, identify bottlenecks, suggest optimizations.

## Capabilities
- Database query analysis
- API response time profiling
- Memory usage assessment
- Bundle size analysis

## Tools Used
- Bash: Run profiling commands
- Grep: Search for patterns
- Read: Analyze source files

## Output Format
| Metric | Current | Target | Priority |
|--------|---------|--------|----------|

## Example Invocations
"Profile the trading execution flow"
"Find slow database queries"
"Analyze bundle size"
```

## Parallel Agent Execution

Multiple agents can run in parallel for efficiency:

```
"In parallel:
1. Analyze test coverage
2. Run security scan
3. Check type safety"
→ Spawns 3 agents simultaneously
```

## Best Practices

1. **Be specific** - Clear tasks get better results
2. **Use appropriate agent** - Match task to agent capability
3. **Review output** - Agents can make mistakes
4. **Iterate** - Follow up with clarifying questions

## Troubleshooting

### Agent Not Finding Expected Results
- Narrow the search scope
- Provide more specific patterns
- Check file paths exist

### Agent Taking Too Long
- Break into smaller tasks
- Use Explore instead of general-purpose for simple searches
- Specify file limits

## Related Documentation

- [Skills Guide](./SKILLS_GUIDE.md) - Domain knowledge
- [Commands Reference](./COMMANDS_REFERENCE.md) - Available commands
- [CLAUDE.md](../CLAUDE.md) - Project configuration
