# Change: Add Email Notifications for Trade Execution

## Why

Users need real-time email notifications for critical trading events (order fills, large losses, circuit breaker triggers) to stay informed even when not actively monitoring the platform. Currently, notifications are limited to in-app alerts and optional Slack integration, leaving email as a highly requested missing channel.

## What Changes

- Add email as required field during user registration
- Extend notification service to support email channel via SendGrid
- Create email templates for 5 core trade notification types:
  - Order filled (buy/sell execution confirmation)
  - Large position loss (>5% unrealized loss alert)
  - Circuit breaker triggered (trading suspended alert)
  - Daily portfolio summary
  - Weekly performance report
- Add user preference toggles for email notification types
- **BREAKING**: Email field becomes required in users table (migration required)

## Impact

### Affected Specifications

- `authentication` - Email becomes required field during registration
- `admin-system` - Notification channel configuration adds email support

### Affected Code

- `shared/schema/auth.ts` - Update users table schema (email: nullable → not null)
- `server/lib/notification-service.ts` - Add email channel implementation
- `server/lib/email-service.ts` - New email templates for trade alerts
- `server/routes/notifications.ts` - Add email preference endpoints
- `server/routes/auth.ts` - Validate email format during registration
- Database migration required for existing users (backfill email or set default)

### Breaking Changes

- **BREAKING**: Existing API consumers must provide email during registration
- Migration script required: `migrations/0006_make_email_required.sql`

### Non-breaking Additions

- New endpoints: `GET /api/notifications/preferences`, `PUT /api/notifications/preferences`
- New email templates in `server/templates/emails/`

## Dependencies

- `@sendgrid/mail` - Already installed
- `SENDGRID_API_KEY` - Already configured
- `SENDGRID_FROM_EMAIL` - Already configured

## Risk Assessment

**Risk**: Medium

- Database migration may fail if existing users have null emails
- Email delivery depends on SendGrid availability (third-party SLA)

**Mitigation**:

- Pre-migration validation: Check for users with null emails
- Provide migration script to prompt affected users for email
- Implement retry queue for failed email deliveries
- Add email delivery logging for audit trail

## Timeline Estimate

- Implementation: 2-3 days
- Testing: 1 day
- Migration: 0.5 day (with rollback plan)
- Total: 3.5-4.5 days

## Success Criteria

- [ ] Email field is required in users table
- [ ] Registration requires valid email address
- [ ] Email notifications sent for order fills
- [ ] Email notifications sent for large losses
- [ ] Email notifications sent for circuit breaker events
- [ ] User can configure email notification preferences
- [ ] Email templates are mobile-responsive
- [ ] Email delivery rate >95%
- [ ] All existing users have emails (post-migration)
- [ ] Rollback tested and documented
