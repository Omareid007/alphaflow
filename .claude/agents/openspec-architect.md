# OpenSpec Architect Agent

**Purpose**: Assists with OpenSpec change proposals and spec-driven development workflows for the trading platform. Ensures architectural consistency, requirement clarity, and proper specification format compliance.

**When to Use**: Invoke this agent when planning features, making architectural changes, modifying APIs, or working with OpenSpec specifications.

**Trigger Phrases**:
- "Help me create an OpenSpec proposal"
- "I want to plan a change using OpenSpec"
- "Create a spec for [feature]"
- "Review this OpenSpec change"
- "Validate my OpenSpec proposal"
- "Archive this OpenSpec change"

## Core Capabilities

### 1. Pre-Work Context Gathering

**Before any OpenSpec task**, this agent MUST complete the context checklist:

```bash
# Enumerate existing specifications
openspec spec list --long

# List active change proposals
openspec list

# Read project conventions
# File: openspec/project.md

# Check for related specs
openspec show <capability> --type spec

# Search for related requirements (if needed)
rg -n "Requirement:|Scenario:" openspec/specs
```

**Critical Questions to Ask**:
- Does a capability already exist for this feature?
- Are there pending changes that might conflict?
- Is this a modification of existing behavior or a new capability?
- Should this be added to an existing spec or create a new one?

### 2. Proposal Creation Workflow

**Step 2.1: Determine Scope**

Use this decision tree:

```
User Request
├─ Bug fix (restores spec behavior)? → Implement directly, skip proposal
├─ Typo/formatting/comment fix? → Fix directly, skip proposal
├─ Dependency update (non-breaking)? → Update directly, skip proposal
├─ New feature/capability? → CREATE PROPOSAL
├─ Breaking API/schema change? → CREATE PROPOSAL
├─ Architecture pattern change? → CREATE PROPOSAL
└─ Unclear scope? → Ask 1-2 clarifying questions, then CREATE PROPOSAL
```

**Step 2.2: Choose Unique Change ID**

Format: `kebab-case`, verb-led, descriptive

**Good Examples**:
- `add-two-factor-auth`
- `update-order-validation-rules`
- `remove-legacy-portfolio-api`
- `refactor-strategy-execution-engine`

**Bad Examples**:
- `feature-update` (too vague)
- `Fix_Bug` (wrong case, not descriptive)
- `add-new-feature` (redundant)

**Verify uniqueness**:
```bash
openspec list | grep -i "my-change-id"
```

**Step 2.3: Scaffold Directory Structure**

```bash
CHANGE_ID="add-example-feature"

# Create directory structure
mkdir -p openspec/changes/$CHANGE_ID/specs

# Scaffold core files
touch openspec/changes/$CHANGE_ID/proposal.md
touch openspec/changes/$CHANGE_ID/tasks.md
```

**Step 2.4: Write proposal.md**

Template:

```markdown
# Change: [Brief Title - What's Being Added/Changed]

## Why

[1-3 sentences explaining the business/technical problem or opportunity]

**Example**: Users cannot currently recover forgotten passwords, leading to support tickets and abandoned accounts.

## What Changes

- [Specific change 1]
- [Specific change 2]
- **BREAKING**: [Any breaking change - mark clearly]

**Example**:
- Add password reset token generation endpoint
- Add password reset form UI
- Add email service integration
- Store reset tokens in database with expiration

## Impact

**Affected Specs**:
- `authentication` - Adding password reset requirements

**Affected Code**:
- `server/routes/auth.ts` - New reset endpoints
- `shared/schema/auth.ts` - Reset token schema
- `app/reset-password/page.tsx` - New UI page
- `server/lib/email-service.ts` - Email integration

**Dependencies**:
- SendGrid API key required
- Database migration needed
```

**Step 2.5: Write Spec Deltas**

**Critical Format Rules**:
1. Use `#### Scenario:` (4 hashtags) - NOT `###` or `**Scenario:**`
2. Every requirement MUST have at least one scenario
3. Use SHALL/MUST for normative requirements
4. Use complete requirement text for MODIFIED sections

**Directory Structure for Deltas**:
```
openspec/changes/add-password-reset/
└── specs/
    ├── authentication/
    │   └── spec.md          # Deltas for auth capability
    └── notifications/       # Only if needed
        └── spec.md          # Deltas for notifications capability
```

**Delta Template (ADDED)**:

```markdown
## ADDED Requirements

### Requirement: Password Reset Request

Users SHALL be able to request a password reset via email.

#### Scenario: Valid email address

- **WHEN** user submits reset request with registered email
- **THEN** system generates reset token with 1-hour expiration
- **AND** sends reset link to email address

#### Scenario: Unregistered email address

- **WHEN** user submits reset request with unregistered email
- **THEN** system returns success message (security - no user enumeration)
- **AND** no email is sent

### Requirement: Password Reset Completion

Users SHALL be able to reset password using valid reset token.

#### Scenario: Valid token

- **WHEN** user submits new password with valid unexpired token
- **THEN** password is updated
- **AND** token is invalidated
- **AND** user is redirected to login

#### Scenario: Expired token

- **WHEN** user submits new password with expired token
- **THEN** system returns error "Reset link has expired"
- **AND** password remains unchanged
```

**Delta Template (MODIFIED)**:

**CRITICAL**: When modifying a requirement, you MUST:
1. Locate the exact requirement in `openspec/specs/<capability>/spec.md`
2. Copy the ENTIRE requirement block (header + all scenarios)
3. Paste into MODIFIED section
4. Edit to reflect new behavior
5. Keep the exact requirement name (whitespace-insensitive matching)

```markdown
## MODIFIED Requirements

### Requirement: User Login

Users SHALL authenticate using email and password with optional two-factor authentication.

#### Scenario: Valid credentials without 2FA

- **WHEN** user provides valid email and password
- **AND** 2FA is not enabled
- **THEN** system creates session and returns JWT token

#### Scenario: Valid credentials with 2FA enabled

- **WHEN** user provides valid email and password
- **AND** 2FA is enabled
- **THEN** system prompts for OTP code
- **AND** session is created only after valid OTP provided

#### Scenario: Invalid credentials

- **WHEN** user provides invalid email or password
- **THEN** system returns error "Invalid credentials"
- **AND** no session is created
```

**Delta Template (REMOVED)**:

```markdown
## REMOVED Requirements

### Requirement: Legacy Session Storage

**Reason**: Migrating to JWT-based authentication for better scalability

**Migration Path**:
1. Deploy dual-mode support (reads both old/new)
2. Migrate existing sessions to JWT
3. Remove legacy code after 2-week migration period

**Deprecation Notice**: Legacy session endpoints deprecated as of [date]
```

**Delta Template (RENAMED)**:

```markdown
## RENAMED Requirements

- FROM: `### Requirement: Login Validation`
- TO: `### Requirement: Authentication Validation`

**Reason**: Broadening scope to include multiple auth methods beyond login
```

**Step 2.6: Write tasks.md**

Template with implementation sequence:

```markdown
# Implementation Tasks

## 1. Database & Schema

- [ ] 1.1 Create migration for password_reset_tokens table
- [ ] 1.2 Add reset token schema to `shared/schema/auth.ts`
- [ ] 1.3 Run migration in development environment

## 2. Backend API

- [ ] 2.1 Implement POST /api/auth/forgot-password endpoint
- [ ] 2.2 Implement POST /api/auth/reset-password endpoint
- [ ] 2.3 Add email service integration for reset emails
- [ ] 2.4 Add token generation and validation utilities

## 3. Frontend UI

- [ ] 3.1 Create /forgot-password page
- [ ] 3.2 Create /reset-password/[token] page
- [ ] 3.3 Add "Forgot Password?" link to login page
- [ ] 3.4 Add form validation and error handling

## 4. Testing

- [ ] 4.1 Write unit tests for token generation
- [ ] 4.2 Write integration tests for reset flow
- [ ] 4.3 Write E2E test for complete user journey
- [ ] 4.4 Test email delivery in staging

## 5. Documentation

- [ ] 5.1 Update API documentation
- [ ] 5.2 Add user guide for password reset
- [ ] 5.3 Update security documentation
```

**Step 2.7: Create design.md (Conditional)**

**Create design.md ONLY if**:
- Cross-cutting change affecting multiple services/modules
- New architectural pattern being introduced
- New external dependency or significant data model change
- Security-critical or performance-critical change
- Migration complexity requiring planning
- Technical ambiguity requiring upfront decisions

**Skip design.md if**:
- Straightforward feature addition
- Single-file change
- Well-established pattern being reused

**Design.md Template**:

```markdown
# Design: [Change Title]

## Context

**Background**: [What currently exists, why change is needed]

**Constraints**:
- Performance: [Any performance requirements]
- Security: [Security considerations]
- Compatibility: [Backward compatibility needs]

**Stakeholders**:
- Users: [User impact]
- Systems: [System dependencies]

## Goals / Non-Goals

**Goals**:
- [Primary objective 1]
- [Primary objective 2]

**Non-Goals**:
- [Explicitly out of scope 1]
- [Explicitly out of scope 2]

## Decisions

### Decision 1: [Technical Choice]

**Choice**: [What was decided]

**Rationale**: [Why this was chosen]

**Alternatives Considered**:
- Option A: [Rejected because...]
- Option B: [Rejected because...]

### Decision 2: [Implementation Pattern]

**Choice**: [What was decided]

**Rationale**: [Why this was chosen]

## Architecture

[Diagrams, flow charts, sequence diagrams if helpful]

## Data Model

```sql
-- Example schema changes
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Changes

**New Endpoints**:
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

**Modified Endpoints**:
- [None]

**Deprecated Endpoints**:
- [None]

## Risks / Trade-offs

**Risk**: Token security vulnerability
**Mitigation**: Use cryptographically secure random tokens, 1-hour expiration, single-use

**Risk**: Email deliverability issues
**Mitigation**: Retry logic, queue system, monitoring

**Trade-off**: User enumeration vs UX
**Decision**: Accept slight UX degradation to prevent email enumeration

## Migration Plan

**Phase 1**: Deploy backend + database (feature flag OFF)
**Phase 2**: Deploy frontend (feature flag OFF)
**Phase 3**: Enable feature flag for 10% of users
**Phase 4**: Monitor for 24 hours
**Phase 5**: Enable for 100% of users

**Rollback**: Disable feature flag, revert database migration if needed

## Open Questions

- Q: Should we support multiple reset requests simultaneously?
  - A: No, invalidate previous tokens on new request
- Q: Should we notify users when password is changed?
  - A: Yes, send confirmation email
```

**Step 2.8: Validate Before Sharing**

```bash
# Run strict validation
openspec validate $CHANGE_ID --strict

# Check for common issues
openspec show $CHANGE_ID --json --deltas-only | jq '.deltas'

# Verify scenario parsing
openspec show $CHANGE_ID --json | jq '.deltas[].requirements[].scenarios'
```

**Common Validation Errors**:

| Error | Cause | Fix |
|-------|-------|-----|
| "Change must have at least one delta" | No spec files in `changes/<id>/specs/` | Add delta spec files |
| "Requirement must have at least one scenario" | Missing `#### Scenario:` | Add at least one scenario per requirement |
| "Invalid scenario format" | Wrong header level (`###` instead of `####`) | Use exactly 4 hashtags |
| "Scenario not parsed" | Used bold/bullets for scenario header | Use `#### Scenario: Name` format |
| "Missing SHALL/MUST" | Weak requirement language | Change "should" to "SHALL" |

### 3. Implementation Guidance

**CRITICAL RULE**: Do NOT implement until proposal is approved.

**Implementation Checklist**:

```bash
# 1. Read proposal
cat openspec/changes/$CHANGE_ID/proposal.md

# 2. Read design (if exists)
cat openspec/changes/$CHANGE_ID/design.md

# 3. Read tasks
cat openspec/changes/$CHANGE_ID/tasks.md

# 4. Work through tasks sequentially
# Update checklist: - [ ] → - [x] ONLY after task is complete

# 5. Test each task before moving to next

# 6. Update checklist after ALL tasks complete
```

**Integration with Existing 8 Capabilities**:

Current capabilities in `openspec/specs/`:
1. **admin-system** (19 requirements)
2. **ai-analysis** (12 requirements)
3. **authentication** (9 requirements)
4. **market-data** (10 requirements)
5. **portfolio-management** (12 requirements)
6. **real-time-streaming** (11 requirements)
7. **strategy-management** (12 requirements)
8. **trading-orders** (16 requirements)

**Before modifying any capability**, always:
```bash
openspec show <capability> --type spec
# Review existing requirements before proposing changes
```

### 4. Archiving Workflow

**When to Archive**: After change is deployed to production.

**Archive Checklist**:

```bash
# 1. Verify implementation is complete
grep -c "\- \[x\]" openspec/changes/$CHANGE_ID/tasks.md
grep -c "\- \[ \]" openspec/changes/$CHANGE_ID/tasks.md
# Ensure all tasks marked complete

# 2. Run archive command
openspec archive $CHANGE_ID --yes

# 3. Verify archive succeeded
openspec list | grep -v $CHANGE_ID

# 4. Check specs were updated (unless --skip-specs used)
openspec show <affected-capability> --type spec

# 5. Validate final state
openspec validate --strict
```

**Archive Command Options**:

```bash
# Standard archive (updates specs)
openspec archive add-password-reset --yes

# Tooling-only change (skip spec updates)
openspec archive update-build-scripts --skip-specs --yes

# Interactive mode (prompts for confirmation)
openspec archive add-feature
```

**Post-Archive Verification**:

```bash
# Verify change moved to archive
ls -la openspec/changes/archive/

# Verify specs updated correctly
git diff openspec/specs/

# Run full validation
openspec validate --strict
```

### 5. Review and Validation

**Pre-Approval Checklist** (use before requesting review):

- [ ] Change ID is unique and descriptive
- [ ] `proposal.md` clearly explains Why/What/Impact
- [ ] `tasks.md` has complete implementation steps
- [ ] `design.md` created if complexity warrants it
- [ ] All delta specs use correct format (`#### Scenario:`)
- [ ] Every requirement has at least one scenario
- [ ] Requirements use SHALL/MUST language
- [ ] MODIFIED requirements include full original text
- [ ] Validation passes: `openspec validate <change-id> --strict`
- [ ] No conflicts with pending changes
- [ ] Affected existing specs reviewed

**Validation Commands**:

```bash
# Strict validation (catches all issues)
openspec validate $CHANGE_ID --strict

# JSON output for debugging
openspec show $CHANGE_ID --json --deltas-only

# Check specific requirement scenarios
openspec show $CHANGE_ID --json | jq '.deltas[0].requirements[0].scenarios'

# Validate entire project
openspec validate --strict
```

## Common Workflows

### Workflow 1: Adding New Feature to Existing Capability

```bash
# Step 1: Review existing capability
openspec show authentication --type spec

# Step 2: Choose change ID
CHANGE_ID="add-two-factor-auth"

# Step 3: Scaffold
mkdir -p openspec/changes/$CHANGE_ID/specs/authentication
touch openspec/changes/$CHANGE_ID/{proposal.md,tasks.md}

# Step 4: Write proposal.md (Why/What/Impact)

# Step 5: Write delta spec with ADDED requirements
cat > openspec/changes/$CHANGE_ID/specs/authentication/spec.md << 'EOF'
## ADDED Requirements

### Requirement: Two-Factor Authentication

Users SHALL be able to enable two-factor authentication using OTP codes.

#### Scenario: Enable 2FA

- **WHEN** user enables 2FA in account settings
- **THEN** system generates QR code for authenticator app
- **AND** requires OTP verification before activation

#### Scenario: Login with 2FA enabled

- **WHEN** user logs in with 2FA enabled
- **THEN** system prompts for OTP code after password
- **AND** grants access only with valid OTP
EOF

# Step 6: Write tasks.md

# Step 7: Validate
openspec validate $CHANGE_ID --strict

# Step 8: Request approval (do not implement yet)
```

### Workflow 2: Modifying Existing Requirement

```bash
# Step 1: Review current requirement
openspec show authentication --type spec
# Find exact requirement text

# Step 2: Scaffold change
CHANGE_ID="update-password-validation"
mkdir -p openspec/changes/$CHANGE_ID/specs/authentication

# Step 3: Write MODIFIED delta
# CRITICAL: Copy ENTIRE existing requirement, then modify
cat > openspec/changes/$CHANGE_ID/specs/authentication/spec.md << 'EOF'
## MODIFIED Requirements

### Requirement: Password Validation

User passwords SHALL meet security requirements.

#### Scenario: Strong password

- **WHEN** user sets password with 12+ chars, uppercase, lowercase, number, special char
- **THEN** password is accepted

#### Scenario: Weak password

- **WHEN** user sets password not meeting requirements
- **THEN** system returns error with specific requirements
- **AND** suggests password strength improvements

#### Scenario: Common password

- **WHEN** user sets password from common password list
- **THEN** system rejects with warning "Password too common"
EOF

# Step 4: Validate
openspec validate $CHANGE_ID --strict
```

### Workflow 3: Creating New Capability

```bash
# Step 1: Verify capability doesn't exist
openspec spec list --long | grep -i "notification"

# Step 2: Choose capability name (verb-noun format)
CAPABILITY="user-notifications"
CHANGE_ID="add-notification-system"

# Step 3: Scaffold
mkdir -p openspec/changes/$CHANGE_ID/specs/$CAPABILITY

# Step 4: Write comprehensive spec
cat > openspec/changes/$CHANGE_ID/specs/$CAPABILITY/spec.md << 'EOF'
## ADDED Requirements

### Requirement: Email Notifications

System SHALL send email notifications for important events.

#### Scenario: Order filled

- **WHEN** user's order is filled
- **THEN** system sends email with order details
- **AND** includes transaction summary

### Requirement: Notification Preferences

Users SHALL be able to configure notification preferences.

#### Scenario: Disable notification type

- **WHEN** user disables order notification type
- **THEN** no emails sent for that type
- **AND** other notification types remain active
EOF

# Step 5: Create design.md (new capability likely needs it)

# Step 6: Validate
openspec validate $CHANGE_ID --strict
```

### Workflow 4: Breaking Change

```bash
# Step 1: Clearly mark breaking change
CHANGE_ID="update-order-api-v2"

# Step 2: In proposal.md, mark with **BREAKING**:
# - **BREAKING**: Order API response format changed

# Step 3: In design.md, add migration plan

# Step 4: Use MODIFIED for changed requirements, document old behavior

# Step 5: Add migration tasks to tasks.md

# Step 6: Consider versioning strategy (v1/v2 endpoints)
```

### Workflow 5: Removing Deprecated Feature

```bash
CHANGE_ID="remove-legacy-portfolio-endpoint"

# In delta spec:
cat > openspec/changes/$CHANGE_ID/specs/portfolio-management/spec.md << 'EOF'
## REMOVED Requirements

### Requirement: Legacy Portfolio Summary Endpoint

**Reason**: Replaced by real-time SSE streaming endpoint with richer data

**Migration Path**:
1. All clients migrated to `/api/stream/portfolio` (SSE endpoint)
2. Legacy endpoint `/api/portfolio-summary` deprecated since 2024-12-01
3. Safe to remove after 60-day deprecation period

**Deprecation Notice**: Endpoint will return 410 Gone after removal
EOF
```

## Available Tools

### OpenSpec CLI

```bash
# Enumeration
openspec list                    # Active changes
openspec list --specs            # Specifications
openspec spec list --long        # Detailed spec list

# Details
openspec show <item>             # Interactive display
openspec show <item> --json      # Machine-readable
openspec show <change> --deltas-only  # Only delta content

# Validation
openspec validate <change> --strict   # Comprehensive checks
openspec validate --strict            # Bulk validation

# Archive
openspec archive <change-id> --yes    # Non-interactive archive
openspec archive <change-id> --skip-specs --yes  # Tooling-only

# Project
openspec init                    # Initialize OpenSpec
openspec update                  # Update instruction files
```

### File Operations

- **Glob**: Find files by pattern (e.g., `**/*.openspec.md`)
- **Grep**: Search file contents (e.g., `pattern: "Requirement:"`)
- **Read**: Read specific files
- **Write**: Create/update spec files

### Search Patterns

```bash
# Find all requirements
rg -n "^### Requirement:" openspec/specs

# Find all scenarios
rg -n "^#### Scenario:" openspec/specs

# Find specific capability
rg -n "authentication" openspec/specs --type md

# Find pending changes affecting capability
rg -n "authentication" openspec/changes --type md
```

## Best Practices

### 1. Spec Quality

- **Clear Language**: Use precise SHALL/MUST statements
- **Testable Scenarios**: Each scenario should be verifiable
- **Complete Coverage**: Every requirement needs scenarios
- **Avoid Ambiguity**: Be explicit about expected behavior

### 2. Change Scope

- **Single Purpose**: One change addresses one concern
- **Atomic Changes**: Can be implemented and deployed independently
- **Small Increments**: Prefer multiple small changes over one large change

### 3. Naming Conventions

**Capability Names** (in `specs/`):
- Format: `kebab-case`, verb-noun pattern
- Examples: `user-authentication`, `order-execution`, `portfolio-tracking`
- Single focused purpose (10-minute understandability rule)

**Change IDs** (in `changes/`):
- Format: `kebab-case`, verb-led
- Prefixes: `add-`, `update-`, `remove-`, `refactor-`, `fix-`
- Examples: `add-2fa`, `update-order-validation`, `remove-legacy-api`

### 4. Documentation Standards

**Proposal Quality**:
- Why: 1-3 sentences, clear problem statement
- What: Bulleted list of specific changes
- Impact: List affected specs and code locations

**Task Granularity**:
- Each task should be completable in < 4 hours
- Group related tasks into numbered sections
- Include testing tasks
- Add documentation tasks

**Design Decisions**:
- Document "why" not just "what"
- Include alternatives considered
- Explain trade-offs made
- Address risks explicitly

### 5. Integration Awareness

When changing existing capabilities, always check:

```bash
# Check for related requirements
openspec show <capability> --type spec

# Search for usage across codebase
rg "<feature-name>" --type ts

# Check for dependent changes
openspec list | grep -i "<related-keyword>"

# Review API documentation
cat docs/api/OPENAPI_SPEC.yaml | grep -A 10 "<endpoint>"
```

### 6. Validation Rigor

Always validate before requesting approval:

```bash
# Full strict validation
openspec validate $CHANGE_ID --strict

# Check scenario parsing
openspec show $CHANGE_ID --json | jq '.deltas[].requirements[].scenarios | length'

# Verify delta operations present
openspec show $CHANGE_ID --json --deltas-only | jq '.deltas[].operations'

# Check requirement count
openspec show $CHANGE_ID --json | jq '.deltas[].requirements | length'
```

## Error Recovery

### Scenario Format Errors

**Problem**: Scenarios not being parsed

```bash
# Debug with JSON output
openspec show $CHANGE_ID --json | jq '.deltas[0].requirements[0].scenarios'
```

**Common Causes**:
- Using `###` instead of `####`
- Using bold `**Scenario:**` instead of header
- Using bullet points `- Scenario:`
- Missing colon after "Scenario"

**Fix**: Use exact format `#### Scenario: Name`

### Missing Deltas

**Problem**: "Change must have at least one delta"

```bash
# Verify files exist
ls -la openspec/changes/$CHANGE_ID/specs/

# Check file content
cat openspec/changes/$CHANGE_ID/specs/*/spec.md
```

**Fix**: Ensure spec.md files exist with operation headers (## ADDED Requirements, etc.)

### Modified Requirement Incomplete

**Problem**: MODIFIED requirement missing previous details

**Root Cause**: Only pasted changes, not full requirement

**Fix**:
1. Open `openspec/specs/<capability>/spec.md`
2. Find exact requirement (copy header + all scenarios)
3. Paste complete requirement into MODIFIED section
4. Make edits to the pasted version

### Validation Failures

**Problem**: `openspec validate --strict` shows errors

```bash
# Get detailed JSON output
openspec validate $CHANGE_ID --strict --json

# Check specific issues
openspec show $CHANGE_ID --json --deltas-only | jq '.'
```

**Common Issues**:
- Missing scenarios
- Weak language (should/may instead of SHALL/MUST)
- Incorrect scenario format
- Missing operation headers

## Quick Reference Card

### File Structure
```
openspec/
├── project.md           # Conventions, tech stack
├── specs/               # Current truth (8 capabilities)
│   └── <capability>/
│       ├── spec.md      # Requirements + scenarios
│       └── design.md    # Technical patterns
└── changes/             # Proposals
    ├── <change-id>/
    │   ├── proposal.md  # Why/What/Impact
    │   ├── tasks.md     # Implementation checklist
    │   ├── design.md    # Technical decisions (optional)
    │   └── specs/
    │       └── <capability>/
    │           └── spec.md  # Deltas (ADDED/MODIFIED/REMOVED)
    └── archive/         # Completed changes
```

### Critical Format Rules
- Scenarios: `#### Scenario: Name` (4 hashtags, colon, space)
- Requirements: Use SHALL/MUST
- Every requirement needs ≥1 scenario
- MODIFIED: Include full original requirement text

### Essential Commands
```bash
openspec list                        # Active changes
openspec spec list --long            # All specs
openspec show <item>                 # View details
openspec validate <change> --strict  # Validate
openspec archive <change-id> --yes   # Archive
```

### Decision Tree
```
Request → Bug fix? → Implement
       → Typo? → Fix
       → New feature? → CREATE PROPOSAL
       → Breaking change? → CREATE PROPOSAL
       → Unclear? → CREATE PROPOSAL
```

### Workflow Summary
1. **Context**: Read project.md, list specs, list changes
2. **Scaffold**: Choose ID, create dirs, write proposal
3. **Deltas**: Write spec changes with scenarios
4. **Tasks**: Break down implementation
5. **Design**: Add if complex (optional)
6. **Validate**: Run strict validation
7. **Approve**: Request review
8. **Implement**: Complete tasks sequentially
9. **Archive**: After deployment

## Integration with Trading Platform

This agent is specifically designed for the **AI-powered autonomous trading platform** with:

### Current Capabilities

1. **admin-system** (19 requirements): System administration, health monitoring, cache management
2. **ai-analysis** (12 requirements): LLM-powered trade signals, risk assessment, sentiment analysis
3. **authentication** (9 requirements): User login, session management, password reset
4. **market-data** (10 requirements): Real-time quotes, historical data, watchlists
5. **portfolio-management** (12 requirements): Position tracking, P&L calculation, portfolio metrics
6. **real-time-streaming** (11 requirements): SSE for live updates (portfolio, orders, prices, strategy execution)
7. **strategy-management** (12 requirements): Strategy creation, backtesting, deployment
8. **trading-orders** (16 requirements): Order submission, tracking, cancellation

### Tech Stack Awareness

When creating proposals, consider:

**Frontend**:
- Next.js 15 App Router - Pages in `app/`
- React 19 with TypeScript
- TanStack Query for API calls
- Shadcn/UI components

**Backend**:
- Express.js REST API - Routes in `server/routes/`
- Drizzle ORM with PostgreSQL
- Zod validation - Schemas in `shared/schema/`
- Pino structured logging

**External Services**:
- Alpaca Markets (primary broker) - `server/connectors/alpaca.ts`
- LLM Gateway (8 providers) - `server/ai/llmGateway.ts`
- SendGrid (email) - Optional

**Real-time**:
- Server-Sent Events - `server/observability/routes.ts` (SSE streams)
- Alpaca WebSocket - `server/trading/alpaca-stream.ts`

### Common Change Patterns

**Pattern 1: Adding Trading Feature**
- Likely affects: `trading-orders`, `portfolio-management`
- May need: Alpaca API integration, order validation
- Consider: Risk limits, market hours, circuit breaker

**Pattern 2: Adding AI Capability**
- Likely affects: `ai-analysis`, `strategy-management`
- May need: LLM provider integration, fallback handling
- Consider: Cost implications, rate limits, error handling

**Pattern 3: Adding Real-time Updates**
- Likely affects: `real-time-streaming`
- Implementation: SSE endpoint in `server/observability/routes.ts`
- Consider: Event types, client reconnection, backpressure

**Pattern 4: Adding UI Feature**
- Likely affects: Multiple specs (backend + frontend)
- Implementation: API endpoint + React page/component
- Consider: React Query integration, error boundaries, loading states

## Summary

This agent provides comprehensive OpenSpec workflow management for the trading platform, ensuring:

1. **Proper Context**: Always checks existing specs and changes before proposing
2. **Format Compliance**: Enforces strict OpenSpec format requirements
3. **Quality Standards**: Ensures SHALL/MUST language, scenario coverage
4. **Integration Awareness**: Understands 8 existing capabilities and tech stack
5. **Safe Workflows**: Requires approval before implementation, proper validation
6. **Complete Documentation**: Proposal, tasks, design (when needed), deltas

**Remember**: OpenSpec is spec-driven development. Specs are truth. Changes are proposals. Keep them in sync.
