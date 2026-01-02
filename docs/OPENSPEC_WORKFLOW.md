# OpenSpec Workflow Guide

**Version**: 1.0.0
**Last Updated**: 2026-01-02
**Project**: AlphaFlow Trading Platform

---

## Quick Reference

| Action          | Command                        | Description                        |
| --------------- | ------------------------------ | ---------------------------------- |
| List specs      | `openspec show --specs`        | View all capability specifications |
| List changes    | `openspec list`                | View active change proposals       |
| Create proposal | `/openspec:proposal <name>`    | Create new change (Claude Code)    |
| Validate        | `openspec validate --strict`   | Validate specs and changes         |
| Archive         | `openspec archive <change> -y` | Archive completed change           |

---

## What is OpenSpec?

OpenSpec is a **spec-driven development (SDD) framework** that aligns humans and AI by documenting requirements **before** writing code. It separates:

- **`openspec/specs/`** - Current truth (what IS built)
- **`openspec/changes/`** - Proposals (what SHOULD change)

This separation enables:

- ✅ Clear approval gates before implementation
- ✅ Reviewable AI-generated code
- ✅ Deterministic outputs
- ✅ Auditable change history

---

## When to Use OpenSpec

### ✅ CREATE CHANGE PROPOSAL

Use OpenSpec when making:

- **New features** - Add new capabilities or functionality
- **Breaking changes** - API changes, schema changes
- **Architecture changes** - Pattern changes, new dependencies
- **Performance optimizations** - Changes that affect behavior
- **Security updates** - Authentication, authorization, encryption changes

### ❌ DON'T USE OPENSPEC

Skip OpenSpec for:

- **Bug fixes** - Restoring spec-defined behavior
- **Typos/formatting** - Code style, comments
- **Non-breaking dependency updates** - Patch version bumps
- **Configuration changes** - Environment variables
- **Tests** - Testing existing behavior

**Rule of thumb**: If the change affects user-facing behavior or contracts, create a proposal.

---

## The Three-Stage Workflow

### Stage 1: Creating Change Proposals

#### Step 1: Review Current State

Before creating a change, understand the current system:

```bash
# List all capability specs
openspec show --specs

# List active changes
openspec list

# View specific capability
openspec show authentication --type spec

# Search for existing requirements
rg -n "Requirement:|Scenario:" openspec/specs
```

#### Step 2: Choose a Change ID

Follow naming conventions:

- Use **kebab-case**
- Start with a **verb** (`add-`, `update-`, `remove-`, `refactor-`)
- Be **descriptive** but concise
- Ensure **uniqueness**

**Examples**:

- ✅ `add-two-factor-auth`
- ✅ `update-order-validation-rules`
- ✅ `remove-legacy-api-endpoints`
- ❌ `2fa` (too short, no verb)
- ❌ `update` (not descriptive)

#### Step 3: Create Proposal Structure

```bash
# Create directories
mkdir -p openspec/changes/<change-id>/specs/<capability>

# Create required files
touch openspec/changes/<change-id>/proposal.md
touch openspec/changes/<change-id>/tasks.md
touch openspec/changes/<change-id>/specs/<capability>/spec.md
```

**Or use Claude Code slash command**:

```
/openspec:proposal <change-id>
```

#### Step 4: Write proposal.md

```markdown
# Change: Brief description

## Why

[1-2 sentences explaining the problem or opportunity]

## What Changes

- [Bullet list of changes]
- [Mark breaking changes with **BREAKING**]

## Impact

- Affected specs: [list capabilities]
- Affected code: [key files/systems]
- Breaking changes: [if any]
```

#### Step 5: Write tasks.md

```markdown
## 1. Category Name

- [ ] 1.1 Specific task
- [ ] 1.2 Another task
- [ ] 1.3 Testing task

## 2. Another Category

- [ ] 2.1 Task in second category
```

#### Step 6: Write Spec Deltas

Create `specs/<capability>/spec.md` with delta operations:

```markdown
## ADDED Requirements

### Requirement: New Feature Name

The system SHALL provide...

#### Scenario: Success case

- **WHEN** user performs action
- **THEN** expected result occurs
- **AND** additional outcome

## MODIFIED Requirements

### Requirement: Existing Feature Name

[Complete modified requirement - paste full text from original]

#### Scenario: Updated behavior

- **WHEN** new condition
- **THEN** new outcome

## REMOVED Requirements

### Requirement: Deprecated Feature

**Reason**: Why removing this feature
**Migration**: How users should adapt
```

**Critical Formatting Rules**:

- ✅ Use `#### Scenario:` (4 hashtags)
- ❌ NOT `- **Scenario:**` (bullets)
- ❌ NOT `### Scenario:` (3 hashtags)
- Every requirement MUST have at least one scenario
- Use SHALL/MUST for normative requirements

#### Step 7: Validate

```bash
# Validate specific change
openspec validate <change-id> --strict

# Debug delta parsing
openspec show <change-id> --json --deltas-only
```

Fix any validation errors before requesting approval.

#### Step 8: Request Approval

Share the change proposal with stakeholders:

```bash
# View the change
openspec show <change-id>

# Review in detail
cat openspec/changes/<change-id>/proposal.md
cat openspec/changes/<change-id>/tasks.md
openspec show <change-id> --json
```

**Do not proceed to implementation until approved!**

---

### Stage 2: Implementing Changes

**Use Claude Code slash command**:

```
/openspec:apply <change-id>
```

Or implement manually:

#### Step 1: Read All Change Documents

```bash
# Read the proposal
cat openspec/changes/<change-id>/proposal.md

# Read technical design (if exists)
cat openspec/changes/<change-id>/design.md

# Read implementation tasks
cat openspec/changes/<change-id>/tasks.md

# View spec deltas
openspec show <change-id> --json --deltas-only
```

#### Step 2: Track Progress

Create TODO list in your IDE or use task management:

- [ ] Read proposal
- [ ] Read design
- [ ] Read tasks
- [ ] Implement task 1.1
- [ ] Implement task 1.2
- [ ] ...
- [ ] Update tasks.md with [x] for completed items

#### Step 3: Implement Tasks Sequentially

Complete tasks in order from `tasks.md`:

1. Database migrations first
2. Schema updates
3. Backend implementation
4. Frontend updates
5. Tests
6. Documentation

#### Step 4: Update Checklist

After each task is complete, mark it in `tasks.md`:

```markdown
## 1. Implementation

- [x] 1.1 Create database schema ✅
- [x] 1.2 Implement API endpoint ✅
- [ ] 1.3 Add frontend component
```

#### Step 5: Final Validation

Before considering the change complete:

- All tasks in `tasks.md` marked `[x]`
- All tests passing
- Build succeeds
- No TypeScript errors
- Change validated: `openspec validate <change-id> --strict`

---

### Stage 3: Archiving Changes

After deployment to production, archive the change to update specs.

#### Step 1: Archive the Change

```bash
# Archive with spec updates (default)
openspec archive <change-id> --yes

# Archive without spec updates (tooling-only changes)
openspec archive <change-id> --skip-specs --yes
```

This will:

1. Move `changes/<change-id>/` to `changes/archive/YYYY-MM-DD-<change-id>/`
2. Apply spec deltas to `specs/<capability>/spec.md`
3. Update specs with ADDED/MODIFIED/REMOVED requirements
4. Validate the updated specs

#### Step 2: Verify Archive

```bash
# Check archive directory
ls -la openspec/changes/archive/

# View updated spec
openspec show <capability> --type spec

# Validate updated spec
openspec validate --specs --strict
```

#### Step 3: Commit Archive

```bash
git add openspec/
git commit -m "chore: Archive <change-id> change"
```

---

## OpenSpec Directory Structure

```
openspec/
├── project.md              # Project tech stack, conventions, constraints
├── AGENTS.md               # OpenSpec workflow instructions (auto-generated)
├── specs/                  # Current truth - what IS built
│   ├── authentication/
│   │   ├── spec.md         # Requirements and scenarios
│   │   └── design.md       # (optional) Technical patterns
│   ├── trading-orders/
│   │   └── spec.md
│   ├── strategy-management/
│   │   └── spec.md
│   ├── portfolio-management/
│   │   └── spec.md
│   ├── market-data/
│   │   └── spec.md
│   ├── ai-analysis/
│   │   └── spec.md
│   ├── admin-system/
│   │   └── spec.md
│   └── real-time-streaming/
│       └── spec.md
├── changes/                # Proposals - what SHOULD change
│   ├── add-email-notifications/
│   │   ├── proposal.md     # Why and what
│   │   ├── tasks.md        # Implementation checklist
│   │   ├── design.md       # (optional) Technical decisions
│   │   └── specs/          # Delta changes
│   │       ├── authentication/
│   │       │   └── spec.md # MODIFIED: Email required
│   │       └── admin-system/
│   │           └── spec.md # ADDED: Email notifications
│   └── archive/            # Completed changes
│       └── 2026-01-02-add-email-notifications/
│           └── ... (archived structure)
```

---

## File Templates

### proposal.md Template

```markdown
# Change: [Brief description]

## Why

[1-2 sentences on problem/opportunity]

## What Changes

- [Bullet list of changes]
- **BREAKING**: [Mark breaking changes]

## Impact

- Affected specs: [list capabilities]
- Affected code: [key files/systems]
- Breaking changes: [describe migration path]

## Dependencies

[External dependencies, new packages]

## Risk Assessment

**Risk**: [Low/Medium/High]
[Mitigation strategies]

## Timeline Estimate

[Not required but helpful]

## Success Criteria

- [ ] Measurable outcome 1
- [ ] Measurable outcome 2
```

### tasks.md Template

```markdown
# Implementation Tasks

## 1. Database Migration

- [ ] 1.1 Create migration script
- [ ] 1.2 Test migration on dev
- [ ] 1.3 Create rollback script

## 2. Backend Implementation

- [ ] 2.1 Update schema files
- [ ] 2.2 Implement API endpoints
- [ ] 2.3 Add validation logic
- [ ] 2.4 Update tests

## 3. Frontend Updates

- [ ] 3.1 Create UI components
- [ ] 3.2 Add API integration
- [ ] 3.3 Update user flows

## 4. Testing

- [ ] 4.1 Unit tests
- [ ] 4.2 Integration tests
- [ ] 4.3 E2E tests

## 5. Documentation

- [ ] 5.1 Update API docs
- [ ] 5.2 Update user guides
- [ ] 5.3 Add code comments

## 6. Deployment

- [ ] 6.1 Review and approve
- [ ] 6.2 Deploy to staging
- [ ] 6.3 Deploy to production
- [ ] 6.4 Archive change proposal
```

### Spec Delta Template (ADDED)

```markdown
## ADDED Requirements

### Requirement: New Capability Name

The system SHALL provide new functionality...

#### Scenario: Primary success path

- **WHEN** user initiates action
- **THEN** system responds correctly
- **AND** updates are persisted
- **AND** events are triggered

#### Scenario: Error handling

- **WHEN** invalid input provided
- **THEN** system rejects with clear error
- **AND** no side effects occur

#### Scenario: Edge case

- **WHEN** boundary condition occurs
- **THEN** system handles gracefully
```

### Spec Delta Template (MODIFIED)

```markdown
## MODIFIED Requirements

### Requirement: Existing Capability Name

[PASTE THE COMPLETE UPDATED REQUIREMENT HERE]

The system SHALL provide existing functionality WITH NEW BEHAVIOR...

#### Scenario: Original behavior preserved

- **WHEN** existing condition
- **THEN** system behaves as before

#### Scenario: New behavior added

- **WHEN** new condition introduced
- **THEN** system responds with new behavior
- **AND** backward compatibility maintained (if applicable)

#### Scenario: Breaking change migration

- **WHEN** old clients use deprecated API
- **THEN** system returns deprecation warning
- **AND** provides migration guidance
```

**IMPORTANT**: For MODIFIED requirements, paste the **FULL updated requirement** including all scenarios. Partial updates will cause data loss when archived.

### Spec Delta Template (REMOVED)

```markdown
## REMOVED Requirements

### Requirement: Deprecated Feature Name

**Reason**: [Why this feature is being removed]

**Migration**: [How users should adapt]

- Step 1: [Migration instruction]
- Step 2: [Alternative approach]

**Affected APIs**:

- `DELETE /api/old-endpoint` - Removed
- `GET /api/legacy/:id` - Removed

**Timeline**:

- Deprecation notice: [Date]
- Removal date: [Date]
```

---

## Common Commands

### Exploration Commands

```bash
# List all specifications
openspec show --specs

# List all active changes
openspec list

# View specific spec
openspec show authentication --type spec

# View specific change
openspec show add-email-notifications

# Show only deltas in a change
openspec show add-email-notifications --json --deltas-only
```

### Validation Commands

```bash
# Validate all specs
openspec validate --specs --strict

# Validate all changes
openspec validate --changes --strict

# Validate specific item
openspec validate add-email-notifications --strict

# Validate everything
openspec validate --all --strict
```

### Management Commands

```bash
# Update OpenSpec instruction files
openspec update

# Archive completed change
openspec archive add-email-notifications --yes

# Archive without updating specs (tooling changes only)
openspec archive deploy-ci-cd --skip-specs --yes
```

---

## Best Practices

### Writing Requirements

1. **Use SHALL/MUST** for normative requirements (avoid SHOULD/MAY)
2. **Be specific** - "The system SHALL hash passwords with bcrypt (10 rounds minimum)"
3. **Include acceptance criteria** - Each requirement needs scenarios
4. **Reference implementations** - Link to files: `server/routes/auth.ts:42`

### Writing Scenarios

1. **Use the WHEN/THEN/AND format** consistently
2. **Cover success and failure paths**
3. **Test boundary conditions**
4. **Include realistic data examples**

**Good Example**:

```markdown
#### Scenario: Successful order submission

- **WHEN** user submits market order with symbol "AAPL" and qty 10
- **THEN** system SHALL validate buying power exceeds $1500
- **AND** generate client_order_id with format "{strategyId}-AAPL-buy-{timestamp}"
- **AND** submit order to Alpaca broker
- **AND** return HTTP 200 with order ID
```

**Bad Example**:

```markdown
#### Scenario: Order works

- User creates order
- System processes it
- Order is successful
```

### Naming Capabilities

- **Single focus** - One capability per directory
- **Verb-noun pattern** - `user-authentication`, `order-execution`
- **10-minute rule** - Should be understandable in 10 minutes
- **Split if needed** - If description uses "AND", consider splitting

### Change ID Conventions

- **Verb-led** - Start with action verb
- **Descriptive** - Convey what's changing
- **Unique** - No duplicates (append `-2`, `-3` if needed)
- **Concise** - Max 50 characters

---

## Example Workflow

### Scenario: Add Two-Factor Authentication

#### 1. Create Proposal

```bash
mkdir -p openspec/changes/add-two-factor-auth/specs/authentication
```

**proposal.md**:

```markdown
# Change: Add Two-Factor Authentication

## Why

Users need stronger account security. Password-only authentication is vulnerable to credential stuffing and phishing attacks.

## What Changes

- Add TOTP-based two-factor authentication during login
- Support authenticator apps (Google Authenticator, Authy)
- Add 2FA enrollment flow
- Add backup codes for account recovery

## Impact

- Affected specs: `authentication`
- Affected code: `server/routes/auth.ts`, `app/login/page.tsx`
- **BREAKING**: Login flow now requires 2FA code after password

## Dependencies

- `speakeasy` (TOTP generation/validation)
- `qrcode` (QR code generation for enrollment)

## Success Criteria

- [ ] Users can enable 2FA in settings
- [ ] Login requires 2FA code when enabled
- [ ] Backup codes allow recovery
- [ ] 2FA can be disabled with password confirmation
```

**tasks.md**:

```markdown
## 1. Database Schema

- [ ] 1.1 Add `totp_secret` field to users table
- [ ] 1.2 Create `backup_codes` table
- [ ] 1.3 Create migration script

## 2. Backend Implementation

- [ ] 2.1 Install speakeasy and qrcode packages
- [ ] 2.2 Create /api/auth/2fa/setup endpoint
- [ ] 2.3 Create /api/auth/2fa/verify endpoint
- [ ] 2.4 Update /api/auth/login to check 2FA
- [ ] 2.5 Add backup codes generation
- [ ] 2.6 Add 2FA disable endpoint

## 3. Frontend Updates

- [ ] 3.1 Create 2FA setup page
- [ ] 3.2 Update login page to prompt for code
- [ ] 3.3 Add settings toggle for 2FA
- [ ] 3.4 Create backup codes display

## 4. Testing

- [ ] 4.1 Test 2FA enrollment flow
- [ ] 4.2 Test login with 2FA
- [ ] 4.3 Test backup code recovery
- [ ] 4.4 Test 2FA disable flow

## 5. Documentation

- [ ] 5.1 Update API documentation
- [ ] 5.2 Create user guide for 2FA setup

## 6. Deployment

- [ ] 6.1 Deploy to staging
- [ ] 6.2 Test on staging
- [ ] 6.3 Deploy to production
- [ ] 6.4 Archive change proposal
```

**specs/authentication/spec.md**:

```markdown
## ADDED Requirements

### Requirement: Two-Factor Authentication Enrollment

Users SHALL be able to enable TOTP-based two-factor authentication for enhanced account security.

#### Scenario: 2FA setup with QR code

- **WHEN** an authenticated user initiates 2FA setup
- **THEN** the system SHALL generate a random TOTP secret (32-byte base32)
- **AND** create otpauth:// URI with secret, issuer, and username
- **AND** generate QR code image from URI
- **AND** return QR code data URL and backup codes
- **AND** store TOTP secret (encrypted) in users table after verification

#### Scenario: 2FA verification during setup

- **WHEN** a user submits verification code during 2FA enrollment
- **THEN** the system SHALL verify code against generated secret using speakeasy
- **AND** enable 2FA for the account if code is valid
- **AND** return HTTP 200 with success confirmation
- **AND** return HTTP 400 if code is invalid

#### Scenario: Backup codes generation

- **WHEN** 2FA is enabled for an account
- **THEN** the system SHALL generate 10 random backup codes (8 characters each)
- **AND** hash backup codes with bcrypt before storage
- **AND** return plaintext codes to user (shown once)
- **AND** mark all codes as unused

### Requirement: Two-Factor Authentication Login

Users with 2FA enabled SHALL be required to provide a TOTP code during login.

#### Scenario: Login with 2FA enabled

- **WHEN** a user with 2FA enabled submits valid username and password
- **THEN** the system SHALL verify password as normal
- **AND** return HTTP 200 with requires2FA: true flag
- **AND** NOT create session until 2FA code verified
- **AND** store temporary login token (5-minute expiration)

#### Scenario: 2FA code verification

- **WHEN** a user submits 2FA code with temporary login token
- **THEN** the system SHALL verify code against stored TOTP secret
- **AND** create session cookie if code is valid
- **AND** return HTTP 200 with user ID and username
- **AND** return HTTP 401 if code is invalid or token expired

#### Scenario: Backup code usage

- **WHEN** a user submits backup code instead of TOTP code
- **THEN** the system SHALL verify code matches one of the hashed backup codes
- **AND** mark backup code as used (prevent reuse)
- **AND** create session cookie if code is valid
- **AND** warn user of remaining backup code count
- **AND** return HTTP 401 if backup code is invalid or already used

## MODIFIED Requirements

### Requirement: User Login

Users SHALL be able to authenticate with username, password, and optional 2FA code to obtain a session.

#### Scenario: Login without 2FA

- **WHEN** a user without 2FA enabled provides valid credentials
- **THEN** the system SHALL create session immediately
- **AND** set HTTP-only, secure session cookie
- **AND** return HTTP 200 with user ID and username

#### Scenario: Login with 2FA enabled

- **WHEN** a user with 2FA enabled provides valid password
- **THEN** the system SHALL verify password first
- **AND** return requires2FA: true WITHOUT creating session
- **AND** generate temporary login token (5-minute expiration)
- **AND** require 2FA code submission to complete login

#### Scenario: Invalid credentials

- **WHEN** a user provides incorrect username or password
- **THEN** the system SHALL return HTTP 401 Unauthorized
- **AND** NOT reveal whether 2FA is enabled (prevent enumeration)

#### Scenario: Rate limiting exceeded

- **WHEN** a user exceeds 5 login attempts in 15 minutes
- **THEN** the system SHALL return HTTP 429 Too Many Requests
- **AND** apply to both password and 2FA attempts
```

#### Step 2: Validate Archive

```bash
# Validate specs after archiving
openspec validate --specs --strict

# View updated capability
openspec show authentication --type spec
```

If validation fails, manually fix spec and commit correction.

---

## Troubleshooting

### "Change must have at least one delta"

**Cause**: No spec delta files in `changes/<change-id>/specs/`

**Fix**:

```bash
mkdir -p openspec/changes/<change-id>/specs/<capability>
echo "## ADDED Requirements" > openspec/changes/<change-id>/specs/<capability>/spec.md
```

### "Requirement must have at least one scenario"

**Cause**: Scenario header format is incorrect

**Wrong**:

```markdown
- **Scenario: Name**
  **Scenario**: Name

### Scenario: Name
```

**Correct**:

```markdown
#### Scenario: Name
```

### "Requirement parsing failed"

**Cause**: Requirement header doesn't start with `### Requirement:`

**Fix**:

```markdown
### Requirement: Your Requirement Name
```

### Silent Scenario Parsing Failures

**Debug**:

```bash
openspec show <change-id> --json --deltas-only | jq '.deltas[0].operations.ADDED'
```

Check that scenarios appear in the JSON output.

---

## Integration with Claude Code

### Available Slash Commands

After OpenSpec initialization, restart Claude Code to load:

```
/openspec:proposal <name>  # Create change proposal
/openspec:apply <name>     # Implement approved change
/openspec:archive <name>   # Archive completed change
```

### Usage Examples

**Create Proposal**:

```
/openspec:proposal add-futures-trading
```

Claude will:

1. Create change directory structure
2. Generate proposal.md with context
3. Create tasks.md with implementation steps
4. Create spec deltas for affected capabilities

**Implement Change**:

```
/openspec:apply add-futures-trading
```

Claude will:

1. Read proposal, design, and tasks
2. Implement each task sequentially
3. Update tasks.md with progress
4. Validate implementation against specs

**Archive Change**:

```
/openspec:archive add-futures-trading
```

Claude will:

1. Verify all tasks completed
2. Apply spec deltas to specs
3. Move change to archive/
4. Validate updated specs
5. Commit changes to git

---

## AlphaFlow-Specific Guidelines

### Capabilities in This Project

| Capability             | Purpose                                | Endpoints | Database Tables                                      |
| ---------------------- | -------------------------------------- | --------- | ---------------------------------------------------- |
| `authentication`       | User auth, sessions, password reset    | 7         | 2 (users, passwordResetTokens)                       |
| `trading-orders`       | Order execution, lifecycle, retry      | 20        | 3 (orders, fills, brokerAssets)                      |
| `strategy-management`  | Strategy CRUD, backtesting, versioning | 40+       | 5 (strategies, versions, runs, trades, curves)       |
| `portfolio-management` | Positions, risk, rebalancing           | 16        | 3 (positions, policies, runs)                        |
| `market-data`          | Quotes, news, watchlists               | 25        | 5 (watchlists, symbols, cache, counters, indicators) |
| `ai-analysis`          | AI signals, LLM fallback, sentiment    | 28        | 8 (decisions, features, outcomes, etc.)              |
| `admin-system`         | Admin interface, diagnostics           | 100+      | 7 (settings, assets, liquidity, etc.)                |
| `real-time-streaming`  | SSE infrastructure                     | 9         | 0 (in-memory only)                                   |

### Common Change Types

**New Trading Feature**:

- Affects: `trading-orders`, possibly `strategy-management`
- Example: `add-options-trading`

**AI Enhancement**:

- Affects: `ai-analysis`, possibly `strategy-management`
- Example: `add-sentiment-confidence-filter`

**Security Update**:

- Affects: `authentication`, possibly `admin-system`
- Example: `add-ip-allowlist`

**Performance Optimization**:

- May affect: Any capability
- Example: `optimize-order-reconciliation`

### Project-Specific Conventions

From `openspec/project.md`:

- **Commit format**: Conventional Commits (feat:, fix:, etc.)
- **Testing**: Vitest, must pass before archiving
- **Linting**: ESLint, Prettier auto-fix on commit
- **Type safety**: Minimize `:any` usage, strict mode enabled
- **Logging**: Pino structured logging (no console.log in server/\*)
- **Database**: Drizzle ORM with PostgreSQL

---

## FAQ

### Q: When should I create design.md?

**A**: Create `design.md` if the change involves:

- Cross-cutting changes (multiple services)
- New architectural patterns
- New external dependencies
- Security/performance complexity
- Migration complexity
- Ambiguity that benefits from upfront decisions

Skip `design.md` for simple, isolated changes.

### Q: What if I modify multiple capabilities?

**A**: Create delta files for each affected capability:

```
openspec/changes/add-multi-factor-auth/
├── proposal.md
├── tasks.md
└── specs/
    ├── authentication/spec.md    # ADDED: 2FA requirements
    └── admin-system/spec.md      # ADDED: 2FA config endpoints
```

### Q: How do I handle breaking changes?

**A**:

1. Mark **BREAKING** in proposal.md
2. Use `## MODIFIED Requirements` in spec deltas
3. Include migration path in REMOVED requirements
4. Add deprecation timeline
5. Update API version if major breaking change

### Q: Can I update specs directly without a change proposal?

**A**: Only for bug fixes that restore spec-defined behavior. All feature changes should go through change proposals.

### Q: How do I validate changes before committing?

**A**:

```bash
# Validate specs
openspec validate --specs --strict

# Validate changes
openspec validate --changes --strict

# Run tests
npx vitest run

# Type check
npx tsc --noEmit

# Lint
npx next lint
```

All must pass before archiving.

---

## Resources

- **OpenSpec GitHub**: https://github.com/Fission-AI/OpenSpec
- **OpenSpec Documentation**: https://openspec.dev
- **Project Context**: `openspec/project.md`
- **Workflow Instructions**: `openspec/AGENTS.md`
- **Implementation Plan**: `OPENSPEC_IMPLEMENTATION_PLAN.md`

---

## Next Steps

1. **Create your first change proposal**:

   ```
   /openspec:proposal add-your-feature
   ```

2. **Review the proposal**:

   ```bash
   openspec show add-your-feature
   ```

3. **Validate before implementation**:

   ```bash
   openspec validate add-your-feature --strict
   ```

4. **Implement the change**:

   ```
   /openspec:apply add-your-feature
   ```

5. **Archive when deployed**:
   ```bash
   openspec archive add-your-feature --yes
   ```

---

**Happy spec-driven development!** 🚀
