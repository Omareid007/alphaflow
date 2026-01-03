# Authentication Capability - Security Enhancement

## Purpose

Enhanced authentication requirements for trading order execution user context propagation and validation.

## Requirements

### Requirement: Trading User Context Propagation

Authentication middleware SHALL properly propagate user context to trading operations.

#### Scenario: Trading endpoint user context validation

- **GIVEN** a user is authenticated with valid session
- **WHEN** user accesses trading endpoints (e.g., `/api/alpaca-trading/execute`)
- **THEN** the requireAuth middleware SHALL extract `userId` from session
- **AND** attach `userId` to the request as `req.userId`
- **AND** ensure `userId` is available throughout the trading pipeline
- **AND** reject requests where `userId` is missing with HTTP 401 Unauthorized

#### Scenario: User context enforcement in trading operations

- **GIVEN** an authenticated user attempts to execute a trade
- **WHEN** the trading operation is processed
- **THEN** the system SHALL validate that `req.userId` is present and valid
- **AND** pass `userId` parameter to all trading execution functions
- **AND** ensure order creation includes proper user attribution
- **AND** reject any trading operation without proper user context

#### Scenario: Admin token trading context

- **GIVEN** a request uses admin token authentication (X-Admin-Token header)
- **WHEN** accessing trading endpoints
- **THEN** the system SHALL set `userId` to "admin-token-user"
- **AND** properly attribute trading actions to admin context
- **AND** ensure admin trading operations are logged with admin attribution

### Requirement: User Context Security Validation

All trading-related authentication SHALL enforce user context security.

#### Scenario: Bypass prevention in trading

- **GIVEN** a trading endpoint that requires user attribution
- **WHEN** the endpoint is accessed
- **THEN** the system SHALL NOT allow hardcoded authorization bypasses
- **AND** SHALL NOT accept `authorizedByOrchestrator: true` without proper user context
- **AND** SHALL validate that all trading operations are attributed to authenticated users
- **AND** SHALL prevent trading execution without proper user identification

#### Scenario: Session hijacking protection

- **GIVEN** an authenticated user session
- **WHEN** the user attempts trading operations
- **THEN** the system SHALL validate session integrity for trading actions
- **AND** prevent trading operations from being executed for different users
- **AND** ensure trading attribution matches authenticated session user
- **AND** log all trading actions with proper user attribution

## Security

### User Context Requirements

Trading endpoints MUST enforce:

- **User Attribution**: All trading operations MUST be attributed to authenticated user via `req.userId`
- **Context Validation**: User context MUST be validated before any trading execution
- **Bypass Prevention**: No hardcoded authorization bypasses allowed in trading operations
- **Session Integrity**: Trading operations MUST match authenticated session user

### Trading Session Security

Authentication for trading MUST include:

- **Session Validation**: Valid session or admin token required for all trading endpoints
- **User Identity Verification**: User identity MUST be verified before trading execution
- **Authorization Tracking**: All trading authorizations MUST be logged with user attribution
- **Context Propagation**: User context MUST be propagated through entire trading pipeline

## Files

**Enhanced Authentication Middleware**: `server/middleware/requireAuth.ts`
**Trading Route Security**: `server/routes/alpaca-trading.ts`
**Trading Engine Integration**: `server/trading/alpaca-trading-engine.ts`