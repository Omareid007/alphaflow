# OMAR Momentum Strategy Optimization

## Overview
Running comprehensive momentum-focused parameter optimization for the OMAR trading algorithm with 18,720 unique parameter combinations.

## Optimization Parameters

### Momentum-Specific Parameters
- **Momentum Lookback**: 5-29 days (13 values: 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29)
- **Momentum Weight**: 0.20-0.34 (8 values: 0.20, 0.22, 0.24, 0.26, 0.28, 0.30, 0.32, 0.34)
- **RSI Period**: 7-12 days (6 values: 7, 8, 9, 10, 11, 12) - Faster RSI for momentum confirmation
- **ATR Stop Multiplier**: 1.0-1.5x (6 values: 1.0, 1.1, 1.2, 1.3, 1.4, 1.5) - Tighter stops for momentum trades
- **ATR Target Multiplier**: 4.0-6.0x (5 values: 4.0, 4.5, 5.0, 5.5, 6.0) - Higher reward ratios

### Fixed Parameters (For Speed)
- **Buy Threshold**: 0.12
- **Confidence Minimum**: 0.25
- **Max Position Size**: 8%
- **Max Positions**: 12
- **Initial Capital**: $100,000
- **Max Daily Loss**: 5%

## Test Universe
22 high-momentum, high-beta stocks and ETFs:
- **Tech Leaders**: NVDA, AMD, TSLA, META, NFLX, MSFT, GOOGL, AAPL, AMZN, CRM
- **Growth Tech**: AVGO, NOW, PANW, MU, AMAT
- **Momentum ETFs**: QQQ, TQQQ, SPY
- **Sector ETFs**: XLK, XLF, XLE, XLV

## Backtest Period
- **Start Date**: January 1, 2022
- **End Date**: December 20, 2025
- **Duration**: 2.95 years (996 trading days)
- **Market Conditions**: Includes 2022 bear market, 2023-2024 recovery, 2025 bull market

## Factor Weighting Strategy
Momentum gets a custom high weight (0.20-0.34), with remaining weight distributed as:
- **Technical**: 30% of remaining weight
- **Volume**: 30% of remaining weight
- **Sentiment**: 25% of remaining weight
- **Volatility**: 15% of remaining weight

Example: If momentum weight = 0.30, then remaining = 0.70
- Technical: 0.70 × 0.30 = 0.21
- Volume: 0.70 × 0.30 = 0.21
- Sentiment: 0.70 × 0.25 = 0.175
- Volatility: 0.70 × 0.15 = 0.105

## Optimization Scoring
Configurations ranked by composite score:
- **Sharpe Ratio** × 30
- **Sortino Ratio** × 25
- **Calmar Ratio** × 20
- **Win Rate** × 0.15
- **Total Return** × 0.10

## Early Results (First 5,300 iterations)
Best Sharpe ratios seen so far:
- **3.19** (MomLB=9, MomW=0.34, RSI=12, Stop=1.1x, Target=6.0x) - Return: 188.8%, Win: 46.4%
- **3.14** (MomLB=9, MomW=0.32, RSI=11, Stop=1.3x, Target=6.0x) - Return: 174.4%, Win: 47.3%
- **3.13** (MomLB=7, MomW=0.30, RSI=8, Stop=1.5x, Target=6.0x) - Return: 148.2%, Win: 49.2%
- **3.07** (MomLB=9, MomW=0.30, RSI=10, Stop=1.5x, Target=6.0x) - Return: 146.2%, Win: 47.7%
- **3.04** (MomLB=11, MomW=0.28, RSI=12, Stop=1.1x, Target=6.0x) - Return: 172.3%, Win: 46.5%

## Key Observations
1. **Higher momentum weights (0.28-0.34) performing well** - Confirms momentum focus is effective
2. **Shorter lookback periods (7-11 days) showing strong results** - Faster momentum signals work better
3. **Faster RSI periods (8-12) effective** - Quicker mean reversion detection
4. **Tighter stops (1.1-1.3x) with high targets (6.0x) optimal** - Classic momentum asymmetry
5. **Win rates 44-49%** - Typical for momentum strategies with asymmetric risk/reward
6. **Sharpe ratios exceeding 3.0** - Exceptional risk-adjusted returns
7. **Total returns 100-190%** over 2.95 years - Strong absolute performance

## Momentum Strategy Characteristics
- **Capitalize on trending moves** with Rate of Change (ROC) based on custom lookback
- **Quick entry** on momentum breakouts above moving averages
- **Tight stops** to cut losses fast on failed breakouts
- **High targets** to capture full trending moves
- **Trailing stops** activated after 3% profit to lock in gains
- **Signal reversal exits** when composite score drops below -0.15

## Status
Optimization running... Estimated completion time: ~27-30 minutes from start
Progress: Iteration 5,300 of 18,720 (28% complete)

## Files
- **Optimizer Script**: `/home/runner/workspace/scripts/omar-momentum-optimizer-fast.ts`
- **Output Log**: `/tmp/claude/-home-runner-workspace/tasks/b8c05ea.output`
