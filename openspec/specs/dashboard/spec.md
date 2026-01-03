# Dashboard Specification

## Purpose

Main interface for portfolio monitoring and trading actions.

## Requirements

### Requirement: Portfolio Overview

The system SHALL display portfolio value and positions.

#### Scenario: View portfolio

- GIVEN user is authenticated
- WHEN user views dashboard
- THEN total portfolio value displays
- AND all positions list with current prices
- AND profit/loss shows for each position

### Requirement: Real-time Updates

The system SHALL update data in real-time.

#### Scenario: Price changes

- GIVEN user is viewing dashboard
- WHEN market prices change
- THEN prices update within 5 seconds
- AND profit/loss recalculates automatically

### Requirement: Quick Actions

The system SHALL provide quick trading actions.

#### Scenario: Quick buy

- GIVEN user views a stock
- WHEN user clicks buy button
- THEN order form opens with stock pre-filled
