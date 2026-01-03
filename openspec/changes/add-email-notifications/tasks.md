# Implementation Tasks

## 1. Database Migration

- [x] 1.1 Create migration script `migrations/0006_make_email_required.sql`
- [x] 1.2 Add query to identify users with null emails
- [x] 1.3 Add backfill logic for test users (set to admin email)
- [x] 1.4 Test migration on dev database
- [x] 1.5 Create rollback script

## 2. Schema Updates

- [x] 2.1 Update `shared/schema/auth.ts` - Change email from `varchar().nullable()` to `varchar().notNull()`
- [x] 2.2 Add email validation schema in `server/validation/api-schemas.ts`
- [x] 2.3 Update TypeScript types for User interface

## 3. Authentication Updates

- [x] 3.1 Update `server/routes/auth.ts` - Add email validation to registration
- [x] 3.2 Update registration endpoint to require email
- [x] 3.3 Add email format validation (RFC 5322)
- [x] 3.4 Update login response to include email
- [x] 3.5 Update existing tests in `tests/server/routes/auth.test.ts`

## 4. Email Service Enhancement

- [x] 4.1 Add `sendTradeAlert()` method to `server/lib/email-service.ts`
- [x] 4.2 Create email template for order fills
- [x] 4.3 Create email template for large losses
- [x] 4.4 Create email template for circuit breaker
- [x] 4.5 Create email template for daily summary
- [x] 4.6 Create email template for weekly report
- [ ] 4.7 Add email template testing

## 5. Notification Service Integration

- [x] 5.1 Update `server/lib/notification-service.ts` - Replace email stub with real implementation
- [x] 5.2 Add email channel to `sendNotification()` method
- [ ] 5.3 Implement retry logic for failed deliveries
- [x] 5.4 Add email delivery logging
- [ ] 5.5 Update tests in `tests/server/lib/notification-service.test.ts`

## 6. User Preferences

- [x] 6.1 Create `notification_preferences` table in schema
- [x] 6.2 Add default preferences for new users
- [x] 6.3 Create `GET /api/notifications/preferences` endpoint
- [x] 6.4 Create `PUT /api/notifications/preferences` endpoint
- [x] 6.5 Add frontend UI for email notification toggles

## 7. Testing

- [ ] 7.1 Unit tests for email validation
- [ ] 7.2 Integration tests for email sending
- [ ] 7.3 Test all 5 email templates
- [ ] 7.4 Test email preference updates
- [ ] 7.5 Test migration script on staging
- [ ] 7.6 Load test email delivery (100 concurrent notifications)

## 8. Documentation

- [ ] 8.1 Update API documentation for registration endpoint
- [ ] 8.2 Document new notification preference endpoints
- [ ] 8.3 Add email template customization guide
- [ ] 8.4 Update `.env.example` with SendGrid variables
- [ ] 8.5 Document migration procedure

## 9. Deployment

- [ ] 9.1 Review and approve spec changes
- [ ] 9.2 Run migration on staging
- [ ] 9.3 Verify no null emails in staging
- [ ] 9.4 Deploy to production
- [ ] 9.5 Run migration on production
- [ ] 9.6 Monitor email delivery for 24 hours
- [ ] 9.7 Archive change proposal

## 10. Rollback Plan

- [ ] 10.1 Document rollback procedure
- [ ] 10.2 Test rollback script on dev
- [ ] 10.3 Prepare hotfix branch for emergency rollback
