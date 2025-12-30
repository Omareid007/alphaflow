# Commands Reference

Complete reference for all custom commands available in this project.

## Quick Reference

| Command | Purpose | Category |
|---------|---------|----------|
| `/analyze-project` | Full project analysis | analysis |
| `/health-check` | Quick project health check | status |
| `/find-issues` | Find all issues in code | analysis |
| `/generate-spec` | Generate documentation/specs | documentation |
| `/generate-tests` | Auto-generate tests from code | testing |
| `/analyze-gap` | Deep-dive gap analysis | analysis |
| `/list-todos` | Extract TODO/FIXME/HACK comments | analysis |
| `/validate-types` | TypeScript strict validation | quality |
| `/check-mcp-status` | Verify MCP server configurations | status |
| `/refactor-analyze` | Find refactoring opportunities | quality |
| `/generate-api-docs` | Generate OpenAPI from Express routes | documentation |
| `/analyze-coverage` | Test coverage gap analysis | testing |
| `/generate-migration` | Database migration generation | database |
| `/security-scan` | Comprehensive security analysis | security |

---

## Analysis Commands

### /analyze-project

Full project analysis including structure, dependencies, and quality metrics.

**Usage**:
```
/analyze-project
/analyze-project server/
```

**Output**: Comprehensive project report

---

### /health-check

Quick assessment of project health.

**Usage**:
```
/health-check
```

**Checks**:
- TypeScript compilation
- Lint status
- Test results
- Security audit
- Dependency status

**Output**: Health status table with pass/fail indicators

---

### /find-issues

Find all issues in code including TODOs, type issues, and potential bugs.

**Usage**:
```
/find-issues
/find-issues server/trading/
```

**Output**: Categorized list of issues with locations

---

### /analyze-gap

Deep-dive gap analysis for specific areas.

**Usage**:
```
/analyze-gap type-safety
/analyze-gap testing
/analyze-gap accessibility
/analyze-gap security
/analyze-gap all
```

**Parameters**:
- `type-safety` - Find `:any` annotations, type assertions
- `testing` - Test coverage gaps
- `accessibility` - WCAG 2.1 compliance
- `security` - Security vulnerabilities
- `all` - Run all analyses

**Output**: Detailed gap report with recommendations

---

### /list-todos

Extract and categorize TODO comments.

**Usage**:
```
/list-todos
/list-todos critical
/list-todos server/
```

**Filters**:
- `critical` - FIXME items only
- `high` - Functionality TODOs
- `medium` - Improvement TODOs
- `low` - Nice-to-have items

**Output**: Categorized TODO list with context

---

## Quality Commands

### /validate-types

TypeScript strict validation with detailed reporting.

**Usage**:
```
/validate-types
/validate-types server/ai/
/validate-types server/storage.ts
```

**Checks**:
- `: any` annotations
- `as any` assertions
- `@ts-ignore` comments
- Compiler errors

**Output**: Type safety report with locations and suggestions

---

### /refactor-analyze

Analyze codebase for refactoring opportunities.

**Usage**:
```
/refactor-analyze
/refactor-analyze server/trading/
/refactor-analyze --type=god-objects
/refactor-analyze --type=duplicates
/refactor-analyze --type=types
```

**Detects**:
- God objects (files >500 lines)
- Duplicate code patterns
- High coupling
- Type safety issues

**Output**: Prioritized refactoring recommendations

---

## Documentation Commands

### /generate-spec

Generate documentation or specifications.

**Usage**:
```
/generate-spec
/generate-spec feature-name
```

**Output**: Feature specification document

---

### /generate-api-docs

Generate OpenAPI 3.0 specification from Express routes.

**Usage**:
```
/generate-api-docs
/generate-api-docs server/routes/auth.ts
/generate-api-docs --format=json
/generate-api-docs --output=api.yaml
```

**Parameters**:
- `path` - Specific route file (default: all routes)
- `--format` - yaml or json (default: yaml)
- `--output` - Output file path

**Output**: OpenAPI specification with schemas

---

## Testing Commands

### /generate-tests

Auto-generate tests from source code.

**Usage**:
```
/generate-tests
/generate-tests server/lib/email-service.ts
```

**Output**: Test file with suggested test cases

---

### /analyze-coverage

Analyze test coverage and identify gaps.

**Usage**:
```
/analyze-coverage
/analyze-coverage server/trading/
/analyze-coverage --target=60
/analyze-coverage --critical-only
```

**Parameters**:
- `path` - Directory to analyze
- `--target` - Target coverage % (default: 60)
- `--critical-only` - Show only critical gaps

**Output**: Coverage report with test recommendations

---

## Database Commands

### /generate-migration

Generate database migration by comparing schema with database.

**Usage**:
```
/generate-migration add_alerts_table
/generate-migration schema_sync --dry-run
/generate-migration --rollback
```

**Parameters**:
- `name` - Migration name
- `--dry-run` - Preview without generating
- `--rollback` - Generate rollback only

**Output**: Migration SQL with rollback script

---

## Security Commands

### /security-scan

Comprehensive security analysis.

**Usage**:
```
/security-scan
/security-scan --type=dependencies
/security-scan --type=secrets
/security-scan --type=code
/security-scan --severity=high
```

**Parameters**:
- `--type` - dependencies, secrets, code, all
- `--severity` - critical, high, medium, low

**Checks**:
- npm audit (CVEs)
- Hardcoded secrets
- SQL injection patterns
- XSS vulnerabilities
- OWASP Top 10

**Output**: Security report with remediation plan

---

## Status Commands

### /check-mcp-status

Verify MCP server configurations.

**Usage**:
```
/check-mcp-status
```

**Checks**:
- Server configurations
- API key presence
- Connection status

**Output**: MCP server status table

---

## Command Locations

Commands are stored in `~/.claude/commands/`:

```
~/.claude/commands/
├── analyze-coverage.md
├── generate-api-docs.md
├── generate-migration.md
├── refactor-analyze.md
└── security-scan.md
```

## Creating Custom Commands

To create a new command:

1. Create file: `~/.claude/commands/your-command.md`
2. Follow the template structure:

```markdown
# /your-command Command

Description of what the command does.

## Usage
```
/your-command [args] [--options]
```

## Parameters
- `arg1` - Description
- `--option1` - Description

## Workflow

### Step 1: First Step
```bash
# Commands to run
```

### Step 2: Second Step
...

## Output Format

```markdown
# Expected Output Structure
```

## Examples

```
/your-command basic-usage
```
```

## Best Practices

1. **Use specific paths** when targeting particular directories
2. **Start with health-check** for quick status
3. **Use --dry-run** for migrations before executing
4. **Filter by severity** for large codebases
5. **Run security-scan** before deployments

## Related Documentation

- [Skills Guide](./SKILLS_GUIDE.md) - Domain knowledge
- [Agents Guide](./AGENTS_GUIDE.md) - Task-specific agents
- [CLAUDE.md](../CLAUDE.md) - Project configuration
