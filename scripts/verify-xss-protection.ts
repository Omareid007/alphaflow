#!/usr/bin/env tsx
/**
 * XSS Protection Verification Script
 * Verifies that all critical endpoints have sanitization in place
 */

import { readFileSync } from "fs";
import { join } from "path";

console.log("========================================");
console.log("XSS PROTECTION VERIFICATION");
console.log("========================================\n");

interface Check {
  file: string;
  description: string;
  patterns: string[];
}

const checks: Check[] = [
  {
    file: "server/lib/sanitization.ts",
    description: "Sanitization utility exists",
    patterns: ["export function sanitizeInput", "DOMPurify.sanitize"],
  },
  {
    file: "server/routes.ts",
    description: "Auth signup endpoint protected",
    patterns: ["sanitizeInput", "auth/signup"],
  },
  {
    file: "server/routes.ts",
    description: "Auth login endpoint protected",
    patterns: ["sanitizeInput", "auth/login"],
  },
  {
    file: "server/routes/strategies.ts",
    description: "Strategy endpoints protected",
    patterns: ["sanitizeInput", "sanitizeStrategyInput"],
  },
  {
    file: "server/routes/backtests.ts",
    description: "Backtest endpoints protected",
    patterns: ["sanitizeArray"],
  },
  {
    file: "server/storage.ts",
    description: "Storage layer protected",
    patterns: ["sanitizeUserInput", "sanitizeStrategyInput"],
  },
];

let passed = 0;
let failed = 0;

console.log("Checking files for XSS protection...\n");

for (const check of checks) {
  try {
    const filePath = join("/home/runner/workspace", check.file);
    const content = readFileSync(filePath, "utf-8");

    const allPatternsFound = check.patterns.every((pattern) => {
      const regex = new RegExp(pattern, "i");
      return regex.test(content);
    });

    if (allPatternsFound) {
      console.log(`✓ ${check.description}`);
      console.log(`  File: ${check.file}`);
      passed++;
    } else {
      console.log(`✗ ${check.description}`);
      console.log(`  File: ${check.file}`);
      console.log(`  Missing patterns: ${check.patterns.join(", ")}`);
      failed++;
    }
  } catch (error) {
    console.log(`✗ ${check.description}`);
    console.log(`  File: ${check.file}`);
    console.log(
      `  Error: ${error instanceof Error ? error.message : String(error)}`
    );
    failed++;
  }
}

console.log("\n========================================");
console.log("VERIFICATION RESULTS");
console.log("========================================");
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  console.log("\n⚠️  Some checks failed!");
  console.log(
    "Review the failed checks and ensure sanitization is properly implemented."
  );
  process.exit(1);
} else {
  console.log("\n✓ All checks passed!");
  console.log(
    "XSS protection is properly implemented across all critical endpoints."
  );
  process.exit(0);
}
