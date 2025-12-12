# Service Level Agreements & Objectives

> **Purpose:** Define operational readiness criteria for each microservice in the AI Active Trader platform.

---

## Overview

This document establishes Service Level Agreements (SLAs) and Service Level Objectives (SLOs) for each microservice to ensure operational excellence and measurable reliability targets.

### Definitions

| Term | Definition |
|------|------------|
| **SLA** | Contractual commitment to users (external) |
| **SLO** | Internal target that should exceed SLA |
| **SLI** | Service Level Indicator - the metric being measured |
| **Error Budget** | Allowed downtime/errors before SLO is breached |

---

## Global Platform SLAs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Platform Availability | 99.5% | Monthly uptime |
| Order Execution Success | 99.9% | Orders submitted successfully |
| Data Freshness | < 5 seconds | Quote staleness |
| API Response Time (p95) | < 500ms | Gateway latency |

---

## Service-Specific SLOs

### API Gateway

| SLI | SLO Target | Error Budget (30 days) |
|-----|------------|------------------------|
| Availability | 99.9% | 43.2 minutes |
| Latency (p50) | < 50ms | - |
| Latency (p95) | < 200ms | - |
| Latency (p99) | < 500ms | - |
| Error Rate | < 0.1% | 4,320 errors per 4.32M requests |
| Rate Limit Accuracy | 99.99% | 432 missed enforcements |

**Key Metrics:**
```yaml
gateway_request_latency_ms:
  p50: 50
  p95: 200
  p99: 500

gateway_availability_percent: 99.9
gateway_error_rate_percent: 0.1
```

**Alerting Thresholds:**
- Warning: Latency p95 > 150ms for 5 minutes
- Critical: Latency p95 > 400ms for 2 minutes
- Warning: Error rate > 0.05% for 10 minutes
- Critical: Error rate > 0.5% for 5 minutes

---

### Trading Engine

| SLI | SLO Target | Error Budget (30 days) |
|-----|------------|------------------------|
| Availability | 99.95% | 21.6 minutes |
| Order Submission Latency (p95) | < 100ms | - |
| Order Acknowledgment (p95) | < 500ms | - |
| Position Sync Accuracy | 100% | 0 discrepancies |
| Risk Check Latency (p95) | < 50ms | - |

**Critical Path SLOs:**
| Operation | Target | Max Acceptable |
|-----------|--------|----------------|
| Submit Market Order | < 50ms | 100ms |
| Submit Limit Order | < 50ms | 100ms |
| Cancel Order | < 100ms | 200ms |
| Get Positions | < 30ms | 100ms |
| Risk Validation | < 20ms | 50ms |

**Alerting Thresholds:**
- Warning: Order latency p95 > 80ms for 5 minutes
- Critical: Order latency p95 > 200ms for 2 minutes
- Critical: Position sync mismatch detected
- Critical: Alpaca API connection lost > 30 seconds

---

### AI Decision Service

| SLI | SLO Target | Error Budget (30 days) |
|-----|------------|------------------------|
| Availability | 99.5% | 3.6 hours |
| Decision Generation (p50) | < 2 seconds | - |
| Decision Generation (p95) | < 5 seconds | - |
| Decision Generation (p99) | < 10 seconds | - |
| Model Fallback Success | 99.9% | 1 in 1000 failures |
| Decision Quality (calibration) | > 55% accuracy | - |

**LLM Provider SLOs:**
| Provider | Target Availability | Fallback Order |
|----------|--------------------| ---------------|
| OpenAI GPT-4o | 99.5% | Primary |
| Groq Mixtral | 99% | Secondary |
| Together Llama | 99% | Tertiary |

**Cost Controls:**
| Metric | Limit | Action |
|--------|-------|--------|
| Daily Token Budget | $50 | Switch to cheaper model |
| Per-Request Cost | $0.10 | Use cached reasoning |
| Monthly Cost | $1,000 | Alert and review |

**Alerting Thresholds:**
- Warning: Decision latency p95 > 4s for 10 minutes
- Critical: Decision latency p95 > 8s for 5 minutes
- Warning: Primary model fallback rate > 5%
- Critical: All models unavailable > 1 minute

---

### Market Data Service

| SLI | SLO Target | Error Budget (30 days) |
|-----|------------|------------------------|
| Availability | 99.9% | 43.2 minutes |
| Quote Latency (p95) | < 100ms | - |
| Data Freshness | < 5 seconds | - |
| Cache Hit Rate | > 80% | - |
| Provider Failover Time | < 10 seconds | - |

**Data Provider SLOs:**
| Provider | Primary For | Failover To |
|----------|-------------|-------------|
| Alpaca | Quotes, Bars | Finnhub |
| Finnhub | Fundamentals | Polygon |
| CoinGecko | Crypto | - |
| NewsAPI | Headlines | GDELT |

**Streaming SLOs:**
| Metric | Target |
|--------|--------|
| WebSocket Uptime | 99.9% |
| Message Delivery | 99.99% |
| Reconnection Time | < 5 seconds |

**Alerting Thresholds:**
- Warning: Quote latency p95 > 80ms for 5 minutes
- Critical: Data staleness > 30 seconds
- Warning: Cache hit rate < 70% for 15 minutes
- Critical: All providers unavailable > 1 minute

---

### Analytics Service

| SLI | SLO Target | Error Budget (30 days) |
|-----|------------|------------------------|
| Availability | 99.5% | 3.6 hours |
| Query Latency (p95) | < 500ms | - |
| P&L Calculation Accuracy | 100% | 0 errors |
| Snapshot Frequency | Every 60 seconds | - |
| Report Generation (p95) | < 5 seconds | - |

**Data Consistency SLOs:**
| Metric | Target |
|--------|--------|
| P&L Reconciliation | 100% accurate |
| Position Sync Lag | < 5 seconds |
| Historical Data Retention | 1 year |

**Alerting Thresholds:**
- Warning: Query latency p95 > 400ms for 10 minutes
- Critical: P&L calculation error detected
- Warning: Snapshot gap > 2 minutes
- Critical: Database connection lost > 30 seconds

---

### Orchestrator Service

| SLI | SLO Target | Error Budget (30 days) |
|-----|------------|------------------------|
| Availability | 99.9% | 43.2 minutes |
| Cycle Completion Rate | 99.9% | 1 in 1000 failures |
| Cycle Duration (p95) | < 120 seconds | - |
| Saga Completion Rate | 99.5% | 5 in 1000 failures |
| Schedule Accuracy | < 5 second drift | - |

**Trading Cycle SLOs:**
| Cycle Type | Target Duration | Max Duration |
|------------|-----------------|--------------|
| Analysis | < 60 seconds | 120 seconds |
| Heartbeat | < 5 seconds | 10 seconds |
| Rebalance | < 180 seconds | 300 seconds |

**Saga SLOs:**
| Saga | Success Rate | Timeout |
|------|--------------|---------|
| Order Execution | 99.9% | 60 seconds |
| Position Close | 99.9% | 60 seconds |
| Portfolio Rebalance | 99% | 300 seconds |

**Alerting Thresholds:**
- Warning: Cycle duration p95 > 90s for 3 cycles
- Critical: Cycle failure rate > 1% for 10 minutes
- Critical: Agent stopped unexpectedly
- Warning: Schedule drift > 10 seconds

---

### Event Bus (NATS JetStream)

| SLI | SLO Target | Error Budget (30 days) |
|-----|------------|------------------------|
| Availability | 99.99% | 4.32 minutes |
| Message Delivery | 99.999% | 1 in 100,000 |
| Publish Latency (p99) | < 10ms | - |
| Consumer Lag | < 100 messages | - |

**Stream Configuration SLOs:**
| Stream | Retention | Replicas | Max Age |
|--------|-----------|----------|---------|
| market.* | limits | 3 | 1 hour |
| trade.* | limits | 3 | 7 days |
| ai.* | limits | 3 | 24 hours |
| analytics.* | limits | 3 | 30 days |

**Alerting Thresholds:**
- Warning: Consumer lag > 50 messages for 1 minute
- Critical: Consumer lag > 500 messages for 30 seconds
- Critical: Message publish failure
- Critical: Stream unavailable > 10 seconds

---

## Monitoring & Observability

### Required Dashboards

1. **Platform Overview**
   - All service health status
   - Error budget burn rate
   - Active alerts summary

2. **Trading Performance**
   - Order execution latency
   - Fill rates
   - Position accuracy

3. **AI Decision Quality**
   - Decision latency distribution
   - Model usage and costs
   - Accuracy metrics

4. **Data Pipeline Health**
   - Provider availability
   - Data freshness
   - Cache performance

### Alert Escalation Matrix

| Severity | Response Time | Notification | Escalation |
|----------|---------------|--------------|------------|
| Critical | < 5 minutes | PagerDuty, Slack | Immediate |
| Warning | < 30 minutes | Slack | 1 hour |
| Info | Next business day | Email | None |

---

## Error Budget Policy

### Budget Calculation

```
Error Budget = 1 - SLO Target

Example: 99.9% availability SLO
Error Budget = 0.1% = 43.2 minutes/month
```

### Budget Actions

| Budget Remaining | Action |
|------------------|--------|
| > 50% | Normal development velocity |
| 25-50% | Prioritize reliability work |
| 10-25% | Feature freeze, focus on stability |
| < 10% | Emergency response, all hands on deck |

### Burn Rate Alerts

| Burn Rate | Alert Level | Time to Exhaust |
|-----------|-------------|-----------------|
| 1x | Normal | 30 days |
| 2x | Warning | 15 days |
| 5x | Critical | 6 days |
| 10x | Emergency | 3 days |

---

## Capacity Planning

### Current Baseline

| Resource | Current Usage | Headroom |
|----------|---------------|----------|
| API Requests | 1,000/min | 10x |
| Event Messages | 10,000/min | 100x |
| Database Connections | 50 | 5x |
| LLM Tokens/day | 500,000 | 2x |

### Scaling Triggers

| Metric | Trigger | Action |
|--------|---------|--------|
| CPU Usage | > 70% sustained | Add replica |
| Memory Usage | > 80% | Increase limits |
| Request Queue | > 100 pending | Add replica |
| Database Connections | > 80% pool | Increase pool |

---

## Disaster Recovery

### Recovery Objectives

| Metric | Target | Max Acceptable |
|--------|--------|----------------|
| RTO (Recovery Time) | < 15 minutes | 1 hour |
| RPO (Data Loss) | < 1 minute | 5 minutes |
| Failover Time | < 30 seconds | 2 minutes |

### Backup Schedule

| Data Type | Frequency | Retention |
|-----------|-----------|-----------|
| Database | Continuous (WAL) | 30 days |
| Configurations | On change | 90 days |
| Event Logs | Streaming | 7 days |
| Audit Logs | Daily | 1 year |
