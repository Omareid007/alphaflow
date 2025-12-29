# Feature Specification: Email Notifications

## Overview

| Attribute | Value |
|-----------|-------|
| Feature ID | F-001 |
| Priority | P1 |
| Estimated Effort | Medium (1 week) |
| Status | NOT IMPLEMENTED |

## Problem Statement

Users cannot receive email notifications for important trading events. The settings UI exists and allows configuration, but the backend (`notification-service.ts:194`) explicitly skips email delivery with "Email notifications not yet implemented".

## User Stories

### US-1: Trade Execution Notifications
**As a** trader
**I want to** receive email notifications when trades execute
**So that** I stay informed about my portfolio activity even when not actively monitoring

### US-2: Price Alert Notifications
**As a** trader
**I want to** receive email alerts when positions hit price thresholds
**So that** I can take action on significant price movements

### US-3: Daily Summary Email
**As a** trader
**I want to** receive a daily portfolio summary email
**So that** I can review my performance without logging in

### US-4: System Alert Notifications
**As an** admin
**I want to** receive email alerts for system issues
**So that** I can respond to problems quickly

## Acceptance Criteria

### Functional Requirements

```gherkin
Feature: Email Notifications

  Background:
    Given I am a registered user
    And I have configured email notifications in settings

  Scenario: Trade execution email
    Given I have enabled trade notifications
    When a trade executes in my account
    Then I should receive an email within 1 minute
    And the email should contain trade details (symbol, qty, price, P&L)

  Scenario: Price alert email
    Given I have set a price alert for AAPL at $180
    When AAPL crosses $180
    Then I should receive an alert email
    And the email should contain current price and alert threshold

  Scenario: Daily summary
    Given I have enabled daily summary emails
    When it is 6:00 PM in my timezone
    Then I should receive a summary email
    And it should contain today's P&L, positions, and notable events

  Scenario: Email delivery failure
    Given email service is unavailable
    When a notification is triggered
    Then the system should retry 3 times
    And log the failure for investigation
```

### Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Delivery latency | < 60 seconds |
| Delivery success rate | > 99% |
| Email open rate tracking | Yes |
| Unsubscribe rate | < 2% |
| Mobile-friendly design | Required |

## Technical Design

### Email Service Provider Options

| Provider | Pros | Cons | Cost |
|----------|------|------|------|
| **SendGrid** (Recommended) | Reliable, good API | Complexity | $20/month |
| AWS SES | Cheap, scalable | Setup complexity | ~$0.10/1000 |
| Resend | Simple API, modern | Newer service | $20/month |

### Data Model

```typescript
// Add to shared/schema.ts

export const emailPreferences = pgTable('email_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  tradeNotifications: boolean('trade_notifications').default(true),
  priceAlerts: boolean('price_alerts').default(true),
  dailySummary: boolean('daily_summary').default(true),
  systemAlerts: boolean('system_alerts').default(false),
  timezone: text('timezone').default('America/New_York'),
  email: text('email').notNull(),
  verified: boolean('verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const emailHistory = pgTable('email_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // 'trade' | 'alert' | 'summary' | 'system'
  subject: text('subject').notNull(),
  status: text('status').notNull(), // 'sent' | 'failed' | 'bounced'
  providerId: text('provider_id'), // SendGrid message ID
  sentAt: timestamp('sent_at').defaultNow(),
  openedAt: timestamp('opened_at'),
});
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/notifications/preferences | Get email preferences |
| PUT | /api/notifications/preferences | Update preferences |
| POST | /api/notifications/verify | Verify email address |
| GET | /api/notifications/history | Get notification history |
| POST | /api/notifications/test | Send test email |

### Email Service Implementation

```typescript
// server/services/email-service.ts

import sgMail from '@sendgrid/mail';

interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export class EmailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  }

  async send(options: EmailOptions): Promise<boolean> {
    const msg = {
      to: options.to,
      from: 'notifications@alphaflow.app',
      subject: options.subject,
      templateId: this.getTemplateId(options.template),
      dynamicTemplateData: options.data,
    };

    try {
      await sgMail.send(msg);
      return true;
    } catch (error) {
      await this.logFailure(options, error);
      return false;
    }
  }

  private getTemplateId(template: string): string {
    const templates: Record<string, string> = {
      trade: 'd-xxxxx',
      alert: 'd-xxxxx',
      summary: 'd-xxxxx',
      system: 'd-xxxxx',
    };
    return templates[template];
  }
}
```

### Email Templates

#### Trade Notification
```html
Subject: [AlphaFlow] Trade Executed: {{action}} {{qty}} {{symbol}}

Your trade has been executed:

Symbol: {{symbol}}
Action: {{action}}
Quantity: {{qty}}
Price: ${{price}}
Total: ${{total}}
Strategy: {{strategy}}
Time: {{time}}

View in Portfolio: {{portfolioLink}}
```

#### Daily Summary
```html
Subject: [AlphaFlow] Daily Summary - {{date}}

Today's Performance:
- P&L: {{dayPnl}} ({{dayPnlPercent}}%)
- Portfolio Value: ${{equity}}
- Trades: {{tradeCount}}

Top Performers:
{{#each topGainers}}
- {{symbol}}: +{{gain}}%
{{/each}}

Biggest Losers:
{{#each topLosers}}
- {{symbol}}: {{loss}}%
{{/each}}

View Full Report: {{reportLink}}
```

## Implementation Plan

### Phase 1: Infrastructure (Day 1-2)
- [ ] Set up SendGrid account
- [ ] Create database tables
- [ ] Implement EmailService class
- [ ] Create API endpoints

### Phase 2: Templates (Day 3)
- [ ] Design email templates
- [ ] Create SendGrid dynamic templates
- [ ] Test template rendering

### Phase 3: Integration (Day 4-5)
- [ ] Connect to notification-service.ts
- [ ] Implement trade event triggers
- [ ] Implement price alert triggers
- [ ] Implement daily summary scheduler

### Phase 4: Testing (Day 6-7)
- [ ] Unit tests for EmailService
- [ ] Integration tests for triggers
- [ ] Manual testing with test accounts
- [ ] Monitor delivery rates

## Dependencies

- SendGrid API key (environment variable)
- Email templates in SendGrid
- User email verification flow
- Timezone handling for daily summary

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Deliverability issues | Medium | High | Use verified domain, monitor reputation |
| Rate limits | Low | Medium | Implement queuing, batch sends |
| Template errors | Low | Medium | Preview testing, sandbox mode |

## Success Metrics

| Metric | Target |
|--------|--------|
| Delivery rate | > 99% |
| Open rate | > 30% |
| Click rate | > 5% |
| Unsubscribe rate | < 2% |
| Support tickets | < 1/week |

## Definition of Done

- [ ] SendGrid integration complete
- [ ] All 4 email types implemented
- [ ] Email preferences UI working
- [ ] Email verification flow working
- [ ] Daily summary scheduler running
- [ ] Unit tests > 80% coverage
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Deployed to production
