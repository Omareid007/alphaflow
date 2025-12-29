# Feature Specification: Futures Trading (IBKR Integration)

## Overview

| Attribute | Value |
|-----------|-------|
| Feature ID | F-002 |
| Priority | P2 |
| Estimated Effort | High (6-8 weeks) |
| Status | NOT IMPLEMENTED |
| Reference | `docs/FUTURES_ROADMAP.md` |

## Problem Statement

The platform currently only supports equities trading via Alpaca. Users who want to trade futures contracts (ES, NQ, CL, GC, etc.) have no capability to do so. This limits the platform's appeal to sophisticated traders.

## User Stories

### US-1: Futures Account Connection
**As a** trader
**I want to** connect my Interactive Brokers account
**So that** I can trade futures alongside my equity positions

### US-2: Futures Order Placement
**As a** trader
**I want to** place futures orders (market, limit, stop)
**So that** I can execute futures trading strategies

### US-3: Futures Position Management
**As a** trader
**I want to** view and manage my futures positions
**So that** I can monitor margin, P&L, and contract details

### US-4: Futures Strategy Backtesting
**As a** strategy developer
**I want to** backtest strategies on futures data
**So that** I can validate strategies before live trading

## Acceptance Criteria

### Functional Requirements

```gherkin
Feature: Futures Trading via IBKR

  Background:
    Given I have an Interactive Brokers account
    And I have enabled API access in TWS/Gateway

  Scenario: Connect IBKR account
    Given I am on the broker connections page
    When I enter my IBKR credentials and port
    And I click "Connect"
    Then I should see "Connected" status
    And my futures buying power should be displayed

  Scenario: Place futures market order
    Given I am connected to IBKR
    When I select contract "ESH5" (E-mini S&P 500 March 2025)
    And I enter quantity "1"
    And I select "BUY"
    And I click "Place Order"
    Then the order should be submitted to IBKR
    And I should see confirmation with order ID

  Scenario: View futures positions
    Given I have open futures positions
    When I navigate to Portfolio
    Then I should see my futures positions listed
    And each position should show: contract, qty, avg price, P&L, margin

  Scenario: Roll futures contract
    Given I have a position in "ESH5" expiring soon
    When I click "Roll Position"
    Then I should see the next contract "ESM5"
    And I can execute a spread order to roll
```

### Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Order latency | < 100ms to IBKR |
| Position sync | Real-time via WebSocket |
| Margin calculation | Real-time updates |
| Historical data | 10+ years for backtesting |
| Supported contracts | ES, NQ, CL, GC, ZB, 6E, ZC, ZS |

## Technical Design

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  Express Server  │────▶│   IBKR Gateway  │
│                 │     │                  │     │   (TWS/IB GW)   │
│  - Order Form   │     │  - ibkr.ts       │     │                 │
│  - Positions    │     │  - FuturesBroker │     │  Port 7497/7496 │
│  - Margin       │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   ib-tws-api     │
                        │   (npm package)  │
                        └──────────────────┘
```

### Data Model

```typescript
// shared/types/futures.ts

export interface FuturesContract {
  symbol: string;           // "ES"
  exchange: string;         // "CME"
  expiry: string;          // "202503"
  localSymbol: string;     // "ESH5"
  multiplier: number;      // 50
  currency: string;        // "USD"
  tickSize: number;        // 0.25
  tickValue: number;       // 12.50
}

export interface FuturesPosition {
  contract: FuturesContract;
  quantity: number;
  avgPrice: number;
  marketPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  initialMargin: number;
  maintenanceMargin: number;
}

export interface FuturesOrder {
  id: string;
  contract: FuturesContract;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MKT' | 'LMT' | 'STP' | 'STP_LMT';
  limitPrice?: number;
  stopPrice?: number;
  status: FuturesOrderStatus;
  filledQty: number;
  avgFillPrice: number;
  submittedAt: Date;
  filledAt?: Date;
}

export type FuturesOrderStatus =
  | 'PendingSubmit'
  | 'Submitted'
  | 'Filled'
  | 'Cancelled'
  | 'ApiCancelled'
  | 'Error';
```

### IBKR Connector Implementation

```typescript
// server/connectors/ibkr.ts

import { IBApi, Contract, Order } from '@stoqey/ib';

export class IBKRConnector {
  private ib: IBApi;
  private connected: boolean = false;

  constructor(config: IBKRConfig) {
    this.ib = new IBApi({
      clientId: config.clientId,
      host: config.host || '127.0.0.1',
      port: config.port || 7497, // 7496 for Gateway
    });
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.ib.connect();

      this.ib.on('connected', () => {
        this.connected = true;
        resolve(true);
      });

      this.ib.on('error', (err) => {
        reject(err);
      });
    });
  }

  async placeFuturesOrder(order: FuturesOrder): Promise<string> {
    const contract: Contract = {
      symbol: order.contract.symbol,
      secType: 'FUT',
      exchange: order.contract.exchange,
      currency: order.contract.currency,
      lastTradeDateOrContractMonth: order.contract.expiry,
    };

    const ibOrder: Order = {
      action: order.action,
      totalQuantity: order.quantity,
      orderType: order.orderType,
      lmtPrice: order.limitPrice,
      auxPrice: order.stopPrice,
    };

    const orderId = this.ib.placeOrder(this.getNextOrderId(), contract, ibOrder);
    return orderId.toString();
  }

  async getPositions(): Promise<FuturesPosition[]> {
    return new Promise((resolve) => {
      const positions: FuturesPosition[] = [];

      this.ib.reqPositions();

      this.ib.on('position', (account, contract, pos, avgCost) => {
        if (contract.secType === 'FUT') {
          positions.push({
            contract: this.mapContract(contract),
            quantity: pos,
            avgPrice: avgCost,
            // ... other fields populated from market data
          });
        }
      });

      this.ib.on('positionEnd', () => {
        resolve(positions);
      });
    });
  }

  async getAccountSummary(): Promise<FuturesAccountSummary> {
    // Request account values: NetLiquidation, BuyingPower, etc.
  }
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/ibkr/connect | Connect to IBKR |
| GET | /api/ibkr/status | Connection status |
| POST | /api/ibkr/disconnect | Disconnect |
| GET | /api/ibkr/contracts | Search contracts |
| GET | /api/ibkr/positions | Get futures positions |
| POST | /api/ibkr/orders | Place order |
| DELETE | /api/ibkr/orders/:id | Cancel order |
| GET | /api/ibkr/orders | Get orders |
| GET | /api/ibkr/account | Account summary |
| GET | /api/ibkr/margin/:contract | Margin requirements |

## Implementation Plan

### Phase 1: Infrastructure (Week 1-2)
- [ ] Install `@stoqey/ib` package
- [ ] Create `server/connectors/ibkr.ts`
- [ ] Implement connection management
- [ ] Add reconnection logic
- [ ] Create type definitions

### Phase 2: Order Management (Week 3-4)
- [ ] Implement order placement
- [ ] Implement order cancellation
- [ ] Add order status tracking
- [ ] Implement order history
- [ ] Add order validation

### Phase 3: Position Management (Week 5)
- [ ] Real-time position updates
- [ ] P&L calculation
- [ ] Margin monitoring
- [ ] Position reconciliation

### Phase 4: UI Integration (Week 6-7)
- [ ] Contract search component
- [ ] Order entry form
- [ ] Positions table
- [ ] Account summary widget
- [ ] Margin warnings

### Phase 5: Backtesting (Week 8)
- [ ] Historical futures data integration
- [ ] Futures-specific backtest engine
- [ ] Roll handling in backtests
- [ ] Margin simulation

## Dependencies

### Required
- Interactive Brokers account with API access
- TWS or IB Gateway running locally or on server
- `@stoqey/ib` npm package

### Environment Variables
```
IBKR_HOST=127.0.0.1
IBKR_PORT=7497
IBKR_CLIENT_ID=1
```

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| IBKR API complexity | High | High | Use well-maintained wrapper library |
| TWS disconnections | Medium | Medium | Implement auto-reconnect |
| Margin calculation errors | Low | High | Use IBKR's margin API, not custom |
| Contract rollover bugs | Medium | Medium | Extensive testing with paper trading |

## Success Metrics

| Metric | Target |
|--------|--------|
| Order success rate | > 99% |
| Position sync accuracy | 100% |
| Connection uptime | > 99.5% |
| Backtest accuracy vs live | > 95% |

## Definition of Done

- [ ] IBKR connector implemented
- [ ] All API endpoints working
- [ ] UI components complete
- [ ] Paper trading tested
- [ ] Error handling robust
- [ ] Documentation complete
- [ ] Unit tests > 80% coverage
- [ ] Integration tests passing
- [ ] Live trading tested (limited)
