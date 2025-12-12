# Data Migration Strategy

> **Purpose:** Define the approach for migrating from monolithic database to per-service databases during the microservices transformation.

---

## Overview

This document outlines the data migration strategy for transitioning from the current monolithic PostgreSQL database to a distributed database-per-service architecture. The goal is zero-downtime migration with data consistency guarantees.

---

## Current State

### Monolithic Schema

```sql
-- Current unified schema in shared database
CREATE TABLE users (...);
CREATE TABLE strategies (...);
CREATE TABLE trades (...);
CREATE TABLE positions (...);
CREATE TABLE ai_decisions (...);
CREATE TABLE ai_decision_features (...);
CREATE TABLE ai_trade_outcomes (...);
CREATE TABLE ai_calibration_log (...);
CREATE TABLE agent_status (...);
```

### Table Ownership Mapping

| Table | Target Service | Migration Phase |
|-------|----------------|-----------------|
| users | API Gateway | Phase 2 |
| strategies | Orchestrator | Phase 2 |
| trades | Trading Engine | Phase 2 |
| positions | Trading Engine | Phase 2 |
| ai_decisions | AI Decision | Phase 2 |
| ai_decision_features | AI Decision | Phase 2 |
| ai_trade_outcomes | Analytics | Phase 2 |
| ai_calibration_log | AI Decision | Phase 2 |
| agent_status | Orchestrator | Phase 2 |

---

## Migration Patterns

### Pattern 1: Dual-Write (Recommended for Critical Data)

Write to both old and new databases simultaneously during transition.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DUAL-WRITE PATTERN                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐                                                        │
│  │   Service   │                                                        │
│  └──────┬──────┘                                                        │
│         │                                                                │
│         │ write()                                                        │
│         ▼                                                                │
│  ┌─────────────────────────────────────────────────┐                    │
│  │              Dual-Write Proxy                    │                    │
│  └────────────────────┬────────────────────────────┘                    │
│                       │                                                  │
│         ┌─────────────┴─────────────┐                                   │
│         ▼                           ▼                                   │
│  ┌─────────────┐            ┌─────────────┐                            │
│  │  Monolith   │            │   Service   │                            │
│  │  Database   │            │  Database   │                            │
│  │  (Primary)  │            │ (Secondary) │                            │
│  └─────────────┘            └─────────────┘                            │
│                                                                          │
│  Phase 1: Monolith primary, Service secondary                           │
│  Phase 2: Verify consistency, switch primary                            │
│  Phase 3: Service primary, deprecate monolith                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
class DualWriteRepository<T> {
  constructor(
    private primaryRepo: Repository<T>,
    private secondaryRepo: Repository<T>,
    private config: {
      writeToBoth: boolean;
      readFromPrimary: boolean;
      verifyConsistency: boolean;
    }
  ) {}

  async insert(entity: T): Promise<T> {
    // Always write to primary
    const result = await this.primaryRepo.insert(entity);
    
    if (this.config.writeToBoth) {
      try {
        await this.secondaryRepo.insert(entity);
      } catch (error) {
        // Log but don't fail - secondary is eventual
        log.warn('DualWrite', 'Secondary write failed', { error });
        await this.queueForRetry(entity);
      }
    }
    
    return result;
  }

  async findById(id: string): Promise<T | null> {
    const primary = await this.primaryRepo.findById(id);
    
    if (this.config.verifyConsistency) {
      const secondary = await this.secondaryRepo.findById(id);
      if (!this.areEqual(primary, secondary)) {
        log.warn('DualWrite', 'Consistency mismatch', { id });
        await this.reconcile(id, primary, secondary);
      }
    }
    
    return this.config.readFromPrimary ? primary : secondary;
  }
}
```

---

### Pattern 2: Change Data Capture (CDC)

Use database change streams to replicate data asynchronously.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CDC PATTERN                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │  Monolith   │     │   Debezium  │     │    Kafka    │               │
│  │  Database   │────>│  Connector  │────>│   Topics    │               │
│  │  (WAL)      │     │             │     │             │               │
│  └─────────────┘     └─────────────┘     └──────┬──────┘               │
│                                                  │                       │
│                      ┌───────────────────────────┤                       │
│                      │                           │                       │
│                      ▼                           ▼                       │
│              ┌─────────────┐            ┌─────────────┐                 │
│              │  Trading    │            │     AI      │                 │
│              │  Engine DB  │            │ Decision DB │                 │
│              └─────────────┘            └─────────────┘                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**PostgreSQL Logical Replication Setup:**

```sql
-- Enable logical replication on source
ALTER SYSTEM SET wal_level = logical;
ALTER SYSTEM SET max_replication_slots = 10;

-- Create publication for each service's tables
CREATE PUBLICATION trading_engine_pub FOR TABLE trades, positions;
CREATE PUBLICATION ai_decision_pub FOR TABLE ai_decisions, ai_decision_features;
CREATE PUBLICATION analytics_pub FOR TABLE ai_trade_outcomes;

-- On target database, create subscription
CREATE SUBSCRIPTION trading_engine_sub
  CONNECTION 'host=source-db dbname=ai_trader'
  PUBLICATION trading_engine_pub;
```

---

### Pattern 3: Strangler Fig (Gradual Migration)

Route traffic gradually to new service while maintaining fallback.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          STRANGLER FIG PATTERN                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐     ┌─────────────────────────────────────────────┐   │
│  │   Request   │────>│              Feature Flag Router             │   │
│  └─────────────┘     └─────────────────────────────────────────────┘   │
│                                      │                                   │
│                       ┌──────────────┴──────────────┐                   │
│                       │                             │                   │
│                       ▼                             ▼                   │
│               ┌─────────────┐              ┌─────────────┐             │
│               │  Monolith   │              │    New      │             │
│               │  (Legacy)   │              │  Service    │             │
│               │             │              │             │             │
│               │  90% → 0%   │              │  10% → 100% │             │
│               └─────────────┘              └─────────────┘             │
│                                                                          │
│  Week 1: 90/10 split                                                    │
│  Week 2: 70/30 split                                                    │
│  Week 3: 50/50 split                                                    │
│  Week 4: 10/90 split                                                    │
│  Week 5: 0/100 - decommission monolith                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Migration Phases

### Phase 1: Preparation (Week 1-2)

**Objectives:**
- Set up service databases with identical schemas
- Implement dual-write proxies
- Create reconciliation tooling

**Tasks:**

```yaml
preparation:
  - task: Create service database schemas
    owner: Platform Team
    duration: 2 days
    
  - task: Implement DualWriteRepository
    owner: Backend Team
    duration: 3 days
    
  - task: Build reconciliation dashboard
    owner: Platform Team
    duration: 2 days
    
  - task: Set up CDC pipeline (Debezium)
    owner: Platform Team
    duration: 3 days
    
  - task: Create data validation scripts
    owner: Backend Team
    duration: 2 days
```

**Verification Checklist:**
- [ ] All service schemas created and match source
- [ ] Dual-write proxy tested in staging
- [ ] CDC pipeline replicating correctly
- [ ] Reconciliation dashboard operational
- [ ] Rollback procedures documented

---

### Phase 2: Dual-Write (Week 3-4)

**Objectives:**
- Enable dual-write for all tables
- Monitor consistency
- Fix any discrepancies

**Configuration:**

```yaml
dual_write:
  trading_engine:
    tables: [trades, positions]
    primary: monolith
    secondary: trading_engine_db
    consistency_check: true
    
  ai_decision:
    tables: [ai_decisions, ai_decision_features, ai_calibration_log]
    primary: monolith
    secondary: ai_decision_db
    consistency_check: true
    
  analytics:
    tables: [ai_trade_outcomes]
    primary: monolith
    secondary: analytics_db
    consistency_check: true
```

**Monitoring Metrics:**

| Metric | Alert Threshold |
|--------|-----------------|
| Write latency increase | > 20% |
| Consistency mismatches | > 0.1% |
| Secondary write failures | > 1% |
| Reconciliation lag | > 5 minutes |

---

### Phase 3: Switchover (Week 5)

**Objectives:**
- Switch read traffic to new databases
- Verify application functionality
- Keep dual-write active for rollback

**Switchover Procedure:**

```typescript
async function switchover(service: string): Promise<void> {
  // 1. Verify consistency
  const report = await runConsistencyCheck(service);
  if (report.mismatchRate > 0.001) {
    throw new Error('Consistency check failed');
  }
  
  // 2. Enable read from new database
  await featureFlags.set(`${service}_read_from_new`, true);
  
  // 3. Monitor for 1 hour
  await monitorForErrors(service, 60 * 60 * 1000);
  
  // 4. If stable, switch writes
  await featureFlags.set(`${service}_write_to_new_primary`, true);
  
  // 5. Keep dual-write for 24 hours
  await scheduleDeprecation(service, 24 * 60 * 60 * 1000);
}
```

**Rollback Procedure:**

```typescript
async function rollback(service: string): Promise<void> {
  // 1. Switch reads back to monolith
  await featureFlags.set(`${service}_read_from_new`, false);
  
  // 2. Switch writes back to monolith primary
  await featureFlags.set(`${service}_write_to_new_primary`, false);
  
  // 3. Sync any writes that went to new DB
  await syncFromNewToMonolith(service);
  
  // 4. Alert team
  await alertTeam(`Rollback executed for ${service}`);
}
```

---

### Phase 4: Cleanup (Week 6)

**Objectives:**
- Disable dual-write
- Remove legacy code paths
- Archive monolith data

**Tasks:**

```yaml
cleanup:
  - task: Disable dual-write proxies
    owner: Backend Team
    duration: 1 day
    
  - task: Remove legacy repository implementations
    owner: Backend Team
    duration: 2 days
    
  - task: Archive monolith tables
    owner: Platform Team
    duration: 1 day
    
  - task: Update documentation
    owner: All Teams
    duration: 1 day
```

---

## Data Consistency Guarantees

### Consistency Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| Strong | Both writes must succeed | Financial data |
| Eventual | Secondary can lag | Analytics, logs |
| Best-effort | Secondary failures logged | Non-critical data |

### Conflict Resolution

```typescript
interface ConflictResolution {
  strategy: 'last-write-wins' | 'source-wins' | 'manual';
  timestampField: string;
  alertOnConflict: boolean;
}

const resolutionRules: Record<string, ConflictResolution> = {
  trades: {
    strategy: 'source-wins',  // Monolith is source of truth
    timestampField: 'updated_at',
    alertOnConflict: true
  },
  positions: {
    strategy: 'last-write-wins',  // Most recent data wins
    timestampField: 'last_synced_at',
    alertOnConflict: true
  },
  ai_decisions: {
    strategy: 'source-wins',
    timestampField: 'created_at',
    alertOnConflict: false
  }
};
```

---

## Reconciliation Process

### Automated Reconciliation

```typescript
async function reconcile(table: string): Promise<ReconciliationReport> {
  const sourceRows = await monolith.query(`SELECT * FROM ${table}`);
  const targetRows = await serviceDb.query(`SELECT * FROM ${table}`);
  
  const mismatches: Mismatch[] = [];
  const missing: Row[] = [];
  const extra: Row[] = [];
  
  for (const sourceRow of sourceRows) {
    const targetRow = targetRows.find(t => t.id === sourceRow.id);
    
    if (!targetRow) {
      missing.push(sourceRow);
    } else if (!deepEqual(sourceRow, targetRow)) {
      mismatches.push({ source: sourceRow, target: targetRow });
    }
  }
  
  for (const targetRow of targetRows) {
    if (!sourceRows.find(s => s.id === targetRow.id)) {
      extra.push(targetRow);
    }
  }
  
  return {
    table,
    totalSource: sourceRows.length,
    totalTarget: targetRows.length,
    mismatches,
    missing,
    extra,
    mismatchRate: mismatches.length / sourceRows.length
  };
}
```

### Reconciliation Schedule

| Table | Frequency | Max Lag |
|-------|-----------|---------|
| trades | Every 5 minutes | 10 minutes |
| positions | Every 1 minute | 2 minutes |
| ai_decisions | Every 15 minutes | 30 minutes |

---

## Risk Mitigation

### Pre-Migration Checklist

- [ ] Full database backup completed
- [ ] Point-in-time recovery tested
- [ ] Rollback procedure documented and tested
- [ ] Team trained on migration procedures
- [ ] Monitoring dashboards ready
- [ ] On-call schedule confirmed
- [ ] Communication plan for incidents

### During Migration

- [ ] Monitor error rates continuously
- [ ] Check consistency reports every hour
- [ ] Have rollback command ready
- [ ] Limit other deployments during migration
- [ ] Keep stakeholders informed

### Post-Migration

- [ ] Verify all data migrated correctly
- [ ] Run full reconciliation report
- [ ] Performance benchmarks match baseline
- [ ] Remove feature flags after stable period
- [ ] Document lessons learned

---

## Timeline Summary

```
Week 1-2: Preparation
  ├── Database schemas
  ├── Dual-write implementation
  └── Reconciliation tooling

Week 3-4: Dual-Write Active
  ├── Monitor consistency
  ├── Fix discrepancies
  └── Build confidence

Week 5: Switchover
  ├── Trading Engine (Monday)
  ├── AI Decision (Wednesday)
  └── Analytics (Friday)

Week 6: Cleanup
  ├── Disable dual-write
  ├── Remove legacy code
  └── Archive data
```
