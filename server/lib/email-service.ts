/**
 * Email Service - Multi-Provider Integration
 *
 * Provides email sending capabilities for trade alerts and notifications.
 * Supports multiple providers with automatic fallback:
 * - SendGrid (priority 1) - requires SENDGRID_API_KEY
 * - Brevo (priority 2) - requires BREVO_API_KEY (FREE: 300 emails/day)
 */

import { log } from "../utils/logger";
import {
  sendEmailWithFallback,
  isEmailConfigured as checkEmailConfigured,
  getEmailServiceStatus,
} from "./email-providers";
import type { EmailOptions, EmailResult } from "./email-providers";

// Re-export types for backward compatibility
export type { EmailOptions, EmailResult };

// Re-export status function
export { getEmailServiceStatus };

/**
 * Check if email service is configured and ready
 */
export function isEmailConfigured(): boolean {
  return checkEmailConfigured();
}

/**
 * Send an email via configured provider(s)
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return {
      success: false,
      error: "No email provider configured",
    };
  }

  return sendEmailWithFallback(options);
}

/**
 * Send a trade alert email
 */
export async function sendTradeAlert(options: {
  to: string | string[];
  from: string;
  symbol: string;
  action: "BUY" | "SELL";
  quantity: number;
  price: number;
  reason?: string;
}): Promise<EmailResult> {
  const subject = `Trade Alert: ${options.action} ${options.quantity} ${options.symbol} @ $${options.price}`;
  const text = `
Trade Executed:
- Symbol: ${options.symbol}
- Action: ${options.action}
- Quantity: ${options.quantity}
- Price: $${options.price}
${options.reason ? `- Reason: ${options.reason}` : ""}
- Time: ${new Date().toISOString()}
`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: ${options.action === "BUY" ? "#22c55e" : "#ef4444"};">
    Trade Alert: ${options.action}
  </h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Symbol</strong></td><td>${options.symbol}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Action</strong></td><td>${options.action}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Quantity</strong></td><td>${options.quantity}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Price</strong></td><td>$${options.price.toFixed(2)}</td></tr>
    ${options.reason ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Reason</strong></td><td>${options.reason}</td></tr>` : ""}
    <tr><td style="padding: 8px;"><strong>Time</strong></td><td>${new Date().toLocaleString()}</td></tr>
  </table>
</div>
`;

  return sendEmail({
    to: options.to,
    from: options.from,
    subject,
    text,
    html,
  });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(options: {
  to: string;
  from: string;
  username: string;
  resetToken: string;
  resetUrl: string;
}): Promise<EmailResult> {
  const subject = "AlphaFlow - Password Reset Request";
  const text = `
Hello ${options.username},

You requested a password reset for your AlphaFlow account.

Click the link below to reset your password (valid for 1 hour):
${options.resetUrl}?token=${options.resetToken}

If you did not request this reset, please ignore this email.

Best regards,
The AlphaFlow Team
`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #3b82f6;">Password Reset Request</h2>
  <p>Hello <strong>${options.username}</strong>,</p>
  <p>You requested a password reset for your AlphaFlow account.</p>
  <p style="margin: 20px 0;">
    <a href="${options.resetUrl}?token=${options.resetToken}"
       style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Reset Password
    </a>
  </p>
  <p style="color: #6b7280; font-size: 14px;">This link is valid for 1 hour.</p>
  <p style="color: #6b7280; font-size: 14px;">If you did not request this reset, please ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
  <p style="color: #9ca3af; font-size: 12px;">Best regards,<br>The AlphaFlow Team</p>
</div>
`;

  return sendEmail({
    to: options.to,
    from: options.from,
    subject,
    text,
    html,
  });
}

/**
 * Send a large loss alert email
 */
export async function sendLargeLossAlert(options: {
  to: string | string[];
  from: string;
  symbol: string;
  lossPercent: number;
  lossAmount: number;
  currentPrice: number;
  entryPrice: number;
}): Promise<EmailResult> {
  const subject = `⚠️ Large Loss Alert: ${options.symbol} down ${options.lossPercent.toFixed(2)}%`;
  const text = `
Large Loss Alert:
- Symbol: ${options.symbol}
- Loss: ${options.lossPercent.toFixed(2)}% ($${options.lossAmount.toFixed(2)})
- Entry Price: $${options.entryPrice.toFixed(2)}
- Current Price: $${options.currentPrice.toFixed(2)}
- Time: ${new Date().toISOString()}

Action may be required to limit further losses.
`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #fef2f2; padding: 20px; border-left: 4px solid #dc2626;">
  <div style="display: flex; align-items: center; margin-bottom: 16px;">
    <div style="font-size: 32px; margin-right: 12px;">⚠️</div>
    <h2 style="color: #dc2626; margin: 0;">Large Loss Alert</h2>
  </div>
  <p style="color: #991b1b; font-size: 16px; margin-bottom: 20px;">
    Your position in <strong>${options.symbol}</strong> has exceeded the loss threshold.
  </p>
  <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 4px;">
    <tr><td style="padding: 12px; border-bottom: 1px solid #fee2e2;"><strong>Symbol</strong></td><td style="color: #dc2626;">${options.symbol}</td></tr>
    <tr><td style="padding: 12px; border-bottom: 1px solid #fee2e2;"><strong>Loss Percent</strong></td><td style="color: #dc2626; font-weight: bold;">${options.lossPercent.toFixed(2)}%</td></tr>
    <tr><td style="padding: 12px; border-bottom: 1px solid #fee2e2;"><strong>Loss Amount</strong></td><td style="color: #dc2626;">-$${options.lossAmount.toFixed(2)}</td></tr>
    <tr><td style="padding: 12px; border-bottom: 1px solid #fee2e2;"><strong>Entry Price</strong></td><td>$${options.entryPrice.toFixed(2)}</td></tr>
    <tr><td style="padding: 12px; border-bottom: 1px solid #fee2e2;"><strong>Current Price</strong></td><td>$${options.currentPrice.toFixed(2)}</td></tr>
    <tr><td style="padding: 12px;"><strong>Time</strong></td><td>${new Date().toLocaleString()}</td></tr>
  </table>
  <p style="margin-top: 20px; padding: 12px; background-color: #fee2e2; border-radius: 4px; color: #991b1b;">
    <strong>⚠️ Action Required:</strong> Review this position to determine if you should cut losses or hold.
  </p>
</div>
`;

  return sendEmail({
    to: options.to,
    from: options.from,
    subject,
    text,
    html,
  });
}

/**
 * Send a circuit breaker alert email
 */
export async function sendCircuitBreakerAlert(options: {
  to: string | string[];
  from: string;
  reason: string;
  triggeredAt: Date;
  resumeTime?: Date;
}): Promise<EmailResult> {
  const subject = `🚨 Circuit Breaker Triggered - Trading Halted`;
  const resumeText = options.resumeTime
    ? `\n- Resume Time: ${options.resumeTime.toLocaleString()}`
    : "\n- Resume Time: Manual review required";

  const text = `
Circuit Breaker Alert:
- Status: Trading Halted
- Reason: ${options.reason}
- Triggered At: ${options.triggeredAt.toISOString()}${resumeText}

All automated trading has been suspended until conditions normalize.
`;

  const resumeHtml = options.resumeTime
    ? `<tr><td style="padding: 12px;"><strong>Resume Time</strong></td><td>${options.resumeTime.toLocaleString()}</td></tr>`
    : `<tr><td style="padding: 12px;"><strong>Resume Time</strong></td><td style="color: #ea580c;">Manual review required</td></tr>`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #fffbeb; padding: 20px; border-left: 4px solid #ea580c;">
  <div style="display: flex; align-items: center; margin-bottom: 16px;">
    <div style="font-size: 32px; margin-right: 12px;">🚨</div>
    <h2 style="color: #ea580c; margin: 0;">Circuit Breaker Triggered</h2>
  </div>
  <p style="color: #9a3412; font-size: 16px; margin-bottom: 20px;">
    Automated trading has been <strong>halted</strong> due to abnormal market conditions.
  </p>
  <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 4px;">
    <tr><td style="padding: 12px; border-bottom: 1px solid #fef3c7;"><strong>Status</strong></td><td style="color: #ea580c; font-weight: bold;">Trading Halted</td></tr>
    <tr><td style="padding: 12px; border-bottom: 1px solid #fef3c7;"><strong>Reason</strong></td><td>${options.reason}</td></tr>
    <tr><td style="padding: 12px; border-bottom: 1px solid #fef3c7;"><strong>Triggered At</strong></td><td>${options.triggeredAt.toLocaleString()}</td></tr>
    ${resumeHtml}
  </table>
  <p style="margin-top: 20px; padding: 12px; background-color: #fef3c7; border-radius: 4px; color: #9a3412;">
    <strong>🔒 Safety First:</strong> All automated trading has been suspended until conditions normalize or manual review is completed.
  </p>
</div>
`;

  return sendEmail({
    to: options.to,
    from: options.from,
    subject,
    text,
    html,
  });
}

/**
 * Send a daily portfolio summary email
 */
export async function sendDailySummary(options: {
  to: string | string[];
  from: string;
  date: Date;
  portfolioValue: number;
  dayChange: number;
  dayChangePercent: number;
  topGainers: Array<{ symbol: string; change: number; changePercent: number }>;
  topLosers: Array<{ symbol: string; change: number; changePercent: number }>;
  tradesExecuted: number;
}): Promise<EmailResult> {
  const dateStr = options.date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const subject = `Daily Summary - ${dateStr}`;

  const topGainersText = options.topGainers.length > 0
    ? options.topGainers
        .map(
          (g) =>
            `  - ${g.symbol}: +$${g.change.toFixed(2)} (${g.changePercent.toFixed(2)}%)`
        )
        .join("\n")
    : "  None";

  const topLosersText = options.topLosers.length > 0
    ? options.topLosers
        .map(
          (l) =>
            `  - ${l.symbol}: -$${Math.abs(l.change).toFixed(2)} (${l.changePercent.toFixed(2)}%)`
        )
        .join("\n")
    : "  None";

  const text = `
Daily Portfolio Summary - ${dateStr}

Portfolio Value: $${options.portfolioValue.toFixed(2)}
Day Change: ${options.dayChange >= 0 ? "+" : ""}$${options.dayChange.toFixed(2)} (${options.dayChangePercent >= 0 ? "+" : ""}${options.dayChangePercent.toFixed(2)}%)
Trades Executed: ${options.tradesExecuted}

Top Gainers:
${topGainersText}

Top Losers:
${topLosersText}
`;

  const topGainersHtml =
    options.topGainers.length > 0
      ? options.topGainers
          .map(
            (g) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${g.symbol}</td>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; color: #22c55e; text-align: right;">+$${g.change.toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; color: #22c55e; text-align: right;">+${g.changePercent.toFixed(2)}%</td>
    </tr>
  `
          )
          .join("")
      : `<tr><td colspan="3" style="padding: 8px; text-align: center; color: #9ca3af;">No gainers today</td></tr>`;

  const topLosersHtml =
    options.topLosers.length > 0
      ? options.topLosers
          .map(
            (l) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${l.symbol}</td>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; color: #ef4444; text-align: right;">-$${Math.abs(l.change).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; color: #ef4444; text-align: right;">${l.changePercent.toFixed(2)}%</td>
    </tr>
  `
          )
          .join("")
      : `<tr><td colspan="3" style="padding: 8px; text-align: center; color: #9ca3af;">No losers today</td></tr>`;

  const changeColor = options.dayChange >= 0 ? "#22c55e" : "#ef4444";
  const changeSign = options.dayChange >= 0 ? "+" : "";

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Daily Portfolio Summary</h2>
  <p style="color: #6b7280; margin-bottom: 24px;">${dateStr}</p>

  <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px;"><strong>Portfolio Value</strong></td>
        <td style="padding: 8px; text-align: right; font-size: 18px; color: #1f2937;">$${options.portfolioValue.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding: 8px;"><strong>Day Change</strong></td>
        <td style="padding: 8px; text-align: right; font-size: 18px; color: ${changeColor}; font-weight: bold;">
          ${changeSign}$${options.dayChange.toFixed(2)} (${changeSign}${options.dayChangePercent.toFixed(2)}%)
        </td>
      </tr>
      <tr>
        <td style="padding: 8px;"><strong>Trades Executed</strong></td>
        <td style="padding: 8px; text-align: right;">${options.tradesExecuted}</td>
      </tr>
    </table>
  </div>

  <div style="margin-bottom: 20px;">
    <h3 style="color: #22c55e; margin-bottom: 12px;">Top Gainers</h3>
    <table style="width: 100%; border-collapse: collapse; background-color: white;">
      <thead>
        <tr style="background-color: #f9fafb;">
          <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Symbol</th>
          <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Change</th>
          <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">%</th>
        </tr>
      </thead>
      <tbody>
        ${topGainersHtml}
      </tbody>
    </table>
  </div>

  <div style="margin-bottom: 20px;">
    <h3 style="color: #ef4444; margin-bottom: 12px;">Top Losers</h3>
    <table style="width: 100%; border-collapse: collapse; background-color: white;">
      <thead>
        <tr style="background-color: #f9fafb;">
          <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Symbol</th>
          <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Change</th>
          <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">%</th>
        </tr>
      </thead>
      <tbody>
        ${topLosersHtml}
      </tbody>
    </table>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
  <p style="color: #9ca3af; font-size: 12px; text-align: center;">AlphaFlow Trading Platform</p>
</div>
`;

  return sendEmail({
    to: options.to,
    from: options.from,
    subject,
    text,
    html,
  });
}

/**
 * Send a weekly performance report email
 */
export async function sendWeeklyReport(options: {
  to: string | string[];
  from: string;
  weekStart: Date;
  weekEnd: Date;
  startValue: number;
  endValue: number;
  weeklyReturn: number;
  weeklyReturnPercent: number;
  totalTrades: number;
  winRate: number;
}): Promise<EmailResult> {
  const weekStartStr = options.weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const weekEndStr = options.weekEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const subject = `Weekly Report - ${weekStartStr} to ${weekEndStr}`;

  const text = `
Weekly Performance Report
Period: ${weekStartStr} - ${weekEndStr}

Portfolio Performance:
- Starting Value: $${options.startValue.toFixed(2)}
- Ending Value: $${options.endValue.toFixed(2)}
- Weekly Return: ${options.weeklyReturn >= 0 ? "+" : ""}$${options.weeklyReturn.toFixed(2)} (${options.weeklyReturnPercent >= 0 ? "+" : ""}${options.weeklyReturnPercent.toFixed(2)}%)

Trading Activity:
- Total Trades: ${options.totalTrades}
- Win Rate: ${options.winRate.toFixed(1)}%
`;

  const returnColor = options.weeklyReturn >= 0 ? "#22c55e" : "#ef4444";
  const returnSign = options.weeklyReturn >= 0 ? "+" : "";
  const returnArrow = options.weeklyReturn >= 0 ? "📈" : "📉";

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 24px; border-radius: 8px 8px 0 0; color: white;">
    <h2 style="margin: 0; font-size: 24px;">Weekly Performance Report</h2>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">${weekStartStr} - ${weekEndStr}</p>
  </div>

  <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1f2937; margin-top: 0; margin-bottom: 16px;">Portfolio Performance ${returnArrow}</h3>
      <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 4px; overflow: hidden;">
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Starting Value</strong></td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${options.startValue.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Ending Value</strong></td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${options.endValue.toFixed(2)}</td>
        </tr>
        <tr style="background-color: ${options.weeklyReturn >= 0 ? "#f0fdf4" : "#fef2f2"};">
          <td style="padding: 12px;"><strong>Weekly Return</strong></td>
          <td style="padding: 12px; text-align: right; font-size: 18px; font-weight: bold; color: ${returnColor};">
            ${returnSign}$${options.weeklyReturn.toFixed(2)}
            <span style="font-size: 14px; margin-left: 8px;">(${returnSign}${options.weeklyReturnPercent.toFixed(2)}%)</span>
          </td>
        </tr>
      </table>
    </div>

    <div>
      <h3 style="color: #1f2937; margin-bottom: 16px;">Trading Activity</h3>
      <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 4px; overflow: hidden;">
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Total Trades</strong></td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${options.totalTrades}</td>
        </tr>
        <tr>
          <td style="padding: 12px;"><strong>Win Rate</strong></td>
          <td style="padding: 12px; text-align: right;">
            <span style="color: ${options.winRate >= 50 ? "#22c55e" : "#ef4444"}; font-weight: bold;">
              ${options.winRate.toFixed(1)}%
            </span>
          </td>
        </tr>
      </table>
    </div>
  </div>

  <div style="background-color: #f3f4f6; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
    <p style="margin: 0; color: #6b7280; font-size: 14px;">
      Keep up the great work! 🚀
    </p>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
  <p style="color: #9ca3af; font-size: 12px; text-align: center;">AlphaFlow Trading Platform</p>
</div>
`;

  return sendEmail({
    to: options.to,
    from: options.from,
    subject,
    text,
    html,
  });
}
