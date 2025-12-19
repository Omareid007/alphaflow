# Replit Prompt: Position Reconciliation Service

> **STATUS: ✅ COMPLETED** - 2024-12-19
> Implementation: `/server/services/position-reconciler.ts` (327 lines)
> Features: 5-min interval sync, conflict detection, broker-as-source-of-truth, external trade handling

## OBJECTIVE
Implement a position reconciliation service that syncs Alpaca broker positions with the database, resolves conflicts, and ensures consistent position tracking across the platform. This fixes the CRITICAL issue of position tracking duality.

## FILES TO CREATE/MODIFY

### New File:
- `/server/services/position-reconciler.ts` - Reconciliation service

### Files to Modify:
- `/server/trading/alpaca-trading-engine.ts` - Add reconciliation hooks
- `/server/orchestration/coordinator.ts` - Call reconciliation before trading
- `/shared/schema.ts` - Add reconciliation tracking fields (if needed)

## IMPLEMENTATION DETAILS

### Step 1: Create Position Reconciler Service

Create `/server/services/position-reconciler.ts`:

```typescript
import Alpaca from '@alpacahq/alpaca-trade-api';
import { storage } from '../storage';
import { Position, InsertPosition } from '@shared/schema';

export interface ReconciliationResult {
  timestamp: Date;
  status: 'success' | 'partial' | 'failed';
  brokerPositions: number;
  dbPositions: number;
  synced: number;
  added: number;
  removed: number;
  conflicts: PositionConflict[];
  totalValue: number;
}

export interface PositionConflict {
  symbol: string;
  brokerQty: number;
  dbQty: number;
  brokerValue: number;
  dbValue: number;
  resolution: 'use_broker' | 'use_db' | 'manual';
  resolved: boolean;
}

export interface BrokerPosition {
  symbol: string;
  qty: number;
  side: 'long' | 'short';
  marketValue: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

class PositionReconciler {
  private alpaca: Alpaca;
  private lastReconciliation: Date | null = null;
  private reconciliationInterval: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.alpaca = new Alpaca({
      keyId: process.env.ALPACA_API_KEY || '',
      secretKey: process.env.ALPACA_SECRET_KEY || '',
      paper: process.env.ALPACA_PAPER === 'true'
    });
  }

  async reconcile(userId: number = 1, force: boolean = false): Promise<ReconciliationResult> {
    // Skip if recently reconciled (unless forced)
    if (!force && this.lastReconciliation) {
      const elapsed = Date.now() - this.lastReconciliation.getTime();
      if (elapsed < this.reconciliationInterval) {
        console.log(`[Reconciler] Skipping, last run ${elapsed / 1000}s ago`);
        return this.createSkippedResult();
      }
    }

    console.log('[Reconciler] Starting position reconciliation...');
    const startTime = Date.now();

    try {
      // Fetch positions from both sources
      const [brokerPositions, dbPositions] = await Promise.all([
        this.fetchBrokerPositions(),
        this.fetchDBPositions(userId)
      ]);

      // Reconcile positions
      const result = await this.performReconciliation(
        userId,
        brokerPositions,
        dbPositions
      );

      this.lastReconciliation = new Date();

      console.log(`[Reconciler] Completed in ${Date.now() - startTime}ms:`, {
        synced: result.synced,
        added: result.added,
        removed: result.removed,
        conflicts: result.conflicts.length
      });

      return result;
    } catch (error) {
      console.error('[Reconciler] Reconciliation failed:', error);
      return {
        timestamp: new Date(),
        status: 'failed',
        brokerPositions: 0,
        dbPositions: 0,
        synced: 0,
        added: 0,
        removed: 0,
        conflicts: [],
        totalValue: 0
      };
    }
  }

  private async fetchBrokerPositions(): Promise<BrokerPosition[]> {
    try {
      const positions = await this.alpaca.getPositions();
      return positions.map((p: any) => ({
        symbol: p.symbol,
        qty: parseFloat(p.qty),
        side: parseFloat(p.qty) >= 0 ? 'long' : 'short',
        marketValue: parseFloat(p.market_value),
        avgEntryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        unrealizedPL: parseFloat(p.unrealized_pl),
        unrealizedPLPercent: parseFloat(p.unrealized_plpc) * 100
      }));
    } catch (error) {
      console.error('[Reconciler] Failed to fetch broker positions:', error);
      throw error;
    }
  }

  private async fetchDBPositions(userId: number): Promise<Position[]> {
    try {
      // Get open positions from database
      const positions = await storage.getPositions(userId);
      return positions.filter(p => p.status === 'open');
    } catch (error) {
      console.error('[Reconciler] Failed to fetch DB positions:', error);
      throw error;
    }
  }

  private async performReconciliation(
    userId: number,
    brokerPositions: BrokerPosition[],
    dbPositions: Position[]
  ): Promise<ReconciliationResult> {
    const conflicts: PositionConflict[] = [];
    let synced = 0;
    let added = 0;
    let removed = 0;

    const brokerSymbols = new Set(brokerPositions.map(p => p.symbol));
    const dbSymbols = new Set(dbPositions.map(p => p.symbol));

    // Process broker positions
    for (const brokerPos of brokerPositions) {
      const dbPos = dbPositions.find(p => p.symbol === brokerPos.symbol);

      if (!dbPos) {
        // Position exists in broker but not in DB - add to DB
        await this.addPositionToDB(userId, brokerPos);
        added++;
      } else if (Math.abs(dbPos.quantity - brokerPos.qty) > 0.0001) {
        // Quantity mismatch - conflict detected
        const conflict: PositionConflict = {
          symbol: brokerPos.symbol,
          brokerQty: brokerPos.qty,
          dbQty: dbPos.quantity,
          brokerValue: brokerPos.marketValue,
          dbValue: dbPos.quantity * brokerPos.currentPrice,
          resolution: 'use_broker', // Broker is source of truth
          resolved: false
        };

        // Auto-resolve by using broker as source of truth
        await this.updateDBPosition(dbPos.id, brokerPos);
        conflict.resolved = true;
        conflicts.push(conflict);
        synced++;
      } else {
        // Positions match - update price data
        await this.updateDBPositionPrices(dbPos.id, brokerPos);
        synced++;
      }
    }

    // Handle positions in DB but not in broker (closed externally)
    for (const dbPos of dbPositions) {
      if (!brokerSymbols.has(dbPos.symbol)) {
        // Position was closed at broker - mark as closed in DB
        await this.closeDBPosition(dbPos.id);
        removed++;
      }
    }

    const totalValue = brokerPositions.reduce((sum, p) => sum + p.marketValue, 0);

    return {
      timestamp: new Date(),
      status: conflicts.length > 0 ? 'partial' : 'success',
      brokerPositions: brokerPositions.length,
      dbPositions: dbPositions.length,
      synced,
      added,
      removed,
      conflicts,
      totalValue
    };
  }

  private async addPositionToDB(userId: number, brokerPos: BrokerPosition): Promise<void> {
    const newPosition: InsertPosition = {
      userId,
      symbol: brokerPos.symbol,
      quantity: brokerPos.qty,
      side: brokerPos.side,
      entryPrice: brokerPos.avgEntryPrice.toString(),
      currentPrice: brokerPos.currentPrice.toString(),
      unrealizedPL: brokerPos.unrealizedPL.toString(),
      status: 'open',
      strategyId: null, // Unknown strategy - came from external trade
      openedAt: new Date(),
      source: 'reconciliation'
    };

    await storage.createPosition(newPosition);
    console.log(`[Reconciler] Added missing position: ${brokerPos.symbol} x ${brokerPos.qty}`);
  }

  private async updateDBPosition(positionId: number, brokerPos: BrokerPosition): Promise<void> {
    await storage.updatePosition(positionId, {
      quantity: brokerPos.qty,
      currentPrice: brokerPos.currentPrice.toString(),
      unrealizedPL: brokerPos.unrealizedPL.toString(),
      lastSyncedAt: new Date()
    });
    console.log(`[Reconciler] Updated position ${positionId}: qty=${brokerPos.qty}`);
  }

  private async updateDBPositionPrices(positionId: number, brokerPos: BrokerPosition): Promise<void> {
    await storage.updatePosition(positionId, {
      currentPrice: brokerPos.currentPrice.toString(),
      unrealizedPL: brokerPos.unrealizedPL.toString(),
      lastSyncedAt: new Date()
    });
  }

  private async closeDBPosition(positionId: number): Promise<void> {
    await storage.updatePosition(positionId, {
      status: 'closed',
      closedAt: new Date(),
      closeReason: 'reconciliation_external_close'
    });
    console.log(`[Reconciler] Closed stale position: ${positionId}`);
  }

  private createSkippedResult(): ReconciliationResult {
    return {
      timestamp: new Date(),
      status: 'success',
      brokerPositions: 0,
      dbPositions: 0,
      synced: 0,
      added: 0,
      removed: 0,
      conflicts: [],
      totalValue: 0
    };
  }

  // Get reconciliation status
  getStatus(): { lastRun: Date | null; interval: number } {
    return {
      lastRun: this.lastReconciliation,
      interval: this.reconciliationInterval
    };
  }

  // Force immediate reconciliation
  async forceReconcile(userId: number = 1): Promise<ReconciliationResult> {
    return this.reconcile(userId, true);
  }
}

export const positionReconciler = new PositionReconciler();
```

### Step 2: Update Coordinator

In `/server/orchestration/coordinator.ts`, add reconciliation before trading cycles:

```typescript
import { positionReconciler } from '../services/position-reconciler';

// At the start of each trading cycle:
async function executeTradiCycle() {
  // Reconcile positions first
  const reconciliation = await positionReconciler.reconcile();

  if (reconciliation.status === 'failed') {
    console.error('[Coordinator] Position reconciliation failed, skipping cycle');
    return;
  }

  if (reconciliation.conflicts.length > 0) {
    console.warn(`[Coordinator] ${reconciliation.conflicts.length} position conflicts resolved`);
  }

  // Continue with normal trading logic...
}
```

### Step 3: Add API Endpoint

Add to your routes:

```typescript
app.get('/api/positions/reconcile', async (req, res) => {
  const result = await positionReconciler.forceReconcile();
  res.json(result);
});

app.get('/api/positions/reconciliation-status', (req, res) => {
  res.json(positionReconciler.getStatus());
});
```

## ACCEPTANCE CRITERIA

- [ ] PositionReconciler service created
- [ ] Fetches positions from Alpaca broker
- [ ] Compares with database positions
- [ ] Detects quantity mismatches
- [ ] Auto-resolves conflicts using broker as source of truth
- [ ] Handles positions closed externally
- [ ] Handles positions added externally
- [ ] Runs before each trading cycle
- [ ] API endpoints added for manual reconciliation
- [ ] TypeScript compilation succeeds

## VERIFICATION COMMANDS

```bash
# Verify file exists
ls -la server/services/position-reconciler.ts

# Check TypeScript compilation
npx tsc --noEmit

# Test reconciliation endpoint
curl http://localhost:5000/api/positions/reconcile

# Check reconciliation status
curl http://localhost:5000/api/positions/reconciliation-status
```

## ESTIMATED IMPACT

- **New lines**: ~350
- **Files affected**: 4
- **Risk level**: HIGH (core trading functionality)
- **Testing required**: Extensive with paper trading account
- **Rollback plan**: Disable reconciliation in coordinator
