# Trading Specification

## Purpose

Core trading operations via Alpaca Markets API.

## Requirements

### Requirement: Paper Trading Mode

The system SHALL support paper trading for testing without real money.

#### Scenario: Execute paper trade

- GIVEN user is in paper trading mode
- WHEN user submits a buy order
- THEN order executes against paper account
- AND portfolio updates with new position
- AND no real money is used

### Requirement: Live Trading Mode

The system SHALL support live trading with real funds.

#### Scenario: Execute live trade

- GIVEN user is in live trading mode
- AND user has sufficient buying power
- WHEN user submits a buy order
- THEN order executes against real brokerage
- AND real funds are used

### Requirement: Kill Switch

The system SHALL provide emergency stop functionality.

#### Scenario: Activate kill switch

- GIVEN trading is active
- WHEN admin activates kill switch
- THEN all pending orders cancel
- AND new orders are blocked
- AND user receives notification

### Requirement: Order Management

The system SHALL track all orders and their status.

#### Scenario: View order history

- GIVEN user has placed orders
- WHEN user views order history
- THEN all orders display with status
- AND filled/pending/cancelled states shown
