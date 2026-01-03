# Design: Fix User Context Security Vulnerability in Trading Order Execution

## Context

Critical security vulnerability discovered during stabilization audit where trading order execution bypasses user context validation. The trading system currently hardcodes `authorizedByOrchestrator: true` which allows authenticated users to execute trades without proper user attribution or ownership validation.

### Background

- AlphaFlow is a multi-user trading platform with session-based authentication
- Trading operations require user attribution for regulatory compliance and audit trails
- Database schema supports multi-user with proper foreign key relationships
- Authentication middleware properly extracts `req.userId` from sessions
- Trading execution pipeline bypasses this user context validation

### Constraints

- Must not break existing valid trading functionality
- Must maintain trading execution performance
- Must comply with financial regulations requiring trade attribution
- Must work with existing Alpaca broker integration
- Must support both user sessions and admin token authentication

### Stakeholders

- Users: Need secure trading operations with proper attribution
- Compliance: Requires audit trail of who initiated each trade
- Developers: Need clear user context propagation patterns
- Operations: Need secure multi-user trading isolation

## Goals / Non-Goals

### Goals

- **Primary**: Eliminate security vulnerability allowing unauthorized trading attribution
- **Security**: Enforce user context validation throughout trading pipeline
- **Compliance**: Ensure all trades are properly attributed to authenticated users
- **User Isolation**: Prevent users from accessing or executing trades for other users
- **Audit Trail**: Log all trading operations with proper user attribution

### Non-Goals

- **Performance Optimization**: Not changing trading execution speed/efficiency
- **New Trading Features**: Only fixing security, not adding functionality
- **UI Changes**: Backend security fix only, no frontend modifications
- **Database Schema Changes**: Leveraging existing multi-user schema design

## Decisions

### Decision 1: User Context Propagation Method

**Chosen**: Modify trading function signatures to require `userId` parameter

**Alternatives Considered**:
- **Thread-local storage**: Complex in Node.js, not reliable across async boundaries
- **Request context passing**: Would require extensive middleware changes
- **Database-level user filtering**: Doesn't address authorization bypass at execution level

**Rationale**: Function signature changes make user context requirements explicit and prevent bypasses. Minimal impact on existing code while ensuring security cannot be accidentally bypassed.

### Decision 2: Authorization Bypass Removal

**Chosen**: Remove `authorizedByOrchestrator: true` hardcoding, require explicit user context

**Alternatives Considered**:
- **Keep bypass with user validation**: Still allows potential security gaps
- **Add additional validation layer**: Adds complexity without fixing root cause
- **Role-based authorization system**: Over-engineering for current requirements

**Rationale**: Complete removal of bypass ensures all trading operations have proper user attribution. Simpler and more secure than attempting to validate bypasses.

### Decision 3: User Ownership Validation Approach

**Chosen**: Database-level filtering with `userId` foreign key constraints

**Alternatives Considered**:
- **Application-level checks only**: Can be bypassed if validation is missed
- **Service-level user scoping**: Adds complexity across multiple service boundaries
- **Request-level authorization middleware**: Doesn't cover all trading code paths

**Rationale**: Database foreign key constraints provide last line of defense against unauthorized access. Combined with application-level filtering provides defense in depth.

### Decision 4: Admin Authentication Handling

**Chosen**: Map admin token to special "admin-token-user" userId for trading operations

**Alternatives Considered**:
- **Separate admin trading pipeline**: Would duplicate trading logic
- **Skip user validation for admin**: Would recreate the security vulnerability
- **Create actual admin user account**: Adds complexity for CI/CD operations

**Rationale**: Treats admin operations as special user context, maintains consistent security model while supporting admin functionality.

## Implementation Approach

### Phase 1: Authentication Middleware Enhancement
1. Ensure `requireAuth` middleware properly extracts and validates `userId`
2. Add proper error handling for missing user context
3. Support both session-based and admin token authentication

### Phase 2: Trading Engine Security Updates
1. Update `alpacaTradingEngine.executeAlpacaTrade` function signature to require `userId`
2. Remove `authorizedByOrchestrator: true` hardcoding
3. Add user context validation before all trading operations
4. Implement user ownership checks for order access

### Phase 3: Database Integration
1. Leverage existing `userId` foreign key constraints in orders schema
2. Implement user-scoped order queries and filtering
3. Add database-level validation to prevent orphaned orders

### Phase 4: Order Management Security
1. Add user ownership validation to all order endpoints
2. Implement user-scoped order history and fill data
3. Ensure proper user isolation between accounts

## Risks / Trade-offs

### Risks

- **Trading Disruption**: Incorrect implementation could break trading execution
  - **Mitigation**: Thorough testing with paper trading before live deployment

- **Performance Impact**: Additional user validation checks could slow trading
  - **Mitigation**: Database indexes on userId, efficient query patterns

- **Admin Operations**: Admin token operations might fail without proper mapping
  - **Mitigation**: Special "admin-token-user" mapping for admin authentication

### Trade-offs

- **Security vs. Simplicity**: Added complexity for user context validation improves security
- **Explicit vs. Implicit**: Function signature changes make requirements explicit but require more code changes
- **Defense in Depth**: Multiple validation layers increase security but add complexity

## Migration Plan

### Pre-Migration
1. Comprehensive testing with existing paper trading setup
2. Validation that all current admin operations continue to work
3. Database backup and rollback procedures prepared

### Migration Steps
1. **Phase 1**: Update authentication middleware (low risk)
2. **Phase 2**: Update trading engine with user context (medium risk)
3. **Phase 3**: Add database-level validation (low risk)
4. **Phase 4**: Update order management endpoints (medium risk)

### Post-Migration
1. Monitor trading operations for any authentication failures
2. Validate audit logs show proper user attribution
3. Confirm no cross-user data leakage in order access

### Rollback Plan
- Revert function signature changes and restore `authorizedByOrchestrator: true`
- Remove user validation checks from trading pipeline
- Database schema changes are non-breaking so don't require rollback

## Open Questions

- **Performance Impact**: What is acceptable latency increase for user validation?
  - **Proposed**: < 10ms additional latency per trading operation

- **Admin User Display**: How should admin-initiated trades appear in user interfaces?
  - **Proposed**: Show as "System" or "Admin" user in trade history

- **Multi-User Testing**: How to comprehensively test user isolation without production data?
  - **Proposed**: Create test users and validate complete isolation in staging environment

- **Compliance Documentation**: What additional audit trail documentation is required?
  - **Proposed**: Log user attribution for all trading actions with proper field mappings