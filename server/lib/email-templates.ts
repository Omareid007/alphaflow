/**
 * Email Templates for Trading Notifications
 *
 * Professional HTML and plain text email templates for the AlphaFlow trading platform.
 * All templates follow mobile-responsive design with AlphaFlow branding (#22c55e).
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface OrderFilledParams {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  totalValue: number;
  timestamp: Date;
}

export interface LargeLossAlertParams {
  symbol: string;
  unrealizedPL: number;
  percentLoss: number;
  currentPrice: number;
  avgEntryPrice: number;
}

export interface CircuitBreakerParams {
  reason: string;
  triggeredAt: Date;
  estimatedRecovery?: Date;
}

export interface DailySummaryParams {
  date: Date;
  portfolioValue: number;
  dailyPL: number;
  dailyPLPercent: number;
  topGainers: Array<{ symbol: string; change: number; changePercent: number }>;
  topLosers: Array<{ symbol: string; change: number; changePercent: number }>;
  tradesExecuted: number;
}

export interface StrategyPerformance {
  strategyName: string;
  weeklyReturn: number;
  weeklyReturnPercent: number;
  tradesExecuted: number;
  winRate: number;
}

export interface WeeklyReportParams {
  weekStart: Date;
  weekEnd: Date;
  portfolioValue: number;
  weeklyPL: number;
  weeklyPLPercent: number;
  strategies: StrategyPerformance[];
}

// ============================================================================
// Constants
// ============================================================================

const ALPHAFLOW_GREEN = '#22c55e';
const ALPHAFLOW_RED = '#ef4444';
const ALPHAFLOW_BLUE = '#3b82f6';
const ALPHAFLOW_ORANGE = '#f97316';

// Base styles for mobile-responsive emails
const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
`;

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Order Filled Template - Trade confirmation email
 *
 * Professional notification sent when an order is successfully filled.
 * Includes order summary, pricing info, and portfolio link.
 */
export function getOrderFilledTemplate(params: OrderFilledParams): EmailTemplate {
  const { symbol, side, qty, price, totalValue, timestamp } = params;

  const sideColor = side === 'buy' ? ALPHAFLOW_GREEN : ALPHAFLOW_RED;
  const sideText = side === 'buy' ? 'BUY' : 'SELL';
  const sideIcon = side === 'buy' ? '📈' : '📉';

  const formattedDate = timestamp.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  const subject = `Order Filled: ${sideText} ${qty} ${symbol} @ $${price.toFixed(2)}`;

  const text = `
AlphaFlow Trade Confirmation

Your order has been successfully filled!

ORDER DETAILS
Symbol: ${symbol}
Action: ${sideText}
Quantity: ${qty} shares
Price: $${price.toFixed(2)}
Total Value: $${totalValue.toFixed(2)}

EXECUTION TIME
${formattedDate}
${formattedTime}

NEXT STEPS
• View your updated portfolio at: https://alphaflow.app/portfolio
• Check position performance at: https://alphaflow.app/positions
• Review order history at: https://alphaflow.app/orders

Questions? Contact support@alphaflow.app

---
AlphaFlow Trading Platform
  `.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Filled - ${symbol}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="${BASE_STYLES}">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${sideColor} 0%, ${side === 'buy' ? '#16a34a' : '#dc2626'} 100%); padding: 32px 24px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
      <div style="font-size: 48px; margin-bottom: 8px;">${sideIcon}</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Order Filled!</h1>
      <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">${sideText} ${qty} shares of ${symbol}</p>
    </div>

    <!-- Content -->
    <div style="background-color: white; padding: 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <p style="color: #4b5563; font-size: 16px; margin-top: 0;">
        Your order has been successfully executed. Below are the details of your trade:
      </p>

      <!-- Order Details Table -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <h2 style="color: #1f2937; font-size: 18px; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid ${sideColor}; padding-bottom: 8px;">
          Order Details
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Symbol</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; font-size: 16px; color: #1f2937;">${symbol}</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Action</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: ${sideColor};">${sideText}</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Quantity</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${qty} shares</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Fill Price</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; font-size: 18px; color: #1f2937;">$${price.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; color: #6b7280; font-weight: 600;">Total Value</td>
            <td style="padding: 12px 8px; text-align: right; font-weight: bold; font-size: 20px; color: ${sideColor};">$${totalValue.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <!-- Execution Time -->
      <div style="background-color: #eff6ff; border-left: 4px solid ${ALPHAFLOW_BLUE}; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;">
          <strong>Executed:</strong> ${formattedDate} at ${formattedTime}
        </p>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://alphaflow.app/portfolio" style="display: inline-block; background-color: ${ALPHAFLOW_GREEN}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          View Portfolio
        </a>
      </div>

      <!-- Quick Links -->
      <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 12px;"><strong>Quick Links:</strong></p>
        <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
          <li><a href="https://alphaflow.app/positions" style="color: ${ALPHAFLOW_BLUE}; text-decoration: none;">View Position Performance</a></li>
          <li><a href="https://alphaflow.app/orders" style="color: ${ALPHAFLOW_BLUE}; text-decoration: none;">Order History</a></li>
          <li><a href="https://alphaflow.app/analytics" style="color: ${ALPHAFLOW_BLUE}; text-decoration: none;">Portfolio Analytics</a></li>
        </ul>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        © 2026 AlphaFlow Trading Platform. All rights reserved.
      </p>
      <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
        Questions? Contact <a href="mailto:support@alphaflow.app" style="color: ${ALPHAFLOW_BLUE};">support@alphaflow.app</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Large Loss Alert Template - Warning email for significant losses
 *
 * Triggered when a position's unrealized loss exceeds a threshold (typically 5%).
 * Includes position details and suggested actions.
 */
export function getLargeLossAlertTemplate(params: LargeLossAlertParams): EmailTemplate {
  const { symbol, unrealizedPL, percentLoss, currentPrice, avgEntryPrice } = params;

  const priceChange = currentPrice - avgEntryPrice;
  const priceChangePercent = ((priceChange / avgEntryPrice) * 100);

  const subject = `⚠️ Large Loss Alert: ${symbol} down ${Math.abs(percentLoss).toFixed(2)}%`;

  const text = `
LARGE LOSS ALERT

Your position in ${symbol} has exceeded the loss threshold!

POSITION DETAILS
Symbol: ${symbol}
Unrealized P&L: -$${Math.abs(unrealizedPL).toFixed(2)}
Loss Percentage: ${percentLoss.toFixed(2)}%
Entry Price: $${avgEntryPrice.toFixed(2)}
Current Price: $${currentPrice.toFixed(2)}
Price Change: -$${Math.abs(priceChange).toFixed(2)} (${priceChangePercent.toFixed(2)}%)

SUGGESTED ACTIONS
1. Review your position strategy and risk tolerance
2. Consider setting a stop-loss order to limit further losses
3. Evaluate whether to hold, reduce, or close the position
4. Check market news and fundamentals for ${symbol}
5. Consult with a financial advisor if needed

RISK MANAGEMENT REMINDER
• Never invest more than you can afford to lose
• Diversification helps manage portfolio risk
• Emotional decisions can lead to poor outcomes
• Review your overall portfolio allocation

View Position: https://alphaflow.app/positions/${symbol}

---
AlphaFlow Trading Platform
  `.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Large Loss Alert - ${symbol}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="${BASE_STYLES}">
    <!-- Alert Header -->
    <div style="background-color: #fef2f2; padding: 24px; border-left: 6px solid ${ALPHAFLOW_RED}; border-radius: 8px 8px 0 0;">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <div style="font-size: 40px; margin-right: 16px;">⚠️</div>
        <div>
          <h1 style="margin: 0; color: #991b1b; font-size: 24px; font-weight: bold;">Large Loss Alert</h1>
          <p style="margin: 4px 0 0 0; color: #b91c1c; font-size: 16px;">Position: ${symbol}</p>
        </div>
      </div>
      <p style="margin: 12px 0 0 0; color: #7f1d1d; font-size: 14px; background-color: #fee2e2; padding: 12px; border-radius: 4px;">
        <strong>⚡ Immediate Attention Required:</strong> Your position has exceeded the loss threshold.
      </p>
    </div>

    <!-- Content -->
    <div style="background-color: white; padding: 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <!-- Loss Summary -->
      <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px; font-weight: 600; text-transform: uppercase;">Unrealized Loss</p>
        <p style="margin: 0; color: #dc2626; font-size: 36px; font-weight: bold;">-$${Math.abs(unrealizedPL).toFixed(2)}</p>
        <p style="margin: 8px 0 0 0; color: #b91c1c; font-size: 20px; font-weight: 600;">${percentLoss.toFixed(2)}%</p>
      </div>

      <!-- Position Details -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <h2 style="color: #1f2937; font-size: 18px; margin-top: 0; margin-bottom: 16px;">Position Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Symbol</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #1f2937;">${symbol}</td>
          </tr>
          <tr>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Entry Price</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">$${avgEntryPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Current Price</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${ALPHAFLOW_RED}; font-weight: bold;">$${currentPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 8px; color: #6b7280; font-weight: 600;">Price Change</td>
            <td style="padding: 10px 8px; text-align: right; color: ${ALPHAFLOW_RED}; font-weight: bold;">-$${Math.abs(priceChange).toFixed(2)} (${priceChangePercent.toFixed(2)}%)</td>
          </tr>
        </table>
      </div>

      <!-- Suggested Actions -->
      <div style="background-color: #fffbeb; border-left: 4px solid ${ALPHAFLOW_ORANGE}; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #92400e; font-size: 16px;">🎯 Suggested Actions</h3>
        <ol style="margin: 12px 0 0 0; padding-left: 24px; color: #78350f; font-size: 14px; line-height: 1.8;">
          <li>Review your position strategy and risk tolerance</li>
          <li>Consider setting a stop-loss order to limit further losses</li>
          <li>Evaluate whether to hold, reduce, or close the position</li>
          <li>Check market news and fundamentals for ${symbol}</li>
          <li>Consult with a financial advisor if needed</li>
        </ol>
      </div>

      <!-- Risk Management Reminder -->
      <div style="background-color: #f0f9ff; border: 1px solid #bfdbfe; padding: 16px; margin: 24px 0; border-radius: 6px;">
        <h3 style="margin-top: 0; color: #1e40af; font-size: 14px; font-weight: bold;">💡 Risk Management Reminder</h3>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #1e3a8a; font-size: 13px; line-height: 1.7;">
          <li>Never invest more than you can afford to lose</li>
          <li>Diversification helps manage portfolio risk</li>
          <li>Emotional decisions can lead to poor outcomes</li>
          <li>Review your overall portfolio allocation</li>
        </ul>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0 16px 0;">
        <a href="https://alphaflow.app/positions/${symbol}" style="display: inline-block; background-color: ${ALPHAFLOW_RED}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          Review Position
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        © 2026 AlphaFlow Trading Platform. All rights reserved.
      </p>
      <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 11px;">
        <em>This is an automated alert. Trading involves risk. Past performance does not guarantee future results.</em>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Circuit Breaker Template - System alert email
 *
 * Sent when trading is automatically paused due to abnormal market conditions
 * or risk thresholds. Explains the situation and recovery timeline.
 */
export function getCircuitBreakerTemplate(params: CircuitBreakerParams): EmailTemplate {
  const { reason, triggeredAt, estimatedRecovery } = params;

  const formattedTriggerTime = triggeredAt.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const recoveryText = estimatedRecovery
    ? estimatedRecovery.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : 'Manual review required - no automatic resume scheduled';

  const subject = `🚨 Circuit Breaker Triggered - Trading Halted`;

  const text = `
CIRCUIT BREAKER ALERT

Automated trading has been halted to protect your portfolio.

STATUS: TRADING SUSPENDED

DETAILS
Reason: ${reason}
Triggered: ${formattedTriggerTime}
Estimated Recovery: ${recoveryText}

WHAT THIS MEANS
• All automated trading strategies have been paused
• Open orders remain active (unless cancelled by system)
• Your portfolio remains safe and accessible
• Manual trading may still be available

WHAT HAPPENS NEXT
1. System will monitor market conditions continuously
2. Trading will resume automatically when conditions normalize
   OR after manual review confirms safety
3. You will receive a notification when trading resumes
4. All strategies will be evaluated before reactivation

WHAT YOU CAN DO
• Review your current positions at: https://alphaflow.app/positions
• Check system status at: https://alphaflow.app/status
• Contact support if you have concerns: support@alphaflow.app

WHY WE DO THIS
Circuit breakers protect your portfolio during:
• Extreme market volatility
• Rapid portfolio losses
• System anomalies
• Exchange-wide trading halts

Your safety is our priority. Thank you for your patience.

---
AlphaFlow Trading Platform
  `.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Circuit Breaker Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="${BASE_STYLES}">
    <!-- Alert Header -->
    <div style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 32px 24px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
      <div style="font-size: 56px; margin-bottom: 12px;">🚨</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Circuit Breaker Triggered</h1>
      <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.95; background-color: rgba(0,0,0,0.2); padding: 8px 16px; border-radius: 4px; display: inline-block;">
        <strong>STATUS:</strong> Trading Suspended
      </p>
    </div>

    <!-- Content -->
    <div style="background-color: white; padding: 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <!-- Alert Banner -->
      <div style="background-color: #fffbeb; border: 2px solid #f59e0b; padding: 20px; margin-bottom: 24px; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: bold;">
          ⚡ Automated trading has been halted to protect your portfolio
        </p>
      </div>

      <!-- Details -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <h2 style="color: #1f2937; font-size: 18px; margin-top: 0; margin-bottom: 16px;">Circuit Breaker Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600; width: 40%;">Status</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #ea580c;">TRADING HALTED</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Reason</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${reason}</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">Triggered</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937; font-size: 14px;">${formattedTriggerTime}</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; color: #6b7280; font-weight: 600;">Estimated Recovery</td>
            <td style="padding: 12px 8px; text-align: right; color: ${estimatedRecovery ? ALPHAFLOW_GREEN : ALPHAFLOW_ORANGE}; font-weight: 600; font-size: 14px;">${recoveryText}</td>
          </tr>
        </table>
      </div>

      <!-- What This Means -->
      <div style="margin: 24px 0;">
        <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px; border-left: 4px solid ${ALPHAFLOW_BLUE}; padding-left: 12px;">What This Means</h3>
        <ul style="margin: 0; padding-left: 24px; color: #4b5563; font-size: 14px; line-height: 1.8;">
          <li>All automated trading strategies have been paused</li>
          <li>Open orders remain active (unless cancelled by system)</li>
          <li>Your portfolio remains safe and accessible</li>
          <li>Manual trading may still be available</li>
        </ul>
      </div>

      <!-- What Happens Next -->
      <div style="margin: 24px 0;">
        <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px; border-left: 4px solid ${ALPHAFLOW_GREEN}; padding-left: 12px;">What Happens Next</h3>
        <ol style="margin: 0; padding-left: 24px; color: #4b5563; font-size: 14px; line-height: 1.8;">
          <li>System will monitor market conditions continuously</li>
          <li>Trading will resume automatically when conditions normalize OR after manual review confirms safety</li>
          <li>You will receive a notification when trading resumes</li>
          <li>All strategies will be evaluated before reactivation</li>
        </ol>
      </div>

      <!-- What You Can Do -->
      <div style="background-color: #f0f9ff; border-left: 4px solid ${ALPHAFLOW_BLUE}; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #1e40af; font-size: 16px;">What You Can Do</h3>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #1e3a8a; font-size: 14px; line-height: 1.7;">
          <li><a href="https://alphaflow.app/positions" style="color: ${ALPHAFLOW_BLUE}; text-decoration: none;">Review your current positions</a></li>
          <li><a href="https://alphaflow.app/status" style="color: ${ALPHAFLOW_BLUE}; text-decoration: none;">Check system status</a></li>
          <li><a href="mailto:support@alphaflow.app" style="color: ${ALPHAFLOW_BLUE}; text-decoration: none;">Contact support if you have concerns</a></li>
        </ul>
      </div>

      <!-- Why We Do This -->
      <div style="background-color: #fefce8; border: 1px solid #fde047; padding: 16px; margin: 24px 0; border-radius: 6px;">
        <h3 style="margin-top: 0; color: #713f12; font-size: 14px; font-weight: bold;">🛡️ Why We Do This</h3>
        <p style="margin: 8px 0 12px 0; color: #854d0e; font-size: 13px;">
          Circuit breakers protect your portfolio during:
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #854d0e; font-size: 13px; line-height: 1.7;">
          <li>Extreme market volatility</li>
          <li>Rapid portfolio losses</li>
          <li>System anomalies</li>
          <li>Exchange-wide trading halts</li>
        </ul>
      </div>

      <p style="text-align: center; color: #6b7280; font-size: 14px; margin: 24px 0 8px 0; font-style: italic;">
        Your safety is our priority. Thank you for your patience.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        © 2026 AlphaFlow Trading Platform. All rights reserved.
      </p>
      <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 11px;">
        <em>This is an automated safety alert. You will be notified when trading resumes.</em>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Daily Summary Template - Daily trading digest
 *
 * Comprehensive summary of the day's trading activity including P&L,
 * top performers, and trade count. Sent at end of trading day.
 */
export function getDailySummaryTemplate(params: DailySummaryParams): EmailTemplate {
  const { date, portfolioValue, dailyPL, dailyPLPercent, topGainers, topLosers, tradesExecuted } = params;

  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const plColor = dailyPL >= 0 ? ALPHAFLOW_GREEN : ALPHAFLOW_RED;
  const plSign = dailyPL >= 0 ? '+' : '';
  const plIcon = dailyPL >= 0 ? '📈' : '📉';

  const subject = `Daily Summary - ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} | ${plSign}${dailyPLPercent.toFixed(2)}%`;

  // Generate plain text
  const topGainersText = topGainers.length > 0
    ? topGainers.map(g => `  • ${g.symbol}: +$${g.change.toFixed(2)} (+${g.changePercent.toFixed(2)}%)`).join('\n')
    : '  None';

  const topLosersText = topLosers.length > 0
    ? topLosers.map(l => `  • ${l.symbol}: -$${Math.abs(l.change).toFixed(2)} (${l.changePercent.toFixed(2)}%)`).join('\n')
    : '  None';

  const text = `
DAILY PORTFOLIO SUMMARY
${formattedDate}

PERFORMANCE OVERVIEW
Portfolio Value: $${portfolioValue.toFixed(2)}
Daily P&L: ${plSign}$${dailyPL.toFixed(2)} (${plSign}${dailyPLPercent.toFixed(2)}%)
Trades Executed: ${tradesExecuted}

TOP GAINERS
${topGainersText}

TOP LOSERS
${topLosersText}

${dailyPL >= 0 ? '🎉 Great day! Keep up the momentum.' : '💪 Stay disciplined. Tomorrow is a new opportunity.'}

View Full Report: https://alphaflow.app/reports/daily

---
AlphaFlow Trading Platform
  `.trim();

  // Generate HTML
  const topGainersHtml = topGainers.length > 0
    ? topGainers.map(g => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-weight: 600; color: #1f2937;">${g.symbol}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; color: ${ALPHAFLOW_GREEN}; font-weight: bold;">+$${g.change.toFixed(2)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; color: ${ALPHAFLOW_GREEN}; font-weight: 600;">+${g.changePercent.toFixed(2)}%</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #9ca3af; font-style: italic;">No gainers today</td></tr>';

  const topLosersHtml = topLosers.length > 0
    ? topLosers.map(l => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-weight: 600; color: #1f2937;">${l.symbol}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; color: ${ALPHAFLOW_RED}; font-weight: bold;">-$${Math.abs(l.change).toFixed(2)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; color: ${ALPHAFLOW_RED}; font-weight: 600;">${l.changePercent.toFixed(2)}%</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #9ca3af; font-style: italic;">No losers today</td></tr>';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Summary - ${formattedDate}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="${BASE_STYLES}">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${ALPHAFLOW_BLUE} 0%, #1e40af 100%); padding: 32px 24px; border-radius: 8px 8px 0 0; color: white;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Daily Summary</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">${formattedDate}</p>
        </div>
        <div style="font-size: 48px;">${plIcon}</div>
      </div>
    </div>

    <!-- Content -->
    <div style="background-color: white; padding: 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <!-- Performance Overview -->
      <div style="background: linear-gradient(135deg, ${dailyPL >= 0 ? '#f0fdf4' : '#fef2f2'} 0%, ${dailyPL >= 0 ? '#dcfce7' : '#fee2e2'} 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Portfolio Value</p>
        <p style="margin: 0; color: #1f2937; font-size: 36px; font-weight: bold;">$${portfolioValue.toFixed(2)}</p>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid ${dailyPL >= 0 ? '#bbf7d0' : '#fecaca'};">
          <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Daily P&L</p>
          <p style="margin: 0; color: ${plColor}; font-size: 28px; font-weight: bold;">
            ${plSign}$${dailyPL.toFixed(2)}
            <span style="font-size: 18px; margin-left: 8px;">(${plSign}${dailyPLPercent.toFixed(2)}%)</span>
          </p>
        </div>
      </div>

      <!-- Trades Executed -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0; color: #6b7280; font-size: 14px; font-weight: 600;">Trades Executed Today</p>
        <p style="margin: 8px 0 0 0; color: ${ALPHAFLOW_BLUE}; font-size: 32px; font-weight: bold;">${tradesExecuted}</p>
      </div>

      <!-- Top Gainers -->
      <div style="margin-bottom: 24px;">
        <h2 style="color: ${ALPHAFLOW_GREEN}; font-size: 20px; margin-bottom: 12px; display: flex; align-items: center;">
          <span style="margin-right: 8px;">📈</span> Top Gainers
        </h2>
        <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #e5e7eb;">
              <th style="padding: 12px; text-align: left; font-size: 14px; color: #4b5563; font-weight: 700;">Symbol</th>
              <th style="padding: 12px; text-align: right; font-size: 14px; color: #4b5563; font-weight: 700;">Change</th>
              <th style="padding: 12px; text-align: right; font-size: 14px; color: #4b5563; font-weight: 700;">%</th>
            </tr>
          </thead>
          <tbody>
            ${topGainersHtml}
          </tbody>
        </table>
      </div>

      <!-- Top Losers -->
      <div style="margin-bottom: 24px;">
        <h2 style="color: ${ALPHAFLOW_RED}; font-size: 20px; margin-bottom: 12px; display: flex; align-items: center;">
          <span style="margin-right: 8px;">📉</span> Top Losers
        </h2>
        <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #e5e7eb;">
              <th style="padding: 12px; text-align: left; font-size: 14px; color: #4b5563; font-weight: 700;">Symbol</th>
              <th style="padding: 12px; text-align: right; font-size: 14px; color: #4b5563; font-weight: 700;">Change</th>
              <th style="padding: 12px; text-align: right; font-size: 14px; color: #4b5563; font-weight: 700;">%</th>
            </tr>
          </thead>
          <tbody>
            ${topLosersHtml}
          </tbody>
        </table>
      </div>

      <!-- Motivational Message -->
      <div style="background-color: ${dailyPL >= 0 ? '#f0fdf4' : '#fef3c7'}; border-left: 4px solid ${dailyPL >= 0 ? ALPHAFLOW_GREEN : ALPHAFLOW_ORANGE}; padding: 16px; margin: 24px 0; border-radius: 4px; text-align: center;">
        <p style="margin: 0; color: ${dailyPL >= 0 ? '#15803d' : '#92400e'}; font-size: 15px; font-weight: 600;">
          ${dailyPL >= 0 ? '🎉 Great day! Keep up the momentum.' : '💪 Stay disciplined. Tomorrow is a new opportunity.'}
        </p>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0 16px 0;">
        <a href="https://alphaflow.app/reports/daily" style="display: inline-block; background-color: ${ALPHAFLOW_BLUE}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          View Full Report
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        © 2026 AlphaFlow Trading Platform. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Weekly Report Template - Weekly performance summary
 *
 * Comprehensive weekly report including portfolio performance, strategy breakdown,
 * and key metrics. Sent at end of each trading week.
 */
export function getWeeklyReportTemplate(params: WeeklyReportParams): EmailTemplate {
  const { weekStart, weekEnd, portfolioValue, weeklyPL, weeklyPLPercent, strategies } = params;

  const weekStartStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekEndStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const plColor = weeklyPL >= 0 ? ALPHAFLOW_GREEN : ALPHAFLOW_RED;
  const plSign = weeklyPL >= 0 ? '+' : '';
  const plIcon = weeklyPL >= 0 ? '📈' : '📉';

  const subject = `Weekly Report: ${weekStartStr} - ${weekEndStr} | ${plSign}${weeklyPLPercent.toFixed(2)}%`;

  // Calculate aggregate stats
  const totalTrades = strategies.reduce((sum, s) => sum + s.tradesExecuted, 0);
  const avgWinRate = strategies.length > 0
    ? strategies.reduce((sum, s) => sum + s.winRate, 0) / strategies.length
    : 0;

  // Generate plain text
  const strategiesText = strategies.length > 0
    ? strategies.map(s => `
  ${s.strategyName}
  • Return: ${s.weeklyReturn >= 0 ? '+' : ''}$${s.weeklyReturn.toFixed(2)} (${s.weeklyReturnPercent >= 0 ? '+' : ''}${s.weeklyReturnPercent.toFixed(2)}%)
  • Trades: ${s.tradesExecuted}
  • Win Rate: ${s.winRate.toFixed(1)}%
    `).join('\n')
    : '  No active strategies this week';

  const text = `
WEEKLY PERFORMANCE REPORT
${weekStartStr} - ${weekEndStr}

PORTFOLIO SUMMARY
Portfolio Value: $${portfolioValue.toFixed(2)}
Weekly P&L: ${plSign}$${weeklyPL.toFixed(2)} (${plSign}${weeklyPLPercent.toFixed(2)}%)

TRADING ACTIVITY
Total Trades: ${totalTrades}
Average Win Rate: ${avgWinRate.toFixed(1)}%

STRATEGY PERFORMANCE
${strategiesText}

${weeklyPL >= 0 ? '🎯 Excellent week! Your strategies are performing well.' : '📊 Review your strategies and adjust as needed.'}

View Detailed Report: https://alphaflow.app/reports/weekly

---
AlphaFlow Trading Platform
  `.trim();

  // Generate HTML
  const strategiesHtml = strategies.length > 0
    ? strategies.map(s => {
        const stratColor = s.weeklyReturn >= 0 ? ALPHAFLOW_GREEN : ALPHAFLOW_RED;
        const stratSign = s.weeklyReturn >= 0 ? '+' : '';
        return `
        <tr>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e5e7eb;">
            <strong style="color: #1f2937; font-size: 15px;">${s.strategyName}</strong>
          </td>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <div style="color: ${stratColor}; font-weight: bold; font-size: 15px;">${stratSign}$${s.weeklyReturn.toFixed(2)}</div>
            <div style="color: ${stratColor}; font-size: 13px; margin-top: 2px;">${stratSign}${s.weeklyReturnPercent.toFixed(2)}%</div>
          </td>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; font-size: 14px;">
            ${s.tradesExecuted}
          </td>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <span style="color: ${s.winRate >= 50 ? ALPHAFLOW_GREEN : ALPHAFLOW_ORANGE}; font-weight: 600; font-size: 14px;">
              ${s.winRate.toFixed(1)}%
            </span>
          </td>
        </tr>
        `;
      }).join('')
    : '<tr><td colspan="4" style="padding: 24px; text-align: center; color: #9ca3af; font-style: italic;">No active strategies this week</td></tr>';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Report - ${weekStartStr} to ${weekEndStr}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="${BASE_STYLES}">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px 24px; border-radius: 8px 8px 0 0; color: white; text-align: center;">
      <div style="font-size: 52px; margin-bottom: 12px;">${plIcon}</div>
      <h1 style="margin: 0; font-size: 32px; font-weight: bold;">Weekly Performance Report</h1>
      <p style="margin: 12px 0 0 0; font-size: 18px; opacity: 0.95; font-weight: 500;">${weekStartStr} - ${weekEndStr}</p>
    </div>

    <!-- Content -->
    <div style="background-color: white; padding: 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <!-- Portfolio Summary -->
      <div style="background: linear-gradient(135deg, ${weeklyPL >= 0 ? '#ecfdf5' : '#fef2f2'} 0%, ${weeklyPL >= 0 ? '#d1fae5' : '#fee2e2'} 100%); border-radius: 12px; padding: 28px; margin-bottom: 28px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Portfolio Value</p>
        <p style="margin: 0; color: #1f2937; font-size: 42px; font-weight: bold; line-height: 1;">$${portfolioValue.toFixed(2)}</p>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid ${weeklyPL >= 0 ? '#a7f3d0' : '#fecaca'};">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; font-weight: 700;">Weekly Performance</p>
          <p style="margin: 0; color: ${plColor}; font-size: 32px; font-weight: bold;">
            ${plSign}$${weeklyPL.toFixed(2)}
          </p>
          <p style="margin: 6px 0 0 0; color: ${plColor}; font-size: 20px; font-weight: 600;">
            ${plSign}${weeklyPLPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <!-- Trading Stats -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px;">
        <!-- Total Trades -->
        <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #bfdbfe;">
          <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 13px; font-weight: 700; text-transform: uppercase;">Total Trades</p>
          <p style="margin: 0; color: ${ALPHAFLOW_BLUE}; font-size: 36px; font-weight: bold;">${totalTrades}</p>
        </div>
        <!-- Average Win Rate -->
        <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #bbf7d0;">
          <p style="margin: 0 0 8px 0; color: #15803d; font-size: 13px; font-weight: 700; text-transform: uppercase;">Avg Win Rate</p>
          <p style="margin: 0; color: ${ALPHAFLOW_GREEN}; font-size: 36px; font-weight: bold;">${avgWinRate.toFixed(1)}%</p>
        </div>
      </div>

      <!-- Strategy Performance -->
      <div style="margin-bottom: 24px;">
        <h2 style="color: #1f2937; font-size: 22px; margin-bottom: 16px; border-bottom: 3px solid #e5e7eb; padding-bottom: 10px;">
          Strategy Performance
        </h2>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background-color: #e5e7eb;">
                <th style="padding: 14px 12px; text-align: left; font-size: 13px; color: #374151; font-weight: 700; text-transform: uppercase;">Strategy</th>
                <th style="padding: 14px 12px; text-align: right; font-size: 13px; color: #374151; font-weight: 700; text-transform: uppercase;">Return</th>
                <th style="padding: 14px 12px; text-align: center; font-size: 13px; color: #374151; font-weight: 700; text-transform: uppercase;">Trades</th>
                <th style="padding: 14px 12px; text-align: right; font-size: 13px; color: #374151; font-weight: 700; text-transform: uppercase;">Win Rate</th>
              </tr>
            </thead>
            <tbody>
              ${strategiesHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Insights -->
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 20px; margin: 28px 0; border-radius: 6px;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 28px; margin-right: 12px;">💡</span>
          <h3 style="margin: 0; color: #92400e; font-size: 18px; font-weight: bold;">Weekly Insights</h3>
        </div>
        <p style="margin: 0; color: #78350f; font-size: 15px; line-height: 1.6;">
          ${weeklyPL >= 0
            ? '🎯 Excellent week! Your strategies are performing well. Continue monitoring market conditions and consider scaling successful strategies.'
            : '📊 Review your strategies and adjust as needed. Consider analyzing losing trades to identify patterns and improve decision-making.'}
        </p>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0 16px 0;">
        <a href="https://alphaflow.app/reports/weekly" style="display: inline-block; background-color: #6366f1; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 17px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          View Detailed Report
        </a>
      </div>

      <!-- Quick Links -->
      <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 12px; text-align: center;"><strong>Quick Access:</strong></p>
        <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px;">
          <a href="https://alphaflow.app/strategies" style="color: ${ALPHAFLOW_BLUE}; text-decoration: none; font-size: 13px;">Manage Strategies</a>
          <span style="color: #d1d5db;">•</span>
          <a href="https://alphaflow.app/portfolio" style="color: ${ALPHAFLOW_BLUE}; text-decoration: none; font-size: 13px;">Portfolio</a>
          <span style="color: #d1d5db;">•</span>
          <a href="https://alphaflow.app/analytics" style="color: ${ALPHAFLOW_BLUE}; text-decoration: none; font-size: 13px;">Analytics</a>
          <span style="color: #d1d5db;">•</span>
          <a href="https://alphaflow.app/backtests" style="color: ${ALPHAFLOW_BLUE}; text-decoration: none; font-size: 13px;">Backtests</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
        © 2026 AlphaFlow Trading Platform. All rights reserved.
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 11px;">
        <em>Past performance does not guarantee future results. Trading involves risk.</em>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}
