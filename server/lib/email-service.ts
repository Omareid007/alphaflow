/**
 * Email Service - SendGrid Integration
 *
 * Provides email sending capabilities for trade alerts and notifications.
 * Requires SENDGRID_API_KEY environment variable.
 */

import sgMail from '@sendgrid/mail';
import { log } from '../utils/logger';

// Initialize SendGrid with API key
const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) {
  sgMail.setApiKey(apiKey);
  log.info('Email', 'SendGrid initialized');
} else {
  log.warn('Email', 'SENDGRID_API_KEY not set - email notifications disabled');
}

export interface EmailOptions {
  to: string | string[];
  from: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  if (!apiKey) {
    return {
      success: false,
      error: 'SENDGRID_API_KEY not configured'
    };
  }

  try {
    const [response] = await sgMail.send({
      to: options.to,
      from: options.from,
      subject: options.subject,
      text: options.text,
      html: options.html || `<p>${options.text}</p>`,
      replyTo: options.replyTo,
    });

    log.info('Email', 'Email sent successfully', {
      to: Array.isArray(options.to) ? options.to.length : 1,
      subject: options.subject.substring(0, 50),
      statusCode: response.statusCode
    });

    return {
      success: true,
      messageId: response.headers['x-message-id'] as string
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Email', 'Failed to send email', {
      error: errorMessage,
      to: options.to,
      subject: options.subject
    });

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Send a trade alert email
 */
export async function sendTradeAlert(options: {
  to: string | string[];
  from: string;
  symbol: string;
  action: 'BUY' | 'SELL';
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
${options.reason ? `- Reason: ${options.reason}` : ''}
- Time: ${new Date().toISOString()}
`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: ${options.action === 'BUY' ? '#22c55e' : '#ef4444'};">
    Trade Alert: ${options.action}
  </h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Symbol</strong></td><td>${options.symbol}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Action</strong></td><td>${options.action}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Quantity</strong></td><td>${options.quantity}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Price</strong></td><td>$${options.price.toFixed(2)}</td></tr>
    ${options.reason ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Reason</strong></td><td>${options.reason}</td></tr>` : ''}
    <tr><td style="padding: 8px;"><strong>Time</strong></td><td>${new Date().toLocaleString()}</td></tr>
  </table>
</div>
`;

  return sendEmail({
    to: options.to,
    from: options.from,
    subject,
    text,
    html
  });
}

/**
 * Check if email service is configured and ready
 */
export function isEmailConfigured(): boolean {
  return !!apiKey;
}
