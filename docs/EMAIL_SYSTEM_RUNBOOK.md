# Email System Runbook

**Version**: 1.0
**Last Updated**: 2026-01-03
**Owner**: Platform Engineering Team

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Monitoring & Dashboards](#monitoring--dashboards)
3. [Rate Limiting](#rate-limiting)
4. [Emergency Procedures](#emergency-procedures)
5. [Rollback Procedures](#rollback-procedures)
6. [Troubleshooting](#troubleshooting)
7. [Provider Configuration](#provider-configuration)

---

## 🏗️ Architecture Overview

### Components

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│ Trading     │─────▶│ Bull Queue   │─────▶│ Email       │
│ Flow        │ async│ (Redis)      │ retry│ Provider    │
└─────────────┘      └──────────────┘      └─────────────┘
     <5ms                Background            SendGrid
                         Processing            or Brevo
```

### Key Features

- **Asynchronous Processing**: Trading operations never wait for email delivery
- **Automatic Retry**: 3 attempts with exponential backoff (1min → 5min → 15min)
- **Multi-Provider Failover**: SendGrid (priority 1) → Brevo (priority 2)
- **Rate Limiting**: 10/hour, 50/day per user; 300/day global
- **Admin Controls**: Pause, resume, retry, cleanup via API

### Technology Stack

- **Queue**: Bull 4.x
- **Backend**: Redis 5.x+
- **Providers**: SendGrid, Brevo (REST APIs)
- **Monitoring**: Admin dashboard endpoints

---

## 📊 Monitoring & Dashboards

### Admin Endpoints

All endpoints require admin authentication (`requireAdmin` middleware).

| Endpoint                                     | Method | Purpose           | Response                                                  |
| -------------------------------------------- | ------ | ----------------- | --------------------------------------------------------- |
| `/api/admin/email-queue/status`              | GET    | Queue statistics  | `{ waiting, active, completed, failed, delayed, paused }` |
| `/api/admin/email-queue/failed?limit=20`     | GET    | List failed jobs  | `{ jobs: [...], count: N }`                               |
| `/api/admin/email-queue/rate-limits/:userId` | GET    | Rate limit status | `{ hourly, daily, global }`                               |
| `/api/admin/email-queue/retry/:jobId`        | POST   | Retry failed job  | `{ success, message }`                                    |
| `/api/admin/email-queue/pause`               | POST   | Emergency stop    | `{ success, message }`                                    |
| `/api/admin/email-queue/resume`              | POST   | Resume processing | `{ success, message }`                                    |
| `/api/admin/email-queue/clean`               | POST   | Cleanup old jobs  | `{ success, cleaned }`                                    |

### Example: Check Queue Status

```bash
curl -X GET http://localhost:5000/api/admin/email-queue/status \
  -H "Cookie: session=<admin-session-cookie>" | jq

{
  "success": true,
  "data": {
    "waiting": 5,      # Queued, not yet processed
    "active": 2,       # Currently sending
    "completed": 150,  # Successfully delivered
    "failed": 3,       # Failed after 3 retries
    "delayed": 1,      # Scheduled for retry
    "paused": false    # Queue operational
  }
}
```

### Example: Check Rate Limits

```bash
curl -X GET http://localhost:5000/api/admin/email-queue/rate-limits/user-123 \
  -H "Cookie: session=<admin-session-cookie>" | jq

{
  "success": true,
  "data": {
    "userId": "user-123",
    "hourly": { "current": 3, "limit": 10, "remaining": 7 },
    "daily": { "current": 12, "limit": 50, "remaining": 38 },
    "global": { "current": 145, "limit": 300, "remaining": 155 }
  }
}
```

### Key Metrics to Monitor

| Metric                 | Threshold     | Action                        |
| ---------------------- | ------------- | ----------------------------- |
| **Failed rate**        | > 5%          | Investigate provider issues   |
| **Global daily usage** | > 250/300     | Upgrade to paid plan          |
| **Queue backlog**      | > 100 waiting | Check Redis/worker health     |
| **Delayed jobs**       | > 20          | Provider rate limiting active |

---

## ⚡ Rate Limiting

### Limits Configuration

| Limit Type      | Value      | Scope                           |
| --------------- | ---------- | ------------------------------- |
| Hourly per user | 10 emails  | Individual user                 |
| Daily per user  | 50 emails  | Individual user                 |
| Daily global    | 300 emails | Entire system (Brevo free tier) |

### Rate Limit Keys (Redis)

```
email:rate:{userId}:{YYYY-MM-DD-HH}   # Hourly counter, TTL: 1 hour
email:rate:{userId}:{YYYY-MM-DD}      # Daily counter, TTL: 24 hours
email:rate:global:{YYYY-MM-DD}        # Global counter, TTL: 24 hours
```

### Bypass Rate Limits

For critical system emails (circuit breaker, security alerts):

```typescript
await queueEmail({
  to: user.email,
  subject: "Critical Alert",
  text: "...",
  html: "...",
  userId: user.id,
  bypassRateLimit: true, // Admin override
});
```

### Reset Rate Limits (Emergency)

```bash
# Reset for specific user
redis-cli DEL "email:rate:user-123:2026-01-03"
redis-cli DEL "email:rate:user-123:2026-01-03-14"

# Reset global limit
redis-cli DEL "email:rate:global:2026-01-03"
```

---

## 🚨 Emergency Procedures

### 1. Pause All Email Processing

**When**: Email provider is down, rate limits exceeded, or investigating issues

```bash
curl -X POST http://localhost:5000/api/admin/email-queue/pause \
  -H "Cookie: session=<admin-session-cookie>"
```

**Effect**: Stops processing new jobs. Emails remain in queue.

### 2. Resume Email Processing

```bash
curl -X POST http://localhost:5000/api/admin/email-queue/resume \
  -H "Cookie: session=<admin-session-cookie>"
```

### 3. Disable Email System Completely

**Environment variable override**:

```bash
# In .env or Replit Secrets
EMAIL_ENABLED=false
```

Restart server for changes to take effect.

### 4. Clear Failed Job Queue

```bash
curl -X POST http://localhost:5000/api/admin/email-queue/clean \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<admin-session-cookie>" \
  -d '{ "gracePeriod": 3600000 }'  # 1 hour

# gracePeriod in milliseconds:
# - 3600000 = 1 hour
# - 86400000 = 24 hours (default)
```

### 5. Manually Retry Failed Job

```bash
# 1. List failed jobs
curl -X GET http://localhost:5000/api/admin/email-queue/failed?limit=20 \
  -H "Cookie: session=<admin-session-cookie>" | jq

# 2. Retry specific job
curl -X POST http://localhost:5000/api/admin/email-queue/retry/12345 \
  -H "Cookie: session=<admin-session-cookie>"
```

---

## 🔄 Rollback Procedures

### Scenario A: Revert to Direct Email (No Queue)

**When**: Bull queue causing issues, need immediate rollback

**Steps**:

1. **Revert Git Commit**

   ```bash
   git revert e05cf4a  # Email queue implementation commit
   git push origin main
   ```

2. **Restart Server**

   ```bash
   npm run build
   pm2 restart alphaflow
   # or
   npm run start
   ```

3. **Verify Emails Working**
   - Test order fill notification
   - Check logs for "Email sent directly" messages

**Downtime**: ~2 minutes (build + restart)

**Data Loss**: Emails in queue will be lost (not retried)

### Scenario B: Rollback to Previous Queue Version

**When**: New queue version has bugs, previous version was stable

1. **Checkout Previous Version**

   ```bash
   git checkout <previous-stable-commit>
   git checkout -b hotfix/email-queue-rollback
   ```

2. **Deploy Hotfix**

   ```bash
   npm run build
   git push origin hotfix/email-queue-rollback
   ```

3. **Monitor Queue Health**
   - Check `/api/admin/email-queue/status`
   - Verify failed rate is < 5%

### Scenario C: Switch Email Provider

**When**: Primary provider (SendGrid) is down

**No code change needed** - automatic fallback:

1. SendGrid fails → Brevo tried automatically
2. Monitor logs for "Email sent via Brevo" messages
3. If Brevo also fails, all providers down (check status pages)

**Manual provider switch**:

```bash
# Disable SendGrid temporarily
unset SENDGRID_API_KEY

# Verify Brevo is primary
curl http://localhost:5000/api/admin/email/provider-status
```

---

## 🔧 Troubleshooting

### Problem: Emails Not Sending

**Symptoms**: Queue shows `completed` but users not receiving emails

**Diagnosis**:

1. Check provider API keys:

   ```bash
   echo $BREVO_API_KEY | head -c 20  # Should show: xkeysib-...
   echo $SENDGRID_API_KEY | head -c 10  # Should show: SG...
   ```

2. Check queue status:

   ```bash
   curl http://localhost:5000/api/admin/email-queue/status
   ```

3. Check failed jobs:
   ```bash
   curl http://localhost:5000/api/admin/email-queue/failed?limit=5 | jq
   ```

**Solutions**:

- **Invalid API key**: Update `.env` with valid key
- **Provider rate limited**: Wait for rate limit reset or upgrade plan
- **Email address invalid**: Check user email format in database

### Problem: Redis Connection Errors

**Symptoms**: Logs show "Queue error: Connection refused"

**Diagnosis**:

```bash
redis-cli ping  # Should return: PONG
```

**Solutions**:

1. **Redis not running**:

   ```bash
   redis-server
   # or Docker
   docker run -d -p 6379:6379 redis:latest
   ```

2. **Wrong Redis config**:

   ```bash
   # Check .env
   echo $REDIS_HOST  # Should be: localhost or redis IP
   echo $REDIS_PORT  # Should be: 6379
   ```

3. **Fallback mode**:
   If Redis unavailable, queue automatically falls back to direct send (no retries).

### Problem: Rate Limit Exceeded

**Symptoms**: Error message "Daily email limit reached (50/day)"

**Diagnosis**:

```bash
# Check user's current usage
curl http://localhost:5000/api/admin/email-queue/rate-limits/user-123 | jq
```

**Solutions**:

1. **Normal usage**: User should wait for daily reset (UTC midnight)
2. **Abnormal spike**: Investigate why user is getting so many notifications
3. **Emergency override**: Manually reset counters (see Rate Limiting section)
4. **System limit hit (300/day)**:
   - Upgrade Brevo to paid plan ($25/month for 20,000 emails)
   - Or add additional provider (Resend, Postmark)

### Problem: Queue Backlog Growing

**Symptoms**: `waiting` count keeps increasing, `active` stays low

**Diagnosis**:

1. Check worker health:

   ```bash
   curl http://localhost:5000/api/admin/email-queue/status | jq '.data.active'
   ```

2. Check Redis memory:
   ```bash
   redis-cli info memory | grep used_memory_human
   ```

**Solutions**:

- **Worker stalled**: Restart server to restart queue processor
- **Redis memory full**: Increase Redis max memory or clean old jobs
- **Provider slow**: Check provider status page (status.brevo.com)

### Problem: Emails Delayed by 5-15 Minutes

**Symptoms**: Users report receiving emails much later than trade execution

**Diagnosis**: Check for retry patterns in logs:

```bash
tail -f logs/server.log | grep "EmailQueue"
```

**Causes**:

- **Expected behavior**: Failed emails retry at 1min, 5min, 15min intervals
- **Provider rate limiting**: Brevo may be throttling requests
- **Network issues**: Transient connectivity problems

**Solutions**:

- If consistent: Investigate provider API status
- If occasional: Normal retry behavior, no action needed

---

## 🔑 Provider Configuration

### SendGrid (Priority 1)

**Free Tier**: 100 emails/day
**Status Page**: https://status.sendgrid.com/
**Docs**: https://docs.sendgrid.com/api-reference/mail-send/mail-send

**Configuration**:

```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@alphaflow.app
```

**Get API Key**: https://app.sendgrid.com/settings/api_keys

### Brevo (Priority 2)

**Free Tier**: 300 emails/day (NO credit card required)
**Status Page**: https://status.brevo.com/
**Docs**: https://developers.brevo.com/reference/sendtransacemail

**Configuration**:

```bash
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Get API Key**: https://app.brevo.com/settings/keys/api

### Provider Selection Logic

1. Check if SendGrid configured → Use SendGrid
2. If SendGrid fails → Try Brevo
3. If Brevo fails → Return error
4. Log which provider succeeded for each email

### Adding Additional Providers

To add Resend, Postmark, or others:

1. Create provider file: `server/lib/email-providers/resend.ts`
2. Implement `EmailProvider` interface
3. Register in `server/lib/email-providers/index.ts`
4. Set priority (lower number = higher priority)

---

## 🧪 Testing & Validation

### Manual Testing

```bash
# Start server with Redis
redis-server &
npm run dev

# Send test email (requires admin auth)
curl -X POST http://localhost:5000/api/admin/test-email \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<admin-cookie>" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test Email",
    "text": "Testing email queue"
  }'

# Check queue status
curl http://localhost:5000/api/admin/email-queue/status | jq
```

### Integration Tests

```bash
# Run email queue tests
npm run test -- --grep "Email Queue"

# Expected: All tests pass
# - queueEmail successfully
# - Rate limiting enforced
# - Non-blocking operation
# - Failed job handling
```

### Load Testing

```bash
# Queue 100 emails rapidly (should not block)
for i in {1..100}; do
  curl -X POST http://localhost:5000/api/admin/test-email \
    -H "Content-Type: application/json" \
    -H "Cookie: session=<admin-cookie>" \
    -d "{ \"to\": \"test${i}@example.com\" }" &
done

# Verify all queued within < 5 seconds
# Check queue status - should show waiting=100, then process gradually
```

---

## 📚 Related Documentation

- **Email Templates**: `server/lib/email-templates.ts` (1,037 lines)
- **Email Service**: `server/lib/email-service.ts` (529 lines)
- **Notification Service**: `server/lib/notification-service.ts` (510 lines)
- **OpenSpec Proposal**: `openspec/archived/add-email-notifications/`
- **Migration Script**: `migrations/0007_make_email_required.sql`

---

## 🔒 Security Considerations

### Data Privacy

- **Email content contains PII**: Portfolio values, P&L, trading decisions
- **No encryption at rest**: Emails stored in Redis queue temporarily (< 24h)
- **Provider access**: SendGrid/Brevo can read all email content
- **Recommendation**: For enterprise, implement end-to-end encryption

### Compliance

- **CAN-SPAM Act**: Transactional emails exempt (trade confirmations)
- **GDPR**: Email addresses stored in database, covered by privacy policy
- **Unsubscribe**: Not required for transactional emails (order fills, alerts)
- **Daily/Weekly summaries**: Marketing emails - unsubscribe link recommended

### API Key Security

- **Never commit API keys** to git
- **Use environment variables** (`.env` or Replit Secrets)
- **Rotate keys** every 90 days
- **Restrict API key permissions** (SendGrid: Mail Send only)

---

## 📈 Scaling Considerations

### Current Capacity

- **Users**: 78
- **Daily emails**: ~390 (78 users × 5 email types)
- **Provider limit**: 300/day (Brevo free)
- **Status**: **At 97% capacity**

### Scaling Thresholds

| Users | Daily Emails | Free Tier   | Paid Plan Needed? |
| ----- | ------------ | ----------- | ----------------- |
| 78    | 390          | ⚠️ At limit | Upgrade now       |
| 100   | 500          | ❌ Exceeds  | Yes ($25/mo)      |
| 500   | 2,500        | ❌ Exceeds  | Yes ($75/mo)      |
| 1,000 | 5,000        | ❌ Exceeds  | Yes ($150/mo)     |

### Recommended Actions

**Immediate** (78 users):

- [ ] Upgrade Brevo to paid plan ($25/month for 20,000 emails)
- [ ] Or reduce email frequency (disable daily summaries by default)

**Future** (100+ users):

- [ ] Implement email batching (send 1 weekly digest vs 7 daily emails)
- [ ] Add user preference: "High priority only" (fills, losses, CB only)
- [ ] Consider self-hosted email (Postal, Mailu) for unlimited sending

---

## 🔄 Rollback Decision Matrix

| Scenario                | Rollback Method              | Downtime | Data Loss          |
| ----------------------- | ---------------------------- | -------- | ------------------ |
| Queue not working       | Revert to direct send        | 2 min    | Queued emails lost |
| Redis connection issues | Fix Redis config             | 0 min    | None               |
| Provider API down       | Automatic failover           | 0 min    | None               |
| Rate limit issues       | Upgrade plan or reset limits | 0 min    | None               |
| Security vulnerability  | Apply hotfix patch           | 2 min    | None               |

---

## 📞 Support Contacts

### Provider Support

- **SendGrid**: https://support.sendgrid.com/
- **Brevo**: https://help.brevo.com/hc/en-us

### Internal Escalation

1. **First responder**: Platform engineer on-call
2. **Escalation**: Engineering manager
3. **Critical outage**: CTO notification

---

## 📝 Change Log

| Date       | Version | Changes                                           |
| ---------- | ------- | ------------------------------------------------- |
| 2026-01-03 | 1.0     | Initial runbook created with queue implementation |

---

**Emergency Hotline**: Check team wiki for current on-call engineer.

**Runbook maintained by**: Platform Engineering Team
**Review cadence**: Quarterly or after major incidents
