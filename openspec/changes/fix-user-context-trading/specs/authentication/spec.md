## ADDED Requirements

### Requirement: Trading User Context Propagation

Authentication middleware SHALL properly propagate user context to trading operations.

#### Scenario: Trading endpoint user context validation

- **WHEN** a user is authenticated with valid session
- **AND** user accesses trading endpoints (e.g., `/api/alpaca-trading/execute`)
- **THEN** the requireAuth middleware SHALL extract `userId` from session
- **AND** attach `userId` to the request as `req.userId`
- **AND** ensure `userId` is available throughout the trading pipeline
- **AND** reject requests where `userId` is missing with HTTP 401 Unauthorized

#### Scenario: User context enforcement in trading operations

- **WHEN** an authenticated user attempts to execute a trade
- **THEN** the system SHALL validate that `req.userId` is present and valid
- **AND** pass `userId` parameter to all trading execution functions
- **AND** ensure order creation includes proper user attribution
- **AND** reject any trading operation without proper user context

#### Scenario: Admin token trading context

- **WHEN** a request uses admin token authentication (X-Admin-Token header)
- **AND** accesses trading endpoints
- **THEN** the system SHALL set `userId` to "admin-token-user"
- **AND** properly attribute trading actions to admin context
- **AND** ensure admin trading operations are logged with admin attribution

### Requirement: User Context Security Validation

All trading-related authentication SHALL enforce user context security.

#### Scenario: Bypass prevention in trading

- **WHEN** a trading endpoint that requires user attribution is accessed
- **THEN** the system SHALL NOT allow hardcoded authorization bypasses
- **AND** SHALL NOT accept `authorizedByOrchestrator: true` without proper user context
- **AND** SHALL validate that all trading operations are attributed to authenticated users
- **AND** SHALL prevent trading execution without proper user identification

#### Scenario: Session hijacking protection

- **WHEN** an authenticated user session attempts trading operations
- **THEN** the system SHALL validate session integrity for trading actions
- **AND** prevent trading operations from being executed for different users
- **AND** ensure trading attribution matches authenticated session user
- **AND** log all trading actions with proper user attribution