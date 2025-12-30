#!/usr/bin/env npx tsx
/**
 * Background Portfolio Monitor
 *
 * Continuously monitors portfolio for risk threshold breaches.
 * Runs as a background process and outputs alerts to console/Slack/email.
 *
 * Usage:
 *   npx tsx scripts/background-monitor.ts
 *   nohup npx tsx scripts/background-monitor.ts > /tmp/monitor.log 2>&1 &
 */

import 'dotenv/config';

// Configuration from environment
const config = {
  ALPACA_API_KEY: process.env.ALPACA_API_KEY || '',
  ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY || '',
  ALPACA_BASE_URL: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:5000',
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || '',

  // Thresholds
  MAX_POSITION_PCT: parseFloat(process.env.MAX_POSITION_PCT || '5'),
  MAX_SECTOR_PCT: parseFloat(process.env.MAX_SECTOR_PCT || '25'),
  MAX_DAILY_DRAWDOWN: parseFloat(process.env.MAX_DAILY_DRAWDOWN || '5'),
  WARNING_THRESHOLD: parseFloat(process.env.WARNING_THRESHOLD || '80'),

  // Intervals (ms)
  POSITION_CHECK_INTERVAL: 60000,   // 60 seconds
  SECTOR_CHECK_INTERVAL: 300000,    // 5 minutes
  DRAWDOWN_CHECK_INTERVAL: 60000,   // 60 seconds
  CIRCUIT_BREAKER_INTERVAL: 30000,  // 30 seconds
};

// Sector mappings
const SECTOR_MAP: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', GOOG: 'Technology',
  META: 'Technology', NVDA: 'Technology', AMD: 'Technology', INTC: 'Technology',
  JPM: 'Financial', BAC: 'Financial', GS: 'Financial', MS: 'Financial',
  JNJ: 'Healthcare', UNH: 'Healthcare', PFE: 'Healthcare', MRK: 'Healthcare',
  AMZN: 'Consumer', TSLA: 'Consumer', HD: 'Consumer', WMT: 'Consumer',
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy',
  SPY: 'ETF-Broad', QQQ: 'ETF-Tech', IWM: 'ETF-SmallCap',
};

// State
let peakEquity = 0;
let lastAlerts: Map<string, number> = new Map();
const ALERT_COOLDOWN = 300000; // 5 minutes between repeated alerts

interface Position {
  symbol: string;
  qty: string;
  market_value: string;
  unrealized_pl: string;
}

interface Account {
  equity: string;
  buying_power: string;
  last_equity: string;
}

interface Alert {
  timestamp: string;
  severity: 'WARNING' | 'CRITICAL';
  category: string;
  message: string;
  currentValue: number;
  threshold: number;
  recommendedAction: string;
}

// Helper: Fetch from Alpaca
async function alpacaFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${config.ALPACA_BASE_URL}${endpoint}`, {
    headers: {
      'APCA-API-KEY-ID': config.ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': config.ALPACA_SECRET_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Alpaca API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Helper: Send alert
async function sendAlert(alert: Alert): Promise<void> {
  // Check cooldown
  const alertKey = `${alert.category}:${alert.message}`;
  const lastAlertTime = lastAlerts.get(alertKey) || 0;
  if (Date.now() - lastAlertTime < ALERT_COOLDOWN) {
    return; // Skip - recently alerted
  }
  lastAlerts.set(alertKey, Date.now());

  // Console output
  const severityIcon = alert.severity === 'CRITICAL' ? '🔴' : '🟡';
  console.log(`\n${severityIcon} [${alert.severity}] ${alert.timestamp}`);
  console.log(`   Category: ${alert.category}`);
  console.log(`   Message: ${alert.message}`);
  console.log(`   Current: ${alert.currentValue.toFixed(2)}% | Threshold: ${alert.threshold}%`);
  console.log(`   Action: ${alert.recommendedAction}`);

  // Slack notification (if configured)
  if (config.SLACK_WEBHOOK_URL) {
    try {
      await fetch(config.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${severityIcon} *${alert.severity}*: ${alert.message}`,
          attachments: [{
            color: alert.severity === 'CRITICAL' ? 'danger' : 'warning',
            fields: [
              { title: 'Category', value: alert.category, short: true },
              { title: 'Current', value: `${alert.currentValue.toFixed(2)}%`, short: true },
              { title: 'Threshold', value: `${alert.threshold}%`, short: true },
              { title: 'Action', value: alert.recommendedAction, short: false },
            ],
          }],
        }),
      });
    } catch (e) {
      console.error('Failed to send Slack alert:', e);
    }
  }
}

// Check: Position Concentration
async function checkPositionConcentration(): Promise<void> {
  try {
    const [account, positions] = await Promise.all([
      alpacaFetch<Account>('/v2/account'),
      alpacaFetch<Position[]>('/v2/positions'),
    ]);

    const equity = parseFloat(account.equity);
    peakEquity = Math.max(peakEquity, equity);

    for (const pos of positions) {
      const marketValue = Math.abs(parseFloat(pos.market_value));
      const concentration = (marketValue / equity) * 100;

      const warningThreshold = config.MAX_POSITION_PCT * (config.WARNING_THRESHOLD / 100);

      if (concentration >= config.MAX_POSITION_PCT) {
        await sendAlert({
          timestamp: new Date().toISOString(),
          severity: 'CRITICAL',
          category: 'concentration',
          message: `Position ${pos.symbol} exceeds ${config.MAX_POSITION_PCT}% limit`,
          currentValue: concentration,
          threshold: config.MAX_POSITION_PCT,
          recommendedAction: `Reduce ${pos.symbol} position by ${Math.ceil(parseFloat(pos.qty) * 0.2)} shares`,
        });
      } else if (concentration >= warningThreshold) {
        await sendAlert({
          timestamp: new Date().toISOString(),
          severity: 'WARNING',
          category: 'concentration',
          message: `Position ${pos.symbol} approaching ${config.MAX_POSITION_PCT}% limit`,
          currentValue: concentration,
          threshold: config.MAX_POSITION_PCT,
          recommendedAction: 'Monitor position - consider trimming on next rally',
        });
      }
    }
  } catch (e) {
    console.error('Position check failed:', e);
  }
}

// Check: Sector Exposure
async function checkSectorExposure(): Promise<void> {
  try {
    const [account, positions] = await Promise.all([
      alpacaFetch<Account>('/v2/account'),
      alpacaFetch<Position[]>('/v2/positions'),
    ]);

    const equity = parseFloat(account.equity);
    const sectorExposure: Record<string, number> = {};

    for (const pos of positions) {
      const sector = SECTOR_MAP[pos.symbol] || 'Other';
      const marketValue = Math.abs(parseFloat(pos.market_value));
      sectorExposure[sector] = (sectorExposure[sector] || 0) + marketValue;
    }

    for (const [sector, value] of Object.entries(sectorExposure)) {
      const exposure = (value / equity) * 100;
      const warningThreshold = config.MAX_SECTOR_PCT * (config.WARNING_THRESHOLD / 100);

      if (exposure >= config.MAX_SECTOR_PCT) {
        await sendAlert({
          timestamp: new Date().toISOString(),
          severity: 'CRITICAL',
          category: 'sector',
          message: `Sector ${sector} exceeds ${config.MAX_SECTOR_PCT}% limit`,
          currentValue: exposure,
          threshold: config.MAX_SECTOR_PCT,
          recommendedAction: `Diversify out of ${sector} - consider other sectors`,
        });
      } else if (exposure >= warningThreshold) {
        await sendAlert({
          timestamp: new Date().toISOString(),
          severity: 'WARNING',
          category: 'sector',
          message: `Sector ${sector} approaching ${config.MAX_SECTOR_PCT}% limit`,
          currentValue: exposure,
          threshold: config.MAX_SECTOR_PCT,
          recommendedAction: 'Review sector allocation for rebalancing',
        });
      }
    }
  } catch (e) {
    console.error('Sector check failed:', e);
  }
}

// Check: Daily Drawdown
async function checkDrawdown(): Promise<void> {
  try {
    const account = await alpacaFetch<Account>('/v2/account');
    const equity = parseFloat(account.equity);
    const lastEquity = parseFloat(account.last_equity);

    // Update peak
    peakEquity = Math.max(peakEquity, lastEquity);

    // Calculate drawdown from today's open
    const dailyDrawdown = ((lastEquity - equity) / lastEquity) * 100;
    const warningThreshold = config.MAX_DAILY_DRAWDOWN * (config.WARNING_THRESHOLD / 100);

    if (dailyDrawdown >= config.MAX_DAILY_DRAWDOWN) {
      await sendAlert({
        timestamp: new Date().toISOString(),
        severity: 'CRITICAL',
        category: 'drawdown',
        message: `Daily drawdown exceeds ${config.MAX_DAILY_DRAWDOWN}% limit`,
        currentValue: dailyDrawdown,
        threshold: config.MAX_DAILY_DRAWDOWN,
        recommendedAction: 'HALT TRADING - Review positions and consider closing losers',
      });
    } else if (dailyDrawdown >= warningThreshold) {
      await sendAlert({
        timestamp: new Date().toISOString(),
        severity: 'WARNING',
        category: 'drawdown',
        message: `Daily drawdown approaching ${config.MAX_DAILY_DRAWDOWN}% limit`,
        currentValue: dailyDrawdown,
        threshold: config.MAX_DAILY_DRAWDOWN,
        recommendedAction: 'Reduce position sizes and avoid new trades',
      });
    }
  } catch (e) {
    console.error('Drawdown check failed:', e);
  }
}

// Check: Circuit Breaker
async function checkCircuitBreaker(): Promise<void> {
  try {
    const response = await fetch(`${config.SERVER_URL}/api/alpaca/circuit-breaker/status`);
    if (!response.ok) return;

    const data = await response.json() as { isOpen: boolean; failureCount?: number };

    if (data.isOpen) {
      await sendAlert({
        timestamp: new Date().toISOString(),
        severity: 'CRITICAL',
        category: 'circuit_breaker',
        message: 'Circuit breaker is OPEN - trading suspended',
        currentValue: data.failureCount || 0,
        threshold: 5,
        recommendedAction: 'Wait for auto-reset (60s) or manually reset via API',
      });
    }
  } catch {
    // Server might be down - not critical
  }
}

// Main monitoring loop
async function startMonitoring(): Promise<void> {
  console.log('========================================');
  console.log('  Background Portfolio Monitor Started');
  console.log('========================================');
  console.log(`  Max Position: ${config.MAX_POSITION_PCT}%`);
  console.log(`  Max Sector: ${config.MAX_SECTOR_PCT}%`);
  console.log(`  Max Daily Drawdown: ${config.MAX_DAILY_DRAWDOWN}%`);
  console.log(`  Warning at: ${config.WARNING_THRESHOLD}% of limits`);
  console.log('========================================\n');

  // Initial checks
  await checkPositionConcentration();
  await checkSectorExposure();
  await checkDrawdown();
  await checkCircuitBreaker();

  // Start intervals
  setInterval(checkPositionConcentration, config.POSITION_CHECK_INTERVAL);
  setInterval(checkSectorExposure, config.SECTOR_CHECK_INTERVAL);
  setInterval(checkDrawdown, config.DRAWDOWN_CHECK_INTERVAL);
  setInterval(checkCircuitBreaker, config.CIRCUIT_BREAKER_INTERVAL);

  // Status heartbeat every 5 minutes
  setInterval(() => {
    console.log(`[${new Date().toISOString()}] Monitor heartbeat - all checks running`);
  }, 300000);
}

// Entry point
startMonitoring().catch((error) => {
  console.error('Monitor failed to start:', error);
  process.exit(1);
});
