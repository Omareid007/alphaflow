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
