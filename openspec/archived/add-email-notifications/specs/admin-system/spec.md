# Admin & System Spec Deltas

## ADDED Requirements

### Requirement: Email Notification Channel Configuration

The system SHALL support email as a notification channel for trade alerts and system events.

#### Scenario: Send email notification

- **WHEN** a notification is triggered for a user with email enabled
- **THEN** the system SHALL send an email via SendGrid
- **AND** include event details (order fill, loss alert, circuit breaker)
- **AND** log the email delivery attempt
- **AND** return success/failure status

#### Scenario: Email delivery failure

- **WHEN** SendGrid API returns error during email send
- **THEN** the system SHALL log the failure with error details
- **AND** retry up to 3 times with exponential backoff (1s, 2s, 4s)
- **AND** mark notification as failed after 3 attempts

#### Scenario: Email template rendering

- **WHEN** rendering an email notification
- **THEN** the system SHALL use the appropriate template (order_fill, large_loss, circuit_breaker, daily_summary, weekly_report)
- **AND** inject dynamic data (symbol, price, quantity, P&L)
- **AND** render mobile-responsive HTML

### Requirement: Notification Preference Management

Users SHALL be able to configure which notifications trigger email delivery.

#### Scenario: Get notification preferences

- **WHEN** an authenticated user requests /api/notifications/preferences
- **THEN** the system SHALL return current email notification settings
- **AND** include toggles for each notification type
- **AND** return HTTP 200

#### Scenario: Update notification preferences

- **WHEN** an authenticated user updates preferences via PUT /api/notifications/preferences
- **THEN** the system SHALL validate the preference structure
- **AND** update user's email notification settings
- **AND** return HTTP 200 with updated preferences

#### Scenario: Default preferences for new users

- **WHEN** a new user registers
- **THEN** the system SHALL create default notification preferences
- **AND** enable order_fill and circuit_breaker emails by default
- **AND** disable daily_summary and weekly_report by default

### Requirement: Email Notification Types

The system SHALL support five distinct email notification types.

#### Scenario: Order fill notification

- **WHEN** an order is filled
- **THEN** the system SHALL send email with order details (symbol, side, quantity, price, timestamp)
- **IF** user has order_fill preference enabled

#### Scenario: Large loss notification

- **WHEN** a position has >5% unrealized loss
- **THEN** the system SHALL send email alert with position details
- **IF** user has large_loss preference enabled

#### Scenario: Circuit breaker notification

- **WHEN** trading circuit breaker is triggered
- **THEN** the system SHALL send email alert to all users
- **REGARDLESS** of preference (critical system event)

#### Scenario: Daily portfolio summary

- **WHEN** end of trading day (4:30 PM ET)
- **THEN** the system SHALL send email with portfolio summary (equity, positions, P&L)
- **IF** user has daily_summary preference enabled

#### Scenario: Weekly performance report

- **WHEN** end of trading week (Friday 5 PM ET)
- **THEN** the system SHALL send email with weekly performance metrics
- **IF** user has weekly_report preference enabled

## API Endpoints

| Method | Path                           | Auth Required | Description                           |
| ------ | ------------------------------ | ------------- | ------------------------------------- |
| GET    | /api/notifications/preferences | Yes           | Get email notification preferences    |
| PUT    | /api/notifications/preferences | Yes           | Update email notification preferences |
| POST   | /api/notifications/test-email  | Yes           | Send test email (dev/testing only)    |

## Database Schema

### notification_preferences table - NEW

- `id` (varchar, primary key) - Preference ID
- `user_id` (varchar, foreign key → users.id) - User ID
- `order_fill_enabled` (boolean, default true) - Order fill emails
- `large_loss_enabled` (boolean, default true) - Large loss emails
- `circuit_breaker_enabled` (boolean, default true) - Circuit breaker emails
- `daily_summary_enabled` (boolean, default false) - Daily summary emails
- `weekly_report_enabled` (boolean, default false) - Weekly report emails
- `created_at` (timestamp, not null) - Preference creation
- `updated_at` (timestamp, not null) - Last update

### notification_log table - NEW

- `id` (varchar, primary key) - Log entry ID
- `user_id` (varchar, foreign key → users.id) - Recipient user
- `notification_type` (varchar, not null) - Type of notification
- `channel` (varchar, not null) - Delivery channel (email, slack, in-app)
- `status` (varchar, not null) - Delivery status (sent, failed, pending)
- `error_message` (text, nullable) - Error details if failed
- `sent_at` (timestamp, nullable) - Successful delivery time
- `created_at` (timestamp, not null) - Log creation

## Email Templates

Templates SHALL be stored in `server/templates/emails/`:

1. `order-fill.html` - Order execution confirmation
2. `large-loss.html` - Position loss alert
3. `circuit-breaker.html` - Trading suspension alert
4. `daily-summary.html` - End-of-day portfolio summary
5. `weekly-report.html` - Weekly performance report

All templates MUST:

- Be mobile-responsive (viewport meta tag)
- Include unsubscribe link
- Use inline CSS for email client compatibility
- Include AlphaFlow branding
- Sanitize all dynamic content to prevent XSS

## Configuration

Environment variables required:

- `SENDGRID_API_KEY` (required) - SendGrid API key
- `SENDGRID_FROM_EMAIL` (required) - Sender email address
- `SENDGRID_FROM_NAME` (optional, default: "AlphaFlow Trading")

## Error Handling

Email notification failures SHALL be handled gracefully:

- **429 Rate Limit**: Retry after delay indicated by SendGrid
- **401 Unauthorized**: Log critical error, alert admin
- **400 Bad Request**: Log validation error, skip retry
- **500 Server Error**: Retry with exponential backoff
- **Network Timeout**: Retry up to 3 times

All errors SHALL be logged with:

- User ID
- Notification type
- Error message
- Timestamp
- Retry attempt number

## Dependencies

- `@sendgrid/mail` (existing) - Email delivery
- `server/lib/email-service.ts` (existing) - Email wrapper
- `server/lib/notification-service.ts` (existing) - Notification orchestration

## Security

- Email content MUST be sanitized before rendering
- User emails MUST not be exposed in logs (redacted)
- Unsubscribe tokens MUST be cryptographically secure
- Email delivery logs MUST be retained for 90 days for audit
