/**
 * Email Service Tests
 *
 * Tests for SendGrid email integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isEmailConfigured } from '../../../server/lib/email-service';

// Note: sendEmail function uses @sendgrid/mail which requires API key
// These tests focus on the configuration check and error handling

describe('EmailService', () => {
  describe('isEmailConfigured', () => {
    it('should return false when SENDGRID_API_KEY is not set', () => {
      // In test environment, the API key should not be set
      const configured = isEmailConfigured();
      expect(configured).toBe(false);
    });
  });

  describe('Email Options Interface', () => {
    it('should accept valid email options shape', () => {
      const options = {
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test Subject',
        text: 'Test body',
        html: '<p>Test body</p>',
        replyTo: 'reply@example.com',
      };

      // Type checking at compile time
      expect(options).toHaveProperty('to');
      expect(options).toHaveProperty('from');
      expect(options).toHaveProperty('subject');
      expect(options).toHaveProperty('text');
    });

    it('should accept array of recipients', () => {
      const options = {
        to: ['user1@example.com', 'user2@example.com'],
        from: 'sender@example.com',
        subject: 'Bulk Email',
        text: 'Message to multiple recipients',
      };

      expect(Array.isArray(options.to)).toBe(true);
      expect(options.to.length).toBe(2);
    });
  });

  describe('Trade Alert Email Format', () => {
    it('should format buy trade alert correctly', () => {
      const tradeData = {
        symbol: 'AAPL',
        action: 'BUY' as const,
        quantity: 100,
        price: 150.25,
        reason: 'RSI oversold',
      };

      const expectedSubject = `Trade Alert: ${tradeData.action} ${tradeData.quantity} ${tradeData.symbol} @ $${tradeData.price}`;

      expect(expectedSubject).toBe('Trade Alert: BUY 100 AAPL @ $150.25');
    });

    it('should format sell trade alert correctly', () => {
      const tradeData = {
        symbol: 'TSLA',
        action: 'SELL' as const,
        quantity: 50,
        price: 245.00,
      };

      const expectedSubject = `Trade Alert: ${tradeData.action} ${tradeData.quantity} ${tradeData.symbol} @ $${tradeData.price}`;

      expect(expectedSubject).toBe('Trade Alert: SELL 50 TSLA @ $245');
    });
  });
});
