import {
  Strategy, BacktestRun, Deployment, PortfolioSnapshot,
  LedgerEntry, AiEvent, FeedSource, SentimentSignal,
  Watchlist, UserSettings, BacktestMetrics, Interpretation,
  BacktestChartSeries, ChartDataPoint
} from '@/lib/types';

const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM', 'SPY', 'QQQ'];
const strategyNames = ['Alpha Momentum', 'Beta Reversion', 'Gamma Pairs', 'Delta Sentiment'];

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

export function generateEquityCurve(days: number, startValue: number, cagr: number, volatility: number): ChartDataPoint[] {
  const points: ChartDataPoint[] = [];
  let value = startValue;
  const dailyReturn = Math.pow(1 + cagr, 1 / 252) - 1;
  const dailyVol = volatility / Math.sqrt(252);

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    points.push({ date: date.toISOString().split('T')[0], value: Math.round(value * 100) / 100 });
    const randomReturn = dailyReturn + (Math.random() - 0.5) * 2 * dailyVol;
    value *= (1 + randomReturn);
  }
  return points;
}

export function generateDrawdownSeries(equityCurve: ChartDataPoint[]): ChartDataPoint[] {
  let peak = equityCurve[0].value;
  return equityCurve.map(point => {
    if (point.value > peak) peak = point.value;
    const drawdown = ((point.value - peak) / peak) * 100;
    return { date: point.date, value: Math.round(drawdown * 100) / 100 };
  });
}

export function generateReturnsSeries(equityCurve: ChartDataPoint[]): ChartDataPoint[] {
  return equityCurve.slice(1).map((point, i) => {
    const prevValue = equityCurve[i].value;
    const returnPct = ((point.value - prevValue) / prevValue) * 100;
    return { date: point.date, value: Math.round(returnPct * 100) / 100 };
  });
}

export function generateBacktestMetrics(configValues: Record<string, unknown>): BacktestMetrics {
  const stopLoss = (configValues.stopLoss as number) || 8;
  const positionSize = (configValues.positionSize as number) || 10;
  const maxPositions = (configValues.maxPositions as number) || 10;

  const riskFactor = (stopLoss / 10) * (positionSize / 10) * (maxPositions / 10);
  const baseSharpe = 1.2 + (Math.random() - 0.5) * 0.8;
  const adjustedSharpe = baseSharpe * (1 - riskFactor * 0.1);

  return {
    cagr: randomBetween(8, 35) * (1 + riskFactor * 0.2),
    sharpe: Math.max(0.3, adjustedSharpe),
    maxDrawdown: randomBetween(8, 25) * (1 + riskFactor * 0.3),
    volatility: randomBetween(10, 25) * (1 + riskFactor * 0.2),
    winRate: randomBetween(45, 65),
    exposure: randomBetween(50, 90),
    totalTrades: randomInt(50, 500),
    profitFactor: randomBetween(1.2, 2.5),
    avgWin: randomBetween(2, 8),
    avgLoss: randomBetween(1, 5)
  };
}

export function generateInterpretation(metrics: BacktestMetrics, configValues: Record<string, unknown>): Interpretation {
  const strengths: string[] = [];
  const risks: string[] = [];
  const suggestedEdits: Interpretation['suggestedEdits'] = [];

  if (metrics.sharpe > 1.0) {
    strengths.push('Strong risk-adjusted returns with Sharpe ratio above 1.0, indicating efficient use of capital');
  }
  if (metrics.winRate > 55) {
    strengths.push(`Solid win rate of ${metrics.winRate.toFixed(1)}% suggests reliable signal generation`);
  }
  if (metrics.profitFactor > 1.5) {
    strengths.push('Favorable profit factor indicates winning trades significantly outweigh losses');
  }
  if (metrics.maxDrawdown < 15) {
    strengths.push('Conservative drawdown profile suitable for capital preservation');
  }

  if (metrics.maxDrawdown > 20) {
    risks.push(`Maximum drawdown of ${metrics.maxDrawdown.toFixed(1)}% may be uncomfortable during adverse periods`);
    const stopLossVal = (configValues.stopLoss as number) || 8;
    suggestedEdits.push({
      fieldKey: 'stopLoss',
      currentValue: stopLossVal,
      suggestedValue: Math.max(3, stopLossVal - 2),
      rationale: 'Tighter stop losses could reduce maximum drawdown by 15-20%'
    });
  }
  if (metrics.sharpe < 0.8) {
    risks.push('Below-average risk-adjusted returns may not justify the volatility');
  }
  if (metrics.volatility > 20) {
    risks.push('High volatility could lead to significant short-term losses');
    const positionSizeVal = (configValues.positionSize as number) || 10;
    suggestedEdits.push({
      fieldKey: 'positionSize',
      currentValue: positionSizeVal,
      suggestedValue: Math.max(5, positionSizeVal - 3),
      rationale: 'Smaller position sizes would reduce portfolio volatility'
    });
  }
  if (metrics.exposure > 80) {
    risks.push('High market exposure limits flexibility during market stress');
  }

  if (strengths.length === 0) {
    strengths.push('Strategy shows consistent execution across varying market conditions');
  }
  if (risks.length === 0) {
    risks.push('Performance may vary in future market regimes not captured in backtest');
  }

  const summaryParts = [
    `This strategy achieved a ${metrics.cagr.toFixed(1)}% CAGR with a Sharpe ratio of ${metrics.sharpe.toFixed(2)}.`,
    metrics.sharpe > 1 ? 'The risk-adjusted performance is strong.' : 'Risk-adjusted returns are moderate.',
    `Maximum drawdown reached ${metrics.maxDrawdown.toFixed(1)}%, which is ${metrics.maxDrawdown < 15 ? 'conservative' : metrics.maxDrawdown < 25 ? 'moderate' : 'aggressive'} for this strategy type.`,
    `With a ${metrics.winRate.toFixed(0)}% win rate and ${metrics.profitFactor.toFixed(2)} profit factor, the strategy demonstrates ${metrics.profitFactor > 1.5 ? 'solid' : 'acceptable'} trade selection.`
  ];

  return {
    summary: summaryParts.join(' '),
    strengths,
    risks,
    suggestedEdits
  };
}

export function generateLedgerEntries(strategyId: string, strategyName: string, count: number): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  for (let i = 0; i < count; i++) {
    const symbol = randomChoice(symbols);
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const qty = randomInt(10, 500);
    const price = randomBetween(50, 500);

    entries.push({
      id: generateId(),
      time: generateDate(randomInt(0, 30)),
      symbol,
      side,
      qty,
      price: Math.round(price * 100) / 100,
      fee: Math.round(qty * price * 0.0001 * 100) / 100,
      status: 'filled',
      strategyId,
      strategyName,
      realizedPnl: side === 'sell' ? Math.round(randomBetween(-500, 1000) * 100) / 100 : undefined,
      unrealizedPnl: side === 'buy' ? Math.round(randomBetween(-300, 600) * 100) / 100 : undefined
    });
  }

  return entries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export function generateAiEvents(strategies: { id: string; name: string }[]): AiEvent[] {
  const eventTypes: AiEvent['type'][] = ['signal', 'sentiment', 'news', 'risk', 'suggestion'];
  const headlines = {
    signal: ['Strong momentum detected', 'Breakout signal triggered', 'Mean reversion opportunity', 'Pairs spread widening'],
    sentiment: ['Sentiment shift detected', 'Social buzz increasing', 'Analyst upgrade wave', 'Negative sentiment spike'],
    news: ['Earnings surprise impact', 'Sector rotation signal', 'Macro event processing', 'Fed policy implications'],
    risk: ['Volatility spike alert', 'Correlation breakdown', 'Drawdown warning', 'Exposure limit approaching'],
    suggestion: ['Consider position reduction', 'Optimal rebalance timing', 'Risk adjustment recommended', 'Take profit opportunity']
  };

  const events: AiEvent[] = [];

  for (let i = 0; i < 20; i++) {
    const type = randomChoice(eventTypes);
    const headline = randomChoice(headlines[type]);
    const symbol = randomChoice(symbols);
    const impacted = strategies.length > 0 ? [randomChoice(strategies)] : [];

    events.push({
      id: generateId(),
      time: generateDate(randomInt(0, 7)),
      type,
      headline,
      explanation: `${headline} for ${symbol}. Our AI models detected a significant ${type === 'signal' ? 'trading opportunity' : type === 'sentiment' ? 'shift in market sentiment' : type === 'news' ? 'news-driven catalyst' : type === 'risk' ? 'risk factor' : 'optimization opportunity'}. Confidence level is based on historical pattern recognition and current market conditions.`,
      confidence: randomBetween(0.6, 0.95),
      impactedStrategies: impacted,
      symbol,
      action: type === 'signal' ? (Math.random() > 0.5 ? 'BUY' : 'SELL') : undefined
    });
  }

  return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export function generateFeedSources(): FeedSource[] {
  return [
    { id: '1', name: 'Reuters News', category: 'news', status: 'active', lastUpdate: generateDate(0) },
    { id: '2', name: 'Bloomberg Terminal', category: 'news', status: 'active', lastUpdate: generateDate(0) },
    { id: '3', name: 'Twitter/X Firehose', category: 'social', status: 'active', lastUpdate: generateDate(0) },
    { id: '4', name: 'Reddit WallStreetBets', category: 'social', status: 'delayed', lastUpdate: generateDate(0) },
    { id: '5', name: 'SEC Filings', category: 'fundamental', status: 'active', lastUpdate: generateDate(1) },
    { id: '6', name: 'Options Flow', category: 'market', status: 'active', lastUpdate: generateDate(0) },
    { id: '7', name: 'Dark Pool Prints', category: 'market', status: 'active', lastUpdate: generateDate(0) },
    { id: '8', name: 'Analyst Reports', category: 'fundamental', status: 'active', lastUpdate: generateDate(0) }
  ];
}

export function generateSentimentSignals(): SentimentSignal[] {
  const sources = generateFeedSources();
  return symbols.slice(0, 6).map(symbol => ({
    id: generateId(),
    sourceId: randomChoice(sources).id,
    sourceName: randomChoice(sources).name,
    symbol,
    score: randomBetween(-1, 1),
    trend: randomChoice(['up', 'down', 'neutral'] as const),
    explanation: `${symbol} sentiment ${randomChoice(['improving', 'declining', 'stable'])} based on recent ${randomChoice(['news flow', 'social mentions', 'analyst coverage', 'options activity'])}.`,
    timestamp: generateDate(0)
  }));
}

export function generatePortfolioSnapshot(strategies: Strategy[]): PortfolioSnapshot {
  const activeStrategies = strategies.filter(s => s.status === 'Deployed');
  const baseEquity = 100000;
  const equity = baseEquity + randomBetween(-5000, 15000);
  const dayPL = randomBetween(-2000, 3000);

  return {
    equity: Math.round(equity * 100) / 100,
    cash: Math.round(equity * randomBetween(0.1, 0.3) * 100) / 100,
    exposure: randomBetween(60, 90),
    dayPL: Math.round(dayPL * 100) / 100,
    dayPLPercent: Math.round((dayPL / equity) * 10000) / 100,
    weekPL: Math.round(randomBetween(-3000, 5000) * 100) / 100,
    monthPL: Math.round(randomBetween(-5000, 10000) * 100) / 100,
    drawdown: randomBetween(2, 12),
    allocations: symbols.slice(0, 5).map(symbol => ({
      symbol,
      name: `${symbol} Corp`,
      weight: randomBetween(5, 25),
      value: Math.round(equity * randomBetween(0.05, 0.25) * 100) / 100,
      pnl: Math.round(randomBetween(-500, 1000) * 100) / 100,
      pnlPercent: randomBetween(-5, 10)
    })),
    timestamp: new Date().toISOString()
  };
}

export function generateWatchlists(): Watchlist[] {
  return [
    {
      id: '1',
      name: 'Tech Leaders',
      items: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META'].map(symbol => ({
        symbol,
        name: `${symbol} Inc`,
        price: randomBetween(100, 500),
        change: randomBetween(-10, 15),
        changePercent: randomBetween(-3, 5),
        tags: ['tech', 'large-cap'],
        eligible: true
      })),
      createdAt: generateDate(30)
    },
    {
      id: '2',
      name: 'ETF Universe',
      items: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE'].map(symbol => ({
        symbol,
        name: `${symbol} ETF`,
        price: randomBetween(50, 500),
        change: randomBetween(-5, 8),
        changePercent: randomBetween(-2, 3),
        tags: ['etf', 'liquid'],
        eligible: true
      })),
      createdAt: generateDate(20)
    }
  ];
}

export const defaultUserSettings: UserSettings = {
  theme: 'dark',
  notifications: {
    trades: true,
    aiAlerts: true,
    riskWarnings: true,
    dailyDigest: false
  },
  riskGuardrails: {
    maxPositionSize: 25,
    maxDrawdown: 20,
    maxDailyLoss: 5,
    requireConfirmation: true
  }
};
