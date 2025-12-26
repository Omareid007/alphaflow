import { AlgorithmTemplate } from '@/lib/types';

export const algorithmTemplates: AlgorithmTemplate[] = [
  {
    id: 'momentum',
    name: 'Momentum Strategy',
    description: 'Captures trends by buying assets with strong recent performance and selling underperformers. Uses technical indicators to identify momentum shifts.',
    difficulty: 'Beginner',
    icon: 'TrendingUp',
    stepSchema: {
      steps: [
        {
          id: 'universe',
          title: 'Select Universe',
          description: 'Choose which markets and symbols to trade',
          fields: [
            { key: 'market', label: 'Market', type: 'select', default: 'us-equities', constraints: { options: [{ value: 'us-equities', label: 'US Equities' }, { value: 'crypto', label: 'Crypto' }, { value: 'forex', label: 'Forex' }] }, helpText: 'Primary market to trade' },
            { key: 'symbols', label: 'Symbols', type: 'multi-select', default: ['AAPL', 'MSFT', 'GOOGL'], constraints: { options: [{ value: 'AAPL', label: 'AAPL' }, { value: 'MSFT', label: 'MSFT' }, { value: 'GOOGL', label: 'GOOGL' }, { value: 'AMZN', label: 'AMZN' }, { value: 'NVDA', label: 'NVDA' }, { value: 'TSLA', label: 'TSLA' }, { value: 'META', label: 'META' }, { value: 'JPM', label: 'JPM' }] }, helpText: 'Symbols to include in strategy' }
          ],
          advancedFields: [
            { key: 'minMarketCap', label: 'Min Market Cap ($B)', type: 'number', default: 10, constraints: { min: 0, max: 1000 }, helpText: 'Minimum market cap filter' },
            { key: 'minVolume', label: 'Min Avg Volume (M)', type: 'number', default: 1, constraints: { min: 0, max: 100 }, helpText: 'Minimum average daily volume' }
          ]
        },
        {
          id: 'signals',
          title: 'Signal Configuration',
          description: 'Configure momentum signal parameters',
          fields: [
            { key: 'lookbackPeriod', label: 'Lookback Period (days)', type: 'number', default: 20, constraints: { min: 5, max: 252 }, helpText: 'Number of days to calculate momentum' },
            { key: 'momentumType', label: 'Momentum Type', type: 'select', default: 'relative', constraints: { options: [{ value: 'absolute', label: 'Absolute' }, { value: 'relative', label: 'Relative' }, { value: 'risk-adjusted', label: 'Risk-Adjusted' }] }, helpText: 'How to measure momentum' },
            { key: 'entryThreshold', label: 'Entry Threshold (%)', type: 'range', default: 5, constraints: { min: 1, max: 20, step: 0.5 }, helpText: 'Minimum momentum for entry' }
          ],
          advancedFields: [
            { key: 'useVolatilityFilter', label: 'Use Volatility Filter', type: 'toggle', default: true, helpText: 'Filter signals by volatility regime' },
            { key: 'volatilityLookback', label: 'Volatility Lookback', type: 'number', default: 60, constraints: { min: 10, max: 252 }, helpText: 'Days for volatility calculation' }
          ]
        },
        {
          id: 'position',
          title: 'Position Sizing',
          description: 'Define how to size positions',
          fields: [
            { key: 'maxPositions', label: 'Max Positions', type: 'number', default: 10, constraints: { min: 1, max: 50 }, helpText: 'Maximum concurrent positions' },
            { key: 'positionSize', label: 'Position Size (%)', type: 'range', default: 10, constraints: { min: 1, max: 25, step: 1 }, helpText: 'Size per position as % of portfolio' },
            { key: 'rebalanceFreq', label: 'Rebalance Frequency', type: 'select', default: 'weekly', constraints: { options: [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }] }, helpText: 'How often to rebalance' }
          ],
          advancedFields: [
            { key: 'useVolatilityScaling', label: 'Volatility Scaling', type: 'toggle', default: false, helpText: 'Scale position size by inverse volatility' },
            { key: 'targetVolatility', label: 'Target Volatility (%)', type: 'number', default: 15, constraints: { min: 5, max: 40 }, helpText: 'Target annualized volatility' }
          ]
        },
        {
          id: 'risk',
          title: 'Risk Management',
          description: 'Set stop losses and risk limits',
          fields: [
            { key: 'stopLoss', label: 'Stop Loss (%)', type: 'range', default: 8, constraints: { min: 1, max: 25, step: 0.5 }, helpText: 'Exit if position drops by this amount' },
            { key: 'takeProfit', label: 'Take Profit (%)', type: 'range', default: 20, constraints: { min: 5, max: 100, step: 1 }, helpText: 'Exit if position gains this amount' },
            { key: 'maxDrawdown', label: 'Max Portfolio Drawdown (%)', type: 'range', default: 15, constraints: { min: 5, max: 50, step: 1 }, helpText: 'Halt strategy if drawdown exceeds' }
          ],
          advancedFields: [
            { key: 'useTrailingStop', label: 'Use Trailing Stop', type: 'toggle', default: false, helpText: 'Trail stop loss as position gains' },
            { key: 'trailingStopPct', label: 'Trailing Stop Distance (%)', type: 'number', default: 5, constraints: { min: 1, max: 15 }, helpText: 'Distance from high for trailing stop' }
          ]
        }
      ]
    },
    presets: [
      { id: 'conservative', name: 'Conservative', description: 'Lower risk, slower signals, tighter stops', valuesByFieldKey: { lookbackPeriod: 40, entryThreshold: 8, maxPositions: 5, positionSize: 5, stopLoss: 5, takeProfit: 15, maxDrawdown: 10, rebalanceFreq: 'monthly' } },
      { id: 'balanced', name: 'Balanced', description: 'Moderate risk and return profile', valuesByFieldKey: { lookbackPeriod: 20, entryThreshold: 5, maxPositions: 10, positionSize: 10, stopLoss: 8, takeProfit: 20, maxDrawdown: 15, rebalanceFreq: 'weekly' } },
      { id: 'aggressive', name: 'Aggressive', description: 'Higher risk, faster signals, wider stops', valuesByFieldKey: { lookbackPeriod: 10, entryThreshold: 3, maxPositions: 15, positionSize: 15, stopLoss: 12, takeProfit: 30, maxDrawdown: 25, rebalanceFreq: 'daily' } },
      { id: 'custom', name: 'Custom', description: 'Configure all parameters manually', valuesByFieldKey: {} }
    ]
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion',
    description: 'Profits from price movements reverting to their mean. Buys oversold assets and sells overbought ones based on statistical deviations.',
    difficulty: 'Intermediate',
    icon: 'Activity',
    stepSchema: {
      steps: [
        {
          id: 'universe',
          title: 'Select Universe',
          description: 'Choose instruments with mean-reverting behavior',
          fields: [
            { key: 'market', label: 'Market', type: 'select', default: 'us-equities', constraints: { options: [{ value: 'us-equities', label: 'US Equities' }, { value: 'etfs', label: 'ETFs' }, { value: 'forex', label: 'Forex Pairs' }] }, helpText: 'Primary market to trade' },
            { key: 'symbols', label: 'Symbols', type: 'multi-select', default: ['SPY', 'QQQ', 'IWM'], constraints: { options: [{ value: 'SPY', label: 'SPY' }, { value: 'QQQ', label: 'QQQ' }, { value: 'IWM', label: 'IWM' }, { value: 'DIA', label: 'DIA' }, { value: 'XLF', label: 'XLF' }, { value: 'XLE', label: 'XLE' }] }, helpText: 'ETFs/symbols to trade' }
          ],
          advancedFields: [
            { key: 'correlationThreshold', label: 'Max Correlation', type: 'range', default: 0.7, constraints: { min: 0.3, max: 1, step: 0.05 }, helpText: 'Max correlation between positions' }
          ]
        },
        {
          id: 'signals',
          title: 'Signal Configuration',
          description: 'Configure mean reversion parameters',
          fields: [
            { key: 'meanPeriod', label: 'Mean Period (days)', type: 'number', default: 20, constraints: { min: 5, max: 100 }, helpText: 'Period for calculating moving average' },
            { key: 'deviationMultiple', label: 'Std Dev Multiple', type: 'range', default: 2, constraints: { min: 1, max: 4, step: 0.25 }, helpText: 'Z-score threshold for signals' },
            { key: 'indicator', label: 'Indicator', type: 'select', default: 'bollinger', constraints: { options: [{ value: 'bollinger', label: 'Bollinger Bands' }, { value: 'zscore', label: 'Z-Score' }, { value: 'rsi', label: 'RSI' }] }, helpText: 'Primary mean reversion indicator' }
          ],
          advancedFields: [
            { key: 'rsiOversold', label: 'RSI Oversold', type: 'number', default: 30, constraints: { min: 10, max: 40 }, helpText: 'RSI level for oversold' },
            { key: 'rsiOverbought', label: 'RSI Overbought', type: 'number', default: 70, constraints: { min: 60, max: 90 }, helpText: 'RSI level for overbought' }
          ]
        },
        {
          id: 'position',
          title: 'Position Sizing',
          description: 'Define position sizing rules',
          fields: [
            { key: 'maxPositions', label: 'Max Positions', type: 'number', default: 4, constraints: { min: 1, max: 20 }, helpText: 'Maximum concurrent positions' },
            { key: 'positionSize', label: 'Position Size (%)', type: 'range', default: 20, constraints: { min: 5, max: 50, step: 5 }, helpText: 'Size per position' },
            { key: 'scalingMode', label: 'Scaling Mode', type: 'select', default: 'fixed', constraints: { options: [{ value: 'fixed', label: 'Fixed Size' }, { value: 'pyramiding', label: 'Pyramiding' }, { value: 'kelly', label: 'Kelly Criterion' }] }, helpText: 'How to scale into positions' }
          ],
          advancedFields: [
            { key: 'pyramidLevels', label: 'Pyramid Levels', type: 'number', default: 3, constraints: { min: 1, max: 5 }, helpText: 'Number of scale-in levels' }
          ]
        },
        {
          id: 'risk',
          title: 'Risk Management',
          description: 'Configure exits and risk controls',
          fields: [
            { key: 'stopLoss', label: 'Stop Loss (%)', type: 'range', default: 5, constraints: { min: 2, max: 15, step: 0.5 }, helpText: 'Maximum loss per position' },
            { key: 'meanRevertTarget', label: 'Mean Revert Target', type: 'select', default: 'mean', constraints: { options: [{ value: 'mean', label: 'Back to Mean' }, { value: 'opposite', label: 'Opposite Band' }, { value: 'partial', label: 'Partial Mean' }] }, helpText: 'Where to take profit' },
            { key: 'maxHoldingDays', label: 'Max Holding Days', type: 'number', default: 10, constraints: { min: 1, max: 60 }, helpText: 'Time-based exit' }
          ],
          advancedFields: [
            { key: 'useVolRegime', label: 'Volatility Regime Filter', type: 'toggle', default: true, helpText: 'Pause in high volatility' }
          ]
        }
      ]
    },
    presets: [
      { id: 'conservative', name: 'Conservative', description: 'Wider bands, tighter stops, fewer trades', valuesByFieldKey: { meanPeriod: 30, deviationMultiple: 2.5, maxPositions: 2, positionSize: 15, stopLoss: 3, maxHoldingDays: 5 } },
      { id: 'balanced', name: 'Balanced', description: 'Standard mean reversion parameters', valuesByFieldKey: { meanPeriod: 20, deviationMultiple: 2, maxPositions: 4, positionSize: 20, stopLoss: 5, maxHoldingDays: 10 } },
      { id: 'aggressive', name: 'Aggressive', description: 'Tighter bands, more trades, longer holds', valuesByFieldKey: { meanPeriod: 10, deviationMultiple: 1.5, maxPositions: 6, positionSize: 25, stopLoss: 8, maxHoldingDays: 20 } },
      { id: 'custom', name: 'Custom', description: 'Configure all parameters manually', valuesByFieldKey: {} }
    ]
  },
  {
    id: 'pairs-trading',
    name: 'Pairs Trading',
    description: 'Market-neutral strategy that trades the spread between correlated securities. Profits from relative price movements while minimizing market exposure.',
    difficulty: 'Advanced',
    icon: 'GitCompare',
    stepSchema: {
      steps: [
        {
          id: 'pairs',
          title: 'Select Pairs',
          description: 'Choose correlated pairs to trade',
          fields: [
            { key: 'pairType', label: 'Pair Type', type: 'select', default: 'sector', constraints: { options: [{ value: 'sector', label: 'Same Sector' }, { value: 'etf-stock', label: 'ETF vs Stock' }, { value: 'geographic', label: 'Geographic Pairs' }] }, helpText: 'Type of pair relationship' },
            { key: 'pairs', label: 'Trading Pairs', type: 'multi-select', default: ['KO-PEP', 'XOM-CVX'], constraints: { options: [{ value: 'KO-PEP', label: 'KO / PEP' }, { value: 'XOM-CVX', label: 'XOM / CVX' }, { value: 'JPM-BAC', label: 'JPM / BAC' }, { value: 'MSFT-AAPL', label: 'MSFT / AAPL' }, { value: 'GLD-SLV', label: 'GLD / SLV' }] }, helpText: 'Select pairs to trade' }
          ],
          advancedFields: [
            { key: 'minCorrelation', label: 'Min Correlation', type: 'range', default: 0.8, constraints: { min: 0.5, max: 1, step: 0.05 }, helpText: 'Minimum correlation requirement' },
            { key: 'cointegrationTest', label: 'Cointegration Test', type: 'toggle', default: true, helpText: 'Require cointegration for pairs' }
          ]
        },
        {
          id: 'signals',
          title: 'Spread Signals',
          description: 'Configure spread trading signals',
          fields: [
            { key: 'spreadCalc', label: 'Spread Calculation', type: 'select', default: 'ratio', constraints: { options: [{ value: 'ratio', label: 'Price Ratio' }, { value: 'difference', label: 'Price Difference' }, { value: 'hedged', label: 'Hedge Ratio' }] }, helpText: 'How to calculate spread' },
            { key: 'lookback', label: 'Lookback Window', type: 'number', default: 60, constraints: { min: 20, max: 252 }, helpText: 'Days for spread statistics' },
            { key: 'entryZScore', label: 'Entry Z-Score', type: 'range', default: 2, constraints: { min: 1, max: 4, step: 0.25 }, helpText: 'Z-score threshold to enter' },
            { key: 'exitZScore', label: 'Exit Z-Score', type: 'range', default: 0.5, constraints: { min: 0, max: 1.5, step: 0.25 }, helpText: 'Z-score threshold to exit' }
          ],
          advancedFields: [
            { key: 'dynamicHedge', label: 'Dynamic Hedge Ratio', type: 'toggle', default: false, helpText: 'Recalculate hedge ratio periodically' },
            { key: 'hedgeWindow', label: 'Hedge Recalc Window', type: 'number', default: 20, constraints: { min: 5, max: 60 }, helpText: 'Days between hedge recalculations' }
          ]
        },
        {
          id: 'position',
          title: 'Position Sizing',
          description: 'Configure pair position sizes',
          fields: [
            { key: 'maxPairs', label: 'Max Active Pairs', type: 'number', default: 3, constraints: { min: 1, max: 10 }, helpText: 'Maximum concurrent pair trades' },
            { key: 'pairAllocation', label: 'Allocation per Pair (%)', type: 'range', default: 30, constraints: { min: 10, max: 50, step: 5 }, helpText: 'Capital allocated per pair' },
            { key: 'leverageMultiple', label: 'Leverage', type: 'select', default: '1x', constraints: { options: [{ value: '1x', label: '1x (No Leverage)' }, { value: '1.5x', label: '1.5x' }, { value: '2x', label: '2x' }] }, helpText: 'Leverage for pair trades' }
          ],
          advancedFields: [
            { key: 'rebalanceOnDrift', label: 'Rebalance on Drift', type: 'toggle', default: true, helpText: 'Rebalance when hedge drifts' },
            { key: 'driftThreshold', label: 'Drift Threshold (%)', type: 'number', default: 10, constraints: { min: 5, max: 25 }, helpText: 'Rebalance trigger' }
          ]
        },
        {
          id: 'risk',
          title: 'Risk Controls',
          description: 'Set risk limits for pair trades',
          fields: [
            { key: 'stopLossZScore', label: 'Stop Loss Z-Score', type: 'range', default: 4, constraints: { min: 2.5, max: 6, step: 0.5 }, helpText: 'Exit if spread diverges further' },
            { key: 'maxLossPct', label: 'Max Loss per Pair (%)', type: 'range', default: 5, constraints: { min: 2, max: 15, step: 1 }, helpText: 'Maximum loss per pair trade' },
            { key: 'maxHoldingDays', label: 'Max Holding Period', type: 'number', default: 30, constraints: { min: 5, max: 90 }, helpText: 'Time-based exit' }
          ],
          advancedFields: [
            { key: 'correlationBreakExit', label: 'Exit on Correlation Break', type: 'toggle', default: true, helpText: 'Exit if correlation breaks down' },
            { key: 'minCorrelationExit', label: 'Min Correlation for Exit', type: 'range', default: 0.6, constraints: { min: 0.3, max: 0.8, step: 0.1 }, helpText: 'Correlation threshold to exit' }
          ]
        }
      ]
    },
    presets: [
      { id: 'conservative', name: 'Conservative', description: 'Wide entry, tight stops, single pair', valuesByFieldKey: { entryZScore: 2.5, exitZScore: 0.25, maxPairs: 1, pairAllocation: 20, stopLossZScore: 3.5, maxLossPct: 3 } },
      { id: 'balanced', name: 'Balanced', description: 'Standard statistical arbitrage', valuesByFieldKey: { entryZScore: 2, exitZScore: 0.5, maxPairs: 3, pairAllocation: 30, stopLossZScore: 4, maxLossPct: 5 } },
      { id: 'aggressive', name: 'Aggressive', description: 'Tighter entry, multiple pairs, leverage', valuesByFieldKey: { entryZScore: 1.5, exitZScore: 0.75, maxPairs: 5, pairAllocation: 40, stopLossZScore: 5, maxLossPct: 8, leverageMultiple: '1.5x' } },
      { id: 'custom', name: 'Custom', description: 'Configure all parameters manually', valuesByFieldKey: {} }
    ]
  },
  {
    id: 'ml-sentiment',
    name: 'ML Sentiment',
    description: 'Uses machine learning to analyze news, social media, and market sentiment. Generates signals based on NLP sentiment scores and momentum.',
    difficulty: 'Advanced',
    icon: 'Brain',
    stepSchema: {
      steps: [
        {
          id: 'universe',
          title: 'Asset Universe',
          description: 'Select assets for sentiment analysis',
          fields: [
            { key: 'assetClass', label: 'Asset Class', type: 'select', default: 'large-cap', constraints: { options: [{ value: 'large-cap', label: 'Large Cap Stocks' }, { value: 'crypto', label: 'Cryptocurrencies' }, { value: 'sectors', label: 'Sector ETFs' }] }, helpText: 'Primary asset class' },
            { key: 'symbols', label: 'Symbols', type: 'multi-select', default: ['AAPL', 'TSLA', 'NVDA'], constraints: { options: [{ value: 'AAPL', label: 'AAPL' }, { value: 'TSLA', label: 'TSLA' }, { value: 'NVDA', label: 'NVDA' }, { value: 'AMD', label: 'AMD' }, { value: 'AMZN', label: 'AMZN' }, { value: 'GOOGL', label: 'GOOGL' }] }, helpText: 'Symbols to track sentiment' }
          ],
          advancedFields: [
            { key: 'includePeers', label: 'Include Peer Sentiment', type: 'toggle', default: true, helpText: 'Factor in peer company sentiment' }
          ]
        },
        {
          id: 'sources',
          title: 'Data Sources',
          description: 'Configure sentiment data sources',
          fields: [
            { key: 'newsWeight', label: 'News Weight (%)', type: 'range', default: 40, constraints: { min: 0, max: 100, step: 10 }, helpText: 'Weight for news sentiment' },
            { key: 'socialWeight', label: 'Social Media Weight (%)', type: 'range', default: 30, constraints: { min: 0, max: 100, step: 10 }, helpText: 'Weight for social sentiment' },
            { key: 'analystWeight', label: 'Analyst Weight (%)', type: 'range', default: 30, constraints: { min: 0, max: 100, step: 10 }, helpText: 'Weight for analyst sentiment' }
          ],
          advancedFields: [
            { key: 'minConfidence', label: 'Min AI Confidence', type: 'range', default: 0.7, constraints: { min: 0.5, max: 0.95, step: 0.05 }, helpText: 'Minimum confidence for signals' },
            { key: 'lookbackHours', label: 'Lookback Window (hours)', type: 'number', default: 24, constraints: { min: 1, max: 168 }, helpText: 'Hours of data to analyze' }
          ]
        },
        {
          id: 'signals',
          title: 'Signal Logic',
          description: 'Configure how sentiment generates signals',
          fields: [
            { key: 'signalThreshold', label: 'Signal Threshold', type: 'range', default: 0.6, constraints: { min: 0.3, max: 0.9, step: 0.05 }, helpText: 'Minimum score for signal' },
            { key: 'momentumConfirm', label: 'Require Momentum Confirmation', type: 'toggle', default: true, helpText: 'Wait for price momentum to confirm' },
            { key: 'signalDecay', label: 'Signal Decay (hours)', type: 'number', default: 48, constraints: { min: 6, max: 168 }, helpText: 'How long signals remain valid' }
          ],
          advancedFields: [
            { key: 'contrarian', label: 'Contrarian Mode', type: 'toggle', default: false, helpText: 'Trade against extreme sentiment' },
            { key: 'extremeThreshold', label: 'Extreme Sentiment Threshold', type: 'range', default: 0.9, constraints: { min: 0.8, max: 0.99, step: 0.01 }, helpText: 'Level for contrarian signals' }
          ]
        },
        {
          id: 'position',
          title: 'Position Sizing',
          description: 'Configure position sizing',
          fields: [
            { key: 'maxPositions', label: 'Max Positions', type: 'number', default: 5, constraints: { min: 1, max: 20 }, helpText: 'Maximum concurrent positions' },
            { key: 'positionSize', label: 'Base Position Size (%)', type: 'range', default: 10, constraints: { min: 5, max: 25, step: 2.5 }, helpText: 'Base position size' },
            { key: 'confidenceScaling', label: 'Scale by Confidence', type: 'toggle', default: true, helpText: 'Larger positions for higher confidence' }
          ],
          advancedFields: []
        },
        {
          id: 'risk',
          title: 'Risk Management',
          description: 'Set risk controls',
          fields: [
            { key: 'stopLoss', label: 'Stop Loss (%)', type: 'range', default: 7, constraints: { min: 3, max: 20, step: 1 }, helpText: 'Maximum loss per position' },
            { key: 'sentimentReversal', label: 'Exit on Sentiment Reversal', type: 'toggle', default: true, helpText: 'Exit if sentiment reverses' },
            { key: 'maxHoldingDays', label: 'Max Holding Days', type: 'number', default: 14, constraints: { min: 1, max: 60 }, helpText: 'Time-based exit' }
          ],
          advancedFields: [
            { key: 'volatilityAdjust', label: 'Volatility Adjustment', type: 'toggle', default: true, helpText: 'Reduce size in high volatility' }
          ]
        }
      ]
    },
    presets: [
      { id: 'conservative', name: 'Conservative', description: 'High confidence only, slower decay', valuesByFieldKey: { signalThreshold: 0.75, maxPositions: 3, positionSize: 7.5, stopLoss: 5, maxHoldingDays: 7, minConfidence: 0.8 } },
      { id: 'balanced', name: 'Balanced', description: 'Standard sentiment trading', valuesByFieldKey: { signalThreshold: 0.6, maxPositions: 5, positionSize: 10, stopLoss: 7, maxHoldingDays: 14, minConfidence: 0.7 } },
      { id: 'aggressive', name: 'Aggressive', description: 'Lower threshold, faster signals', valuesByFieldKey: { signalThreshold: 0.5, maxPositions: 8, positionSize: 12.5, stopLoss: 10, maxHoldingDays: 21, minConfidence: 0.6 } },
      { id: 'custom', name: 'Custom', description: 'Configure all parameters manually', valuesByFieldKey: {} }
    ]
  }
];
