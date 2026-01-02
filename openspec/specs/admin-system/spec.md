# Admin & System Capability

## Purpose

Comprehensive administration and system management interface for monitoring, configuring, and controlling the trading platform. Provides observability, API management, AI configuration, trading universe administration, user management, and system diagnostics capabilities.

## Requirements

### Requirement: System Health Monitoring

The system SHALL provide comprehensive health monitoring across all services.

#### Scenario: Database health check

- **WHEN** an admin requests database health status
- **THEN** the system SHALL execute a test query against the database
- **AND** return connection pool statistics
- **AND** return HTTP 200 with healthy status and pool metrics
- **AND** return HTTP 503 with unhealthy status if connection fails

#### Scenario: Comprehensive health check

- **WHEN** an admin requests /api/admin/observability/health
- **THEN** the system SHALL check Database, LLM Providers, Alpaca Trading, and Background Jobs
- **AND** return health status for each service (healthy, degraded, unhealthy)
- **AND** return overall status as healthy only if database and Alpaca are both healthy
- **AND** include descriptive messages for each service

### Requirement: API Usage Statistics and Provider Quotas

The system SHALL track and report API usage statistics and quota enforcement for all external providers.

#### Scenario: Get all API usage statistics

- **WHEN** an admin requests /api/admin/api-usage without provider filter
- **THEN** the system SHALL return usage statistics for all providers
- **AND** return quota policies for each provider (maxRequestsPerMinute, maxRequestsPerDay, maxRequestsPerWeek)
- **AND** include current usage counts and remaining budget

#### Scenario: Get provider-specific usage

- **WHEN** an admin requests /api/admin/api-usage?provider=finnhub
- **THEN** the system SHALL return detailed statistics for the specified provider
- **AND** include the provider's quota policy configuration
- **AND** show current request count and time window

#### Scenario: Get Valyu budget status

- **WHEN** an admin requests /api/admin/valyu-budget
- **THEN** the system SHALL return budget status for web, finance, and proprietary retrievals
- **AND** include monthly limits and current usage counts
- **AND** show available retrieval quota remaining

#### Scenario: Update Valyu budget limits

- **WHEN** an admin updates /api/admin/valyu-budget with new limits
- **THEN** the system SHALL update the in-memory budget configuration
- **AND** return HTTP 200 with updated configuration
- **AND** persist the new limits for future budget checks

### Requirement: AI Provider Configuration

The system SHALL allow runtime configuration of AI/LLM providers without service restart.

#### Scenario: Get AI configuration

- **WHEN** an admin requests /api/admin/ai-config
- **THEN** the system SHALL return autoExecuteTrades and conservativeMode flags
- **AND** return HTTP 200

#### Scenario: Update AI configuration

- **WHEN** an admin updates /api/admin/ai-config with autoExecuteTrades=false
- **THEN** the system SHALL update the agent status in the database
- **AND** return HTTP 200 with updated configuration
- **AND** affect future autonomous trading decisions immediately

#### Scenario: Get model router configurations

- **WHEN** an admin requests /api/admin/model-router/configs
- **THEN** the system SHALL return role-based LLM routing configurations
- **AND** include available providers list (openai, groq, together, aimlapi)
- **AND** show provider, model, temperature, and maxTokens for each role

#### Scenario: Update role configuration

- **WHEN** an admin updates /api/admin/model-router/configs/technical_analyst
- **THEN** the system SHALL update the LLM routing for technical_analyst role
- **AND** validate the role is in [market_news_summarizer, technical_analyst, risk_manager, execution_planner, post_trade_reporter]
- **AND** return HTTP 200 with updated configuration

#### Scenario: Get recent LLM calls

- **WHEN** an admin requests /api/admin/model-router/calls?limit=50&role=technical_analyst
- **THEN** the system SHALL return up to 50 recent LLM calls for the specified role
- **AND** include role, provider, model, timestamp, and cost information

#### Scenario: Get LLM call statistics

- **WHEN** an admin requests /api/admin/model-router/stats
- **THEN** the system SHALL return total call count and total cost across all roles
- **AND** aggregate statistics by role and provider

### Requirement: Module Registry Management

The system SHALL provide a modular admin interface with RBAC-controlled access.

#### Scenario: Get all admin modules

- **WHEN** an admin requests /api/admin/modules
- **THEN** the system SHALL return all registered admin modules
- **AND** include module ID, name, description, icon, path, and requiredCapability
- **AND** return total module count

#### Scenario: Get accessible modules for user

- **WHEN** an admin requests /api/admin/modules/accessible
- **THEN** the system SHALL filter modules based on user's RBAC capabilities
- **AND** return only modules the user has permission to access
- **AND** include user role and total available modules count

#### Scenario: Get specific module

- **WHEN** an admin requests /api/admin/modules/universe-management
- **THEN** the system SHALL return the module configuration
- **AND** return HTTP 404 if module does not exist

#### Scenario: Get admin overview

- **WHEN** an admin requests /api/admin/overview
- **THEN** the system SHALL return agent status (isRunning, killSwitchActive, lastHeartbeat)
- **AND** include work queue counts (PENDING, RUNNING, FAILED, DEAD_LETTER)
- **AND** include LLM statistics (totalCalls, totalCost)
- **AND** include API usage summary for all providers

### Requirement: Trading Universe Management

The system SHALL manage the tradable asset universe with eligibility rules and exclusions.

#### Scenario: Get universe statistics

- **WHEN** an admin requests /api/admin/universe/stats
- **THEN** the system SHALL return total assets, tradable count, excluded count
- **AND** include last refresh timestamp
- **AND** return HTTP 200

#### Scenario: Get universe assets

- **WHEN** an admin requests /api/admin/universe/assets?assetClass=us_equity&tradable=true&limit=100
- **THEN** the system SHALL return up to 100 tradable US equity assets
- **AND** filter by assetClass (us_equity, crypto) if provided
- **AND** filter by tradable status if specified

#### Scenario: Get asset details

- **WHEN** an admin requests /api/admin/universe/assets/AAPL
- **THEN** the system SHALL return detailed asset information for AAPL
- **AND** include symbol, name, exchange, assetClass, tradable status
- **AND** return HTTP 404 if asset not found

#### Scenario: Refresh universe

- **WHEN** an admin POSTs to /api/admin/universe/refresh with assetClass=us_equity
- **THEN** the system SHALL fetch latest assets from Alpaca
- **AND** update the broker_assets table
- **AND** return counts of added, updated, and removed assets

#### Scenario: Exclude symbol

- **WHEN** an admin POSTs to /api/admin/universe/exclude/TSLA with reason="Regulatory restriction"
- **THEN** the system SHALL mark TSLA as excluded in the database
- **AND** prevent TSLA from appearing in tradable universe
- **AND** return HTTP 200 with success confirmation

#### Scenario: Get tradable symbols

- **WHEN** an admin requests /api/admin/universe/tradable?limit=500
- **THEN** the system SHALL return up to 500 tradable US equity symbols
- **AND** return symbol array and count

### Requirement: Liquidity Management

The system SHALL classify assets by liquidity tiers for trading decisions.

#### Scenario: Get liquidity statistics

- **WHEN** an admin requests /api/admin/liquidity/stats
- **THEN** the system SHALL return tier distribution (A, B, C, D tier counts)
- **AND** include total symbols with liquidity metrics
- **AND** return timestamp of statistics generation

#### Scenario: Get symbol liquidity metrics

- **WHEN** an admin requests /api/admin/liquidity/metrics/AAPL
- **THEN** the system SHALL return AAPL's liquidity tier, average volume, average spread
- **AND** return HTTP 404 if liquidity metrics not found

#### Scenario: Get symbols by tier

- **WHEN** an admin requests /api/admin/liquidity/tier/A?limit=100
- **THEN** the system SHALL return up to 100 tier A (highest liquidity) symbols
- **AND** validate tier is in [A, B, C, D]
- **AND** return HTTP 400 if invalid tier provided

#### Scenario: Get top liquid symbols

- **WHEN** an admin requests /api/admin/liquidity/top?limit=50
- **THEN** the system SHALL return the 50 most liquid symbols
- **AND** sort by liquidity score descending

#### Scenario: Compute liquidity metrics

- **WHEN** an admin POSTs to /api/admin/liquidity/compute with symbols array and traceId
- **THEN** the system SHALL fetch market data for specified symbols
- **AND** calculate average volume and spread metrics
- **AND** assign liquidity tiers (A, B, C, D)
- **AND** store metrics in database
- **AND** return computed count and traceId

### Requirement: Fundamentals Management

The system SHALL manage fundamental analysis data for universe symbols.

#### Scenario: Get fundamentals statistics

- **WHEN** an admin requests /api/admin/fundamentals/stats
- **THEN** the system SHALL return total symbols with fundamentals data
- **AND** include average fundamental score
- **AND** return timestamp of statistics generation

#### Scenario: Get symbol fundamentals

- **WHEN** an admin requests /api/admin/fundamentals/AAPL
- **THEN** the system SHALL return fundamental metrics (P/E ratio, market cap, revenue growth, etc.)
- **AND** include fundamental score (0-1 range)
- **AND** return HTTP 404 if fundamentals not found

#### Scenario: Get top scoring symbols

- **WHEN** an admin requests /api/admin/fundamentals/top/scores?limit=50
- **THEN** the system SHALL return 50 symbols with highest fundamental scores
- **AND** sort by fundamental score descending

#### Scenario: Fetch fundamentals

- **WHEN** an admin POSTs to /api/admin/fundamentals/fetch with symbols array and traceId
- **THEN** the system SHALL retrieve fundamental data from external providers (SEC EDGAR, Valyu)
- **AND** calculate fundamental scores
- **AND** store data in database
- **AND** return fetched count and traceId

### Requirement: Candidates Management

The system SHALL manage trading candidate symbols with approval workflow.

#### Scenario: Get candidates statistics

- **WHEN** an admin requests /api/admin/candidates/stats
- **THEN** the system SHALL return counts by status (NEW, WATCHLIST, APPROVED, REJECTED)
- **AND** include total candidates count

#### Scenario: Get candidates list

- **WHEN** an admin requests /api/admin/candidates?status=APPROVED&limit=100
- **THEN** the system SHALL return up to 100 approved candidates
- **AND** filter by status if provided
- **AND** return candidate symbol, liquidity tier, fundamental score, and status

#### Scenario: Get specific candidate

- **WHEN** an admin requests /api/admin/candidates/NVDA
- **THEN** the system SHALL return candidate details for NVDA
- **AND** include liquidity metrics, fundamental data, and approval status
- **AND** return HTTP 404 if candidate not found

#### Scenario: Generate candidates

- **WHEN** an admin POSTs to /api/admin/candidates/generate with minLiquidityTier=A, minScore=0.5, limit=100
- **THEN** the system SHALL query universe for symbols meeting criteria
- **AND** create candidate records with NEW status
- **AND** return generated count and candidate list

#### Scenario: Approve candidate

- **WHEN** an admin POSTs to /api/admin/candidates/TSLA/approve
- **THEN** the system SHALL update TSLA status to APPROVED
- **AND** make TSLA available for strategy allocation
- **AND** return HTTP 200 with updated candidate

#### Scenario: Reject candidate

- **WHEN** an admin POSTs to /api/admin/candidates/GME/reject
- **THEN** the system SHALL update GME status to REJECTED
- **AND** exclude GME from future candidate generation
- **AND** return HTTP 200

#### Scenario: Add to watchlist

- **WHEN** an admin POSTs to /api/admin/candidates/COIN/watchlist
- **THEN** the system SHALL update COIN status to WATCHLIST
- **AND** mark for monitoring without immediate approval
- **AND** return HTTP 200

#### Scenario: Get approved symbols

- **WHEN** an admin requests /api/admin/candidates/approved/list
- **THEN** the system SHALL return array of all APPROVED candidate symbols
- **AND** return total count

### Requirement: User Administration

The system SHALL allow admin users to manage user accounts.

#### Scenario: Get all users

- **WHEN** an admin requests /api/admin/users
- **THEN** the system SHALL return all user accounts without password fields
- **AND** include userId, username, isAdmin flag, and createdAt timestamp
- **AND** return total user count

#### Scenario: Get specific user

- **WHEN** an admin requests /api/admin/users/user-123
- **THEN** the system SHALL return user details without password field
- **AND** return HTTP 404 if user not found

#### Scenario: Create user

- **WHEN** an admin POSTs to /api/admin/users with username, password, and isAdmin=false
- **THEN** the system SHALL validate username is unique
- **AND** hash the password with bcrypt (10 rounds)
- **AND** create the user account
- **AND** return HTTP 201 with sanitized user data
- **AND** return HTTP 409 if username already exists

#### Scenario: Update user

- **WHEN** an admin PATCHes /api/admin/users/user-123 with new username or password
- **THEN** the system SHALL update specified fields
- **AND** hash new password if provided
- **AND** return HTTP 200 with updated user
- **AND** return HTTP 404 if user not found

#### Scenario: Delete user

- **WHEN** an admin DELETEs /api/admin/users/user-123
- **THEN** the system SHALL verify admin is not deleting their own account
- **AND** delete the user record
- **AND** return HTTP 200 with success confirmation
- **AND** return HTTP 400 if admin attempts to delete themselves

### Requirement: Audit Log Queries

The system SHALL maintain comprehensive audit logs for compliance and troubleshooting.

#### Scenario: Get audit logs

- **WHEN** an admin requests /api/admin/audit-logs?limit=100&offset=0
- **THEN** the system SHALL return up to 100 audit log entries
- **AND** include userId, action, resource, timestamp, IP address, and details
- **AND** support pagination with offset parameter

#### Scenario: Get audit log statistics

- **WHEN** an admin requests /api/admin/audit-logs/stats
- **THEN** the system SHALL return total log count
- **AND** include logs by action type breakdown
- **AND** include logs by user breakdown

### Requirement: Cache Management

The system SHALL provide cache inspection and purging capabilities for both LLM and API caches.

#### Scenario: Get LLM cache statistics

- **WHEN** an admin requests /api/cache/llm/stats
- **THEN** the system SHALL return cache hit rate, total hits, total misses
- **AND** include cache size and entry count

#### Scenario: Clear entire LLM cache

- **WHEN** an admin POSTs to /api/cache/llm/clear
- **THEN** the system SHALL invalidate all cached LLM responses
- **AND** reset cache statistics
- **AND** return HTTP 200 with success confirmation

#### Scenario: Clear LLM cache for specific role

- **WHEN** an admin POSTs to /api/cache/llm/clear/technical_analyst
- **THEN** the system SHALL invalidate cached responses for technical_analyst role only
- **AND** preserve cache for other roles
- **AND** return HTTP 200

#### Scenario: Reset LLM cache statistics

- **WHEN** an admin POSTs to /api/cache/llm/reset-stats
- **THEN** the system SHALL reset hit/miss counters to zero
- **AND** preserve cached entries
- **AND** return HTTP 200

#### Scenario: Get API cache statistics

- **WHEN** an admin requests /api/cache/api?provider=finnhub
- **THEN** the system SHALL return cache statistics for finnhub provider
- **AND** include cache entries with keys, timestamps, and TTL
- **AND** return all providers if no filter specified

#### Scenario: Purge API cache

- **WHEN** an admin POSTs to /api/cache/api/purge with provider=finnhub, key=/quote/AAPL
- **THEN** the system SHALL invalidate the specific cache entry
- **AND** return purged entry count
- **AND** return HTTP 400 if neither provider nor expiredOnly specified

#### Scenario: Purge expired API cache entries

- **WHEN** an admin POSTs to /api/cache/api/purge with expiredOnly=true
- **THEN** the system SHALL delete all cache entries past their TTL
- **AND** return count of purged entries
- **AND** preserve valid cache entries

### Requirement: Settings Management

The system SHALL provide key-value settings storage with namespace isolation.

#### Scenario: List all settings

- **WHEN** an admin requests /api/admin/settings
- **THEN** the system SHALL return all settings across namespaces
- **AND** redact secret values (show **_REDACTED_** for isSecret=true)
- **AND** include namespace, key, value (or redacted), description, and updatedBy

#### Scenario: Get specific setting

- **WHEN** an admin requests /api/admin/settings/trading/max-position-size
- **THEN** the system SHALL return the setting for namespace=trading, key=max-position-size
- **AND** redact value if isSecret=true
- **AND** return HTTP 404 if setting not found

#### Scenario: Update setting

- **WHEN** an admin PUTs to /api/admin/settings/notifications/slack-webhook with value and description
- **THEN** the system SHALL upsert the setting in admin_settings table
- **AND** record updatedBy as current admin userId
- **AND** return HTTP 200 with sanitized setting

#### Scenario: Delete setting

- **WHEN** an admin DELETEs /api/admin/settings/deprecated/old-key
- **THEN** the system SHALL remove the setting from database
- **AND** return HTTP 200 with success confirmation
- **AND** return HTTP 404 if setting not found

### Requirement: Webhook CRUD Operations

The system SHALL allow webhook registration for event-driven integrations.

#### Scenario: List all webhooks

- **WHEN** an admin requests /api/webhooks
- **THEN** the system SHALL return all registered webhooks with redacted secrets
- **AND** include supported event types list
- **AND** redact secret and authorization headers

#### Scenario: Create webhook

- **WHEN** an admin POSTs to /api/webhooks with name, url, eventTypes, and secret
- **THEN** the system SHALL validate url starts with https:// in production
- **AND** generate unique webhook ID
- **AND** register webhook configuration
- **AND** return HTTP 201 with redacted webhook config
- **AND** return HTTP 400 if url is not HTTPS in production

#### Scenario: Get specific webhook

- **WHEN** an admin requests /api/webhooks/wh_123456
- **THEN** the system SHALL return webhook configuration with redacted secret
- **AND** return HTTP 404 if webhook not found

#### Scenario: Update webhook

- **WHEN** an admin PUTs to /api/webhooks/wh_123456 with enabled=false
- **THEN** the system SHALL update webhook configuration
- **AND** disable webhook event delivery
- **AND** return HTTP 200 with updated webhook
- **AND** return HTTP 404 if webhook not found

#### Scenario: Delete webhook

- **WHEN** an admin DELETEs /api/webhooks/wh_123456
- **THEN** the system SHALL unregister and remove the webhook
- **AND** return HTTP 200 with success confirmation
- **AND** return HTTP 404 if webhook not found

#### Scenario: Test webhook

- **WHEN** an admin POSTs to /api/webhooks/test with eventType=order.filled and payload
- **THEN** the system SHALL send test event to all matching webhooks
- **AND** return delivery results with status codes
- **AND** return count of attempted deliveries

#### Scenario: Get webhook statistics

- **WHEN** an admin requests /api/webhooks/stats/overview
- **THEN** the system SHALL return total webhooks, enabled webhooks count
- **AND** include recent delivery count and success rate (0-1)

#### Scenario: Get webhook delivery history

- **WHEN** an admin requests /api/webhooks/history/deliveries?limit=50
- **THEN** the system SHALL return up to 50 recent delivery attempts
- **AND** include webhookId, eventId, eventType, status, statusCode, error, and durationMs

### Requirement: Notification Channel Configuration

The system SHALL support multiple notification channels (Telegram, Slack, Discord, Email).

#### Scenario: List notification channels

- **WHEN** an admin requests /api/notifications/channels
- **THEN** the system SHALL return all registered channels with redacted credentials
- **AND** redact botToken, webhookUrl, and password fields

#### Scenario: Create notification channel

- **WHEN** an admin POSTs to /api/notifications/channels with type=slack, name, and config
- **THEN** the system SHALL validate type is in [telegram, slack, discord, email]
- **AND** generate unique channel ID
- **AND** register channel configuration
- **AND** return HTTP 201 with redacted config
- **AND** return HTTP 400 if type is invalid

#### Scenario: Get specific channel

- **WHEN** an admin requests /api/notifications/channels/ch_123456
- **THEN** the system SHALL return channel configuration with redacted credentials
- **AND** return HTTP 404 if channel not found

#### Scenario: Update channel

- **WHEN** an admin PUTs to /api/notifications/channels/ch_123456 with enabled=false
- **THEN** the system SHALL update channel configuration
- **AND** disable notification delivery for this channel
- **AND** return HTTP 200 with redacted updated channel
- **AND** return HTTP 404 if channel not found

#### Scenario: Delete channel

- **WHEN** an admin DELETEs /api/notifications/channels/ch_123456
- **THEN** the system SHALL unregister and remove the channel
- **AND** return HTTP 200 with success confirmation
- **AND** return HTTP 404 if channel not found

#### Scenario: Test channel

- **WHEN** an admin POSTs to /api/notifications/channels/ch_123456/test with optional message
- **THEN** the system SHALL send test notification to the channel
- **AND** return delivery result with status and any error
- **AND** return HTTP 404 if channel not found

#### Scenario: Create notification template

- **WHEN** an admin POSTs to /api/notifications/templates with name, eventType, channels array, and messageTemplate
- **THEN** the system SHALL generate unique template ID
- **AND** register template for event-driven notifications
- **AND** return HTTP 201 with template configuration

#### Scenario: Send notification by event

- **WHEN** an admin POSTs to /api/notifications/send with eventType and data
- **THEN** the system SHALL match enabled templates for the eventType
- **AND** render messageTemplate with provided data
- **AND** deliver notification to all template channels
- **AND** return delivery results count

#### Scenario: Get notification history

- **WHEN** an admin requests /api/notifications/history?limit=50
- **THEN** the system SHALL return up to 50 recent notification deliveries
- **AND** include channel, template, event, status, and timestamp

#### Scenario: Get notification statistics

- **WHEN** an admin requests /api/notifications/stats
- **THEN** the system SHALL return total channels, enabled channels count
- **AND** include notification delivery success rate
- **AND** return recent delivery count

### Requirement: RBAC Capability Checks

The system SHALL enforce role-based access control for admin operations.

#### Scenario: Get user RBAC context

- **WHEN** an admin requests /api/admin/rbac/me
- **THEN** the system SHALL return user's role (admin, trader, viewer)
- **AND** return capabilities array for the role
- **AND** include isAdmin flag

#### Scenario: Get all roles

- **WHEN** an admin requests /api/admin/rbac/roles
- **THEN** the system SHALL return all defined roles with capability mappings

#### Scenario: Check specific capability

- **WHEN** an admin requests /api/admin/rbac/check/admin:danger
- **THEN** the system SHALL evaluate if user's role grants admin:danger capability
- **AND** return allowed boolean
- **AND** include user's role in response

### Requirement: Orchestrator Control

The system SHALL provide start/stop/pause controls for the autonomous orchestrator.

#### Scenario: Get orchestrator status

- **WHEN** an admin requests /api/admin/orchestrator/status
- **THEN** the system SHALL return isRunning, lastCycleTime, cycleCount
- **AND** include risk limits configuration
- **AND** return timestamp of status query

#### Scenario: Pause orchestrator

- **WHEN** an admin POSTs to /api/admin/orchestrator/pause
- **THEN** the system SHALL stop the orchestrator with preserveAutoStart=true
- **AND** halt autonomous trading cycles
- **AND** return HTTP 200 with success message

#### Scenario: Resume orchestrator

- **WHEN** an admin POSTs to /api/admin/orchestrator/resume
- **THEN** the system SHALL start the orchestrator
- **AND** resume autonomous trading cycles
- **AND** return HTTP 200

#### Scenario: Trigger immediate run

- **WHEN** an admin POSTs to /api/admin/orchestrator/run-now
- **THEN** the system SHALL start the orchestrator immediately
- **AND** execute a trading cycle without waiting for schedule
- **AND** return HTTP 200

#### Scenario: Update orchestrator configuration

- **WHEN** an admin PUTs to /api/admin/orchestrator/config with riskLimits
- **THEN** the system SHALL update risk limits (maxPositionSize, maxDailyLoss, etc.)
- **AND** apply limits to future trading cycles
- **AND** return HTTP 200 with updated state

### Requirement: Work Items Management

The system SHALL manage background work items with retry and dead-letter handling.

#### Scenario: Get work items

- **WHEN** an admin requests /api/admin/work-items?status=FAILED&limit=50
- **THEN** the system SHALL return up to 50 FAILED work items
- **AND** include counts by status (PENDING, RUNNING, SUCCEEDED, FAILED, DEAD_LETTER)
- **AND** filter by status if provided
- **AND** filter by type if provided

#### Scenario: Retry work item

- **WHEN** an admin POSTs to /api/admin/work-items/retry with id
- **THEN** the system SHALL validate work item status is DEAD_LETTER or FAILED
- **AND** reset status to PENDING, attempts to 0, and nextRunAt to now
- **AND** clear lastError
- **AND** return HTTP 200
- **AND** return HTTP 400 if status is not DEAD_LETTER or FAILED

#### Scenario: Move to dead letter

- **WHEN** an admin POSTs to /api/admin/work-items/dead-letter with id and reason
- **THEN** the system SHALL update work item status to DEAD_LETTER
- **AND** set lastError to provided reason
- **AND** prevent further retry attempts
- **AND** return HTTP 200

#### Scenario: Get orchestrator health

- **WHEN** an admin requests /api/admin/orchestrator-health
- **THEN** the system SHALL return agent isRunning, killSwitchActive, lastHeartbeat
- **AND** include work queue depth by status
- **AND** include 5 most recent FAILED work items with error details

### Requirement: System Diagnostics

The system SHALL provide detailed diagnostics for troubleshooting and monitoring.

#### Scenario: Get observability metrics

- **WHEN** an admin requests /api/admin/observability/metrics
- **THEN** the system SHALL return Node.js memory usage (heapUsed, heapTotal in MB)
- **AND** include process uptime in hours
- **AND** include Node.js version
- **AND** return work queue statistics by status
- **AND** return activity metrics (logs last 24h)

#### Scenario: Get observability logs

- **WHEN** an admin requests /api/admin/observability/logs?limit=50&action=user.login
- **THEN** the system SHALL return up to 50 audit logs filtered by action
- **AND** support pagination with offset
- **AND** return logs without action filter if not specified

#### Scenario: Get API keys status

- **WHEN** an admin requests /api/admin/api-keys-status
- **THEN** the system SHALL return all API key configurations
- **AND** indicate which keys are configured (boolean, not actual values)
- **AND** indicate which keys are enabled via provider policy
- **AND** group by category (brokerage, market_data, crypto, news, data, ai)

#### Scenario: Get provider status

- **WHEN** an admin requests /api/admin/provider-status
- **THEN** the system SHALL return enabled status, budget status, and last call time for each provider
- **AND** include rate limit policy (maxRequestsPerMinute, maxRequestsPerDay, etc.)

#### Scenario: Force refresh provider

- **WHEN** an admin POSTs to /api/admin/provider/finnhub/force-refresh
- **THEN** the system SHALL invalidate all finnhub cache entries
- **AND** force next request to fetch fresh data
- **AND** return HTTP 200 with success message

#### Scenario: Force refresh Valyu with confirmation

- **WHEN** an admin POSTs to /api/admin/provider/valyu/force-refresh with confirmValyu=true
- **THEN** the system SHALL invalidate Valyu cache despite 1 call/week limit warning
- **AND** return HTTP 200
- **AND** return HTTP 400 if confirmValyu is not true

#### Scenario: Toggle provider enabled state

- **WHEN** an admin PATCHes /api/admin/provider/finnhub/toggle with enabled=false
- **THEN** the system SHALL update provider policy enabled flag
- **AND** prevent future API calls to finnhub
- **AND** return HTTP 200 with updated policy
- **AND** return HTTP 400 if enabled is not boolean

#### Scenario: Get connectors health

- **WHEN** an admin requests /api/admin/connectors-health
- **THEN** the system SHALL return health status for all connectors (Alpaca, Finnhub, CoinGecko, etc.)
- **AND** include hasApiKey, status (active/disabled/error), and healthDetails
- **AND** return summary counts (total, active, error, disabled)

#### Scenario: Get data fusion status

- **WHEN** an admin requests /api/admin/data-fusion-status
- **THEN** the system SHALL return intelligence score (0-1 based on active sources)
- **AND** include active sources count and total sources count
- **AND** list all data sources with active status
- **AND** return capabilities (marketData, newsAnalysis, sentimentAnalysis, tradingCapability, etc.)
- **AND** include last fusion run timestamp

#### Scenario: Verify Alpaca account configuration

- **WHEN** an admin requests /api/admin/alpaca-account
- **THEN** the system SHALL return trading mode (paper/live) and base URL
- **AND** return masked API key from running environment and .env file
- **AND** detect credential mismatch between environment and .env
- **AND** return account info (id, status, buying_power, portfolio_value, equity, cash)
- **AND** return connection status (connected/error)

#### Scenario: Get admin dashboard

- **WHEN** an admin requests /api/admin/dashboard
- **THEN** the system SHALL return provider stats (total, active)
- **AND** return model stats (total, enabled)
- **AND** return job stats (running, pending, failed)
- **AND** return kill switch status

#### Scenario: Global admin search

- **WHEN** an admin requests /api/admin/search?q=AAPL&limit=20
- **THEN** the system SHALL search across strategies, orders, positions, symbols, users, and audit logs
- **AND** return matching results by entity type
- **AND** include total results count
- **AND** return HTTP 400 if query is missing

#### Scenario: Get trace details

- **WHEN** an admin requests /api/admin/trace/trc-abc123
- **THEN** the system SHALL return related orders, strategies, work items, and audit logs for traceId
- **AND** enable correlation across system entities
- **AND** return timestamp of query

#### Scenario: Sync positions job

- **WHEN** an admin POSTs to /api/admin/jobs/sync-positions
- **THEN** the system SHALL fetch positions from Alpaca
- **AND** reconcile with local database
- **AND** return HTTP 200 with success message

### Requirement: Admin Token Authentication

The system SHALL support admin token authentication for CI/CD and headless operations.

#### Scenario: Authenticate with admin token

- **WHEN** a request includes X-Admin-Token header matching ADMIN_TOKEN environment variable
- **THEN** the system SHALL authenticate as admin user with full capabilities
- **AND** attach "admin-token-user" userId to request context
- **AND** grant access to all admin endpoints

#### Scenario: Invalid admin token

- **WHEN** a request includes incorrect X-Admin-Token header
- **THEN** the system SHALL reject with HTTP 401 Unauthorized
- **AND** not grant admin access

## Security

### Admin-Only Access

All endpoints prefixed with `/api/admin/` MUST enforce admin authentication via `requireAdmin` middleware.

The `requireAdmin` middleware SHALL:

- Verify user has valid session OR valid admin token
- Check user's `isAdmin` flag is true
- Reject with HTTP 401 if not authenticated
- Reject with HTTP 403 if authenticated but not admin

### Admin Token Configuration

Admin token authentication MUST:

- Read `ADMIN_TOKEN` from environment variables
- Compare using constant-time string comparison to prevent timing attacks
- Be optional (system works with session auth if admin token not configured)
- Override session authentication when provided

### Sensitive Data Redaction

Admin APIs MUST redact sensitive information:

- Webhook secrets → `***REDACTED***`
- Notification channel credentials (botToken, webhookUrl, password) → `***REDACTED***`
- Authorization headers → `***REDACTED***`
- User passwords → excluded from all responses
- API keys → show configured status only, not actual values
- Settings with `isSecret=true` → redact value

### Audit Logging

All admin operations MUST be logged to audit_logs table with:

- userId (or "admin-token-user")
- action (e.g., "admin.user.create", "admin.settings.update")
- resource (affected entity ID)
- timestamp
- IP address
- details (JSON metadata)

### Rate Limiting

The following admin endpoints SHOULD enforce rate limiting:

- `/api/admin/universe/refresh` - Prevents excessive Alpaca API calls
- `/api/admin/fundamentals/fetch` - Prevents excessive SEC EDGAR/Valyu calls
- `/api/admin/liquidity/compute` - Prevents excessive market data requests

## API Endpoints

### Health & Diagnostics

| Method | Path                             | Auth  | Description                               |
| ------ | -------------------------------- | ----- | ----------------------------------------- |
| GET    | /api/health/db                   | None  | Database health check                     |
| GET    | /api/admin/observability/health  | Admin | Comprehensive service health              |
| GET    | /api/admin/observability/metrics | Admin | System metrics (memory, uptime, queue)    |
| GET    | /api/admin/observability/logs    | Admin | Audit logs with pagination                |
| GET    | /api/admin/dashboard             | Admin | Admin dashboard statistics                |
| GET    | /api/admin/overview              | Admin | Admin overview with agent/queue/LLM stats |

### API Management

| Method | Path                                        | Auth  | Description                    |
| ------ | ------------------------------------------- | ----- | ------------------------------ |
| GET    | /api/admin/api-usage                        | Admin | API usage statistics           |
| GET    | /api/admin/api-cache                        | Admin | API cache statistics           |
| POST   | /api/admin/api-cache/purge                  | Admin | Purge API cache entries        |
| GET    | /api/admin/provider-status                  | Admin | Provider enabled/budget status |
| POST   | /api/admin/provider/:provider/force-refresh | Admin | Force refresh provider cache   |
| PATCH  | /api/admin/provider/:provider/toggle        | Admin | Enable/disable provider        |
| GET    | /api/admin/valyu-budget                     | Admin | Valyu budget status            |
| PUT    | /api/admin/valyu-budget                     | Admin | Update Valyu budget limits     |
| GET    | /api/admin/connectors-health                | Admin | Connector health status        |
| GET    | /api/admin/api-keys-status                  | Admin | API keys configuration status  |
| GET    | /api/admin/data-fusion-status               | Admin | Data fusion intelligence score |
| GET    | /api/admin/alpaca-account                   | Admin | Alpaca account verification    |

### AI Configuration

| Method | Path                                  | Auth  | Description                                            |
| ------ | ------------------------------------- | ----- | ------------------------------------------------------ |
| GET    | /api/admin/ai-config                  | Admin | AI configuration (autoExecuteTrades, conservativeMode) |
| PUT    | /api/admin/ai-config                  | Admin | Update AI configuration                                |
| GET    | /api/admin/model-router/configs       | Admin | Model router role configurations                       |
| PUT    | /api/admin/model-router/configs/:role | Admin | Update role configuration                              |
| GET    | /api/admin/model-router/calls         | Admin | Recent LLM calls                                       |
| GET    | /api/admin/model-router/stats         | Admin | LLM call statistics                                    |

### Module Registry

| Method | Path                          | Auth  | Description                 |
| ------ | ----------------------------- | ----- | --------------------------- |
| GET    | /api/admin/modules            | Admin | All admin modules           |
| GET    | /api/admin/modules/accessible | Admin | Accessible modules for user |
| GET    | /api/admin/modules/:id        | Admin | Specific module details     |

### RBAC

| Method | Path                              | Auth  | Description               |
| ------ | --------------------------------- | ----- | ------------------------- |
| GET    | /api/admin/rbac/me                | Admin | Current user RBAC context |
| GET    | /api/admin/rbac/roles             | Admin | All roles                 |
| GET    | /api/admin/rbac/check/:capability | Admin | Check capability          |

### Settings

| Method | Path                                | Auth  | Description          |
| ------ | ----------------------------------- | ----- | -------------------- |
| GET    | /api/admin/settings                 | Admin | List all settings    |
| GET    | /api/admin/settings/:namespace/:key | Admin | Get specific setting |
| PUT    | /api/admin/settings/:namespace/:key | Admin | Update setting       |
| DELETE | /api/admin/settings/:namespace/:key | Admin | Delete setting       |
| GET    | /api/settings                       | Auth  | User settings        |
| PUT    | /api/settings                       | Auth  | Update user settings |

### Orchestrator

| Method | Path                                | Auth  | Description                |
| ------ | ----------------------------------- | ----- | -------------------------- |
| GET    | /api/admin/orchestrator/status      | Admin | Orchestrator status        |
| POST   | /api/admin/orchestrator/pause       | Admin | Pause orchestrator         |
| POST   | /api/admin/orchestrator/resume      | Admin | Resume orchestrator        |
| POST   | /api/admin/orchestrator/run-now     | Admin | Trigger immediate run      |
| PUT    | /api/admin/orchestrator/config      | Admin | Update orchestrator config |
| POST   | /api/admin/orchestrator/reset-stats | Admin | Reset orchestrator stats   |
| GET    | /api/admin/orchestrator-health      | Admin | Orchestrator health        |

### Work Items

| Method | Path                              | Auth  | Description         |
| ------ | --------------------------------- | ----- | ------------------- |
| GET    | /api/admin/work-items             | Admin | Get work items      |
| POST   | /api/admin/work-items/retry       | Admin | Retry work item     |
| POST   | /api/admin/work-items/dead-letter | Admin | Move to dead letter |

### Jobs

| Method | Path                           | Auth  | Description    |
| ------ | ------------------------------ | ----- | -------------- |
| GET    | /api/admin/jobs/status         | Admin | Jobs status    |
| POST   | /api/admin/jobs/sync-positions | Admin | Sync positions |

### Search

| Method | Path                      | Auth  | Description       |
| ------ | ------------------------- | ----- | ----------------- |
| GET    | /api/admin/search         | Admin | Global search     |
| GET    | /api/admin/trace/:traceId | Admin | Get trace details |

### Trading Universe

| Method | Path                                | Auth  | Description         |
| ------ | ----------------------------------- | ----- | ------------------- |
| GET    | /api/admin/universe/stats           | Admin | Universe statistics |
| GET    | /api/admin/universe/assets          | Admin | Universe assets     |
| GET    | /api/admin/universe/assets/:symbol  | Admin | Asset details       |
| POST   | /api/admin/universe/refresh         | Admin | Refresh universe    |
| POST   | /api/admin/universe/exclude/:symbol | Admin | Exclude symbol      |
| GET    | /api/admin/universe/tradable        | Admin | Tradable symbols    |

### Liquidity

| Method | Path                                 | Auth  | Description               |
| ------ | ------------------------------------ | ----- | ------------------------- |
| GET    | /api/admin/liquidity/stats           | Admin | Liquidity statistics      |
| GET    | /api/admin/liquidity/metrics/:symbol | Admin | Symbol liquidity metrics  |
| GET    | /api/admin/liquidity/tier/:tier      | Admin | Symbols by tier           |
| GET    | /api/admin/liquidity/top             | Admin | Top liquid symbols        |
| POST   | /api/admin/liquidity/compute         | Admin | Compute liquidity metrics |

### Fundamentals

| Method | Path                               | Auth  | Description             |
| ------ | ---------------------------------- | ----- | ----------------------- |
| GET    | /api/admin/fundamentals/stats      | Admin | Fundamentals statistics |
| GET    | /api/admin/fundamentals/:symbol    | Admin | Symbol fundamentals     |
| GET    | /api/admin/fundamentals/top/scores | Admin | Top scoring symbols     |
| POST   | /api/admin/fundamentals/fetch      | Admin | Fetch fundamentals      |

### Candidates

| Method | Path                                    | Auth  | Description           |
| ------ | --------------------------------------- | ----- | --------------------- |
| GET    | /api/admin/candidates/stats             | Admin | Candidates statistics |
| GET    | /api/admin/candidates                   | Admin | Candidates list       |
| GET    | /api/admin/candidates/:symbol           | Admin | Specific candidate    |
| POST   | /api/admin/candidates/generate          | Admin | Generate candidates   |
| POST   | /api/admin/candidates/:symbol/approve   | Admin | Approve candidate     |
| POST   | /api/admin/candidates/:symbol/reject    | Admin | Reject candidate      |
| POST   | /api/admin/candidates/:symbol/watchlist | Admin | Add to watchlist      |
| GET    | /api/admin/candidates/approved/list     | Admin | Approved symbols      |

### Enforcement

| Method | Path                               | Auth  | Description               |
| ------ | ---------------------------------- | ----- | ------------------------- |
| GET    | /api/admin/enforcement/stats       | Admin | Enforcement statistics    |
| POST   | /api/admin/enforcement/check       | Admin | Check trading eligibility |
| POST   | /api/admin/enforcement/reset-stats | Admin | Reset enforcement stats   |

### Allocation

| Method | Path                                          | Auth  | Description           |
| ------ | --------------------------------------------- | ----- | --------------------- |
| GET    | /api/admin/allocation/stats                   | Admin | Allocation statistics |
| GET    | /api/admin/allocation/policies                | Admin | List policies         |
| GET    | /api/admin/allocation/policies/active         | Admin | Active policy         |
| GET    | /api/admin/allocation/policies/:id            | Admin | Policy by ID          |
| POST   | /api/admin/allocation/policies                | Admin | Create policy         |
| PATCH  | /api/admin/allocation/policies/:id            | Admin | Update policy         |
| POST   | /api/admin/allocation/policies/:id/activate   | Admin | Activate policy       |
| POST   | /api/admin/allocation/policies/:id/deactivate | Admin | Deactivate policy     |
| POST   | /api/admin/allocation/analyze                 | Admin | Analyze rebalance     |
| GET    | /api/admin/allocation/runs                    | Admin | Rebalance runs        |
| GET    | /api/admin/allocation/runs/:id                | Admin | Rebalance run by ID   |

### Rebalancer

| Method | Path                                        | Auth  | Description           |
| ------ | ------------------------------------------- | ----- | --------------------- |
| GET    | /api/admin/rebalancer/stats                 | Admin | Rebalancer statistics |
| POST   | /api/admin/rebalancer/dry-run               | Admin | Execute dry run       |
| POST   | /api/admin/rebalancer/execute               | Admin | Execute rebalance     |
| POST   | /api/admin/rebalancer/profit-taking/analyze | Admin | Analyze profit-taking |

### User Management

| Method | Path                 | Auth  | Description   |
| ------ | -------------------- | ----- | ------------- |
| GET    | /api/admin/users     | Admin | All users     |
| GET    | /api/admin/users/:id | Admin | Specific user |
| POST   | /api/admin/users     | Admin | Create user   |
| PATCH  | /api/admin/users/:id | Admin | Update user   |
| DELETE | /api/admin/users/:id | Admin | Delete user   |

### Audit Logs

| Method | Path                        | Auth  | Description          |
| ------ | --------------------------- | ----- | -------------------- |
| GET    | /api/admin/audit-logs       | Admin | Audit logs           |
| GET    | /api/admin/audit-logs/stats | Admin | Audit log statistics |

### Cache Management

| Method | Path                       | Auth | Description                |
| ------ | -------------------------- | ---- | -------------------------- |
| GET    | /api/cache/llm/stats       | Auth | LLM cache statistics       |
| POST   | /api/cache/llm/clear       | Auth | Clear entire LLM cache     |
| POST   | /api/cache/llm/clear/:role | Auth | Clear LLM cache for role   |
| POST   | /api/cache/llm/reset-stats | Auth | Reset LLM cache statistics |
| GET    | /api/cache/api             | Auth | API cache statistics       |
| POST   | /api/cache/api/purge       | Auth | Purge API cache            |

### Webhooks

| Method | Path                             | Auth | Description        |
| ------ | -------------------------------- | ---- | ------------------ |
| GET    | /api/webhooks                    | None | List all webhooks  |
| POST   | /api/webhooks                    | None | Create webhook     |
| GET    | /api/webhooks/:id                | None | Get webhook        |
| PUT    | /api/webhooks/:id                | None | Update webhook     |
| DELETE | /api/webhooks/:id                | None | Delete webhook     |
| POST   | /api/webhooks/test               | Auth | Test webhook       |
| GET    | /api/webhooks/stats/overview     | None | Webhook statistics |
| GET    | /api/webhooks/history/deliveries | None | Delivery history   |

### Notifications

| Method | Path                                 | Auth | Description             |
| ------ | ------------------------------------ | ---- | ----------------------- |
| GET    | /api/notifications/channels          | None | List channels           |
| POST   | /api/notifications/channels          | None | Create channel          |
| GET    | /api/notifications/channels/:id      | None | Get channel             |
| PUT    | /api/notifications/channels/:id      | None | Update channel          |
| DELETE | /api/notifications/channels/:id      | None | Delete channel          |
| POST   | /api/notifications/channels/:id/test | Auth | Test channel            |
| GET    | /api/notifications/templates         | None | List templates          |
| POST   | /api/notifications/templates         | None | Create template         |
| PUT    | /api/notifications/templates/:id     | None | Update template         |
| DELETE | /api/notifications/templates/:id     | None | Delete template         |
| POST   | /api/notifications/send              | Auth | Send notification       |
| GET    | /api/notifications/history           | None | Notification history    |
| GET    | /api/notifications/stats             | None | Notification statistics |

## Error Handling

All admin endpoints MUST use standardized error responses:

**400 Bad Request**: Invalid request format or validation errors
**401 Unauthorized**: Missing or invalid authentication
**403 Forbidden**: Authenticated but insufficient permissions
**404 Not Found**: Resource not found
**409 Conflict**: Resource conflict (e.g., duplicate username)
**429 Too Many Requests**: Rate limit exceeded
**500 Internal Server Error**: Unexpected server error
**503 Service Unavailable**: Service health check failed

Error response format:

```json
{
  "error": "Human-readable error message",
  "statusCode": 400,
  "details": { "field": "value" }
}
```

## Database Schema

### admin_settings table

- `id` (varchar, primary key) - Setting identifier
- `namespace` (varchar, not null) - Setting namespace
- `key` (varchar, not null) - Setting key
- `value` (text, not null) - Setting value (JSON-encoded)
- `description` (text, nullable) - Human-readable description
- `is_secret` (boolean, default false) - Whether to redact value in responses
- `updated_by` (varchar, nullable) - User ID who last updated
- `created_at` (timestamp, not null)
- `updated_at` (timestamp, not null)
- UNIQUE constraint on (namespace, key)

### broker_assets table

- `id` (varchar, primary key)
- `symbol` (varchar, unique, not null)
- `name` (varchar, not null)
- `asset_class` (varchar, not null) - us_equity, crypto
- `exchange` (varchar, nullable)
- `tradable` (boolean, default true)
- `excluded` (boolean, default false)
- `exclusion_reason` (text, nullable)
- `updated_at` (timestamp, not null)

### liquidity_metrics table

- `id` (varchar, primary key)
- `symbol` (varchar, unique, not null)
- `tier` (varchar, not null) - A, B, C, D
- `average_volume` (numeric, nullable)
- `average_spread` (numeric, nullable)
- `liquidity_score` (numeric, not null)
- `updated_at` (timestamp, not null)

### universe_fundamentals table

- `id` (varchar, primary key)
- `symbol` (varchar, unique, not null)
- `market_cap` (numeric, nullable)
- `pe_ratio` (numeric, nullable)
- `revenue_growth` (numeric, nullable)
- `fundamental_score` (numeric, not null)
- `data_source` (varchar, nullable)
- `updated_at` (timestamp, not null)

### universe_candidates table

- `id` (varchar, primary key)
- `symbol` (varchar, unique, not null)
- `status` (varchar, not null) - NEW, WATCHLIST, APPROVED, REJECTED
- `liquidity_tier` (varchar, nullable)
- `fundamental_score` (numeric, nullable)
- `approved_by` (varchar, nullable)
- `created_at` (timestamp, not null)
- `updated_at` (timestamp, not null)

### allocation_policies table

- `id` (varchar, primary key)
- `name` (varchar, not null)
- `strategy` (varchar, not null) - equal_weight, risk_parity, etc.
- `is_active` (boolean, default false)
- `config` (jsonb, not null) - Policy configuration
- `created_by` (varchar, nullable)
- `created_at` (timestamp, not null)
- `updated_at` (timestamp, not null)

### rebalance_runs table

- `id` (varchar, primary key)
- `policy_id` (varchar, foreign key → allocation_policies.id)
- `status` (varchar, not null) - pending, completed, failed
- `dry_run` (boolean, default false)
- `result` (jsonb, nullable) - Rebalance results
- `executed_at` (timestamp, not null)

## Dependencies

- `express` - Web framework
- `bcrypt` - Password hashing
- `drizzle-orm` - Database ORM
- Pino - Structured logging
- Custom middleware: `requireAuth`, `requireAdmin`

## Files

**Admin Routes**:

- `server/routes/admin/index.ts` - Main admin router
- `server/routes/admin/api.ts` - API management
- `server/routes/admin/ai.ts` - AI configuration
- `server/routes/admin/system.ts` - System management
- `server/routes/admin/trading.ts` - Trading universe
- `server/routes/admin/management.ts` - User/audit management

**Supporting Routes**:

- `server/routes/health.ts` - Health checks
- `server/routes/cache.ts` - Cache management
- `server/routes/settings.ts` - User settings
- `server/routes/webhooks.ts` - Webhook CRUD
- `server/routes/notifications.ts` - Notification channels

**Services**:

- `server/admin/registry.ts` - Module registry
- `server/admin/rbac.ts` - Role-based access control
- `server/admin/settings.ts` - Settings storage
- `server/admin/global-search.ts` - Cross-entity search
- `server/universe/` - Trading universe services

**Middleware**:

- `server/middleware/requireAuth.ts` - Authentication middleware
- `server/middleware/audit-logger.ts` - Audit logging

**Schema**:

- `shared/schema/admin.ts` - Admin types
- `shared/schema/universe.ts` - Universe types
