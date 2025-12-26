#!/usr/bin/env tsx
/**
 * Migrate console.* calls to structured logger
 *
 * This script replaces console.log/error/warn/info calls with the structured logger
 * Preserves context and converts to proper log levels
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

interface Replacement {
  pattern: RegExp;
  replacement: string;
  description: string;
}

// Migration patterns
const replacements: Replacement[] = [
  // console.log("[Context] message", data) -> log.info("Context", "message", data)
  {
    pattern: /console\.log\(\[([^\]]+)\]\s*([^,\)]+)(?:,\s*([^)]+))?\)/g,
    replacement: 'log.info("$1", $2, $3)',
    description: 'console.log with [Context] prefix',
  },
  // console.error("[Context] message", data) -> log.error("Context", "message", data)
  {
    pattern: /console\.error\(\[([^\]]+)\]\s*([^,\)]+)(?:,\s*([^)]+))?\)/g,
    replacement: 'log.error("$1", $2, $3)',
    description: 'console.error with [Context] prefix',
  },
  // console.warn("[Context] message", data) -> log.warn("Context", "message", data)
  {
    pattern: /console\.warn\(\[([^\]]+)\]\s*([^,\)]+)(?:,\s*([^)]+))?\)/g,
    replacement: 'log.warn("$1", $2, $3)',
    description: 'console.warn with [Context] prefix',
  },
  // console.info("[Context] message", data) -> log.info("Context", "message", data)
  {
    pattern: /console\.info\(\[([^\]]+)\]\s*([^,\)]+)(?:,\s*([^)]+))?\)/g,
    replacement: 'log.info("$1", $2, $3)',
    description: 'console.info with [Context] prefix',
  },
];

function migrateFile(filePath: string): { changed: boolean; count: number } {
  let content = readFileSync(filePath, 'utf-8');
  let count = 0;
  let changed = false;

  // Apply each replacement pattern
  for (const { pattern, replacement } of replacements) {
    const before = content;
    content = content.replace(pattern, (match) => {
      count++;
      return replacement.replace(/\$(\d)/g, (_, n) => {
        const groups = match.match(pattern);
        return groups?.[parseInt(n)] || '';
      });
    });
    if (content !== before) {
      changed = true;
    }
  }

  // Ensure log import exists if changes were made
  if (changed && !content.includes('import { log }')) {
    // Find the import section and add log import
    const importPattern = /^(import .+from .+;)$/m;
    const match = importPattern.exec(content);
    if (match) {
      const importStatement = 'import { log } from "../utils/logger";';
      if (!content.includes(importStatement)) {
        content = content.replace(match[0], `${match[0]}\n${importStatement}`);
      }
    }
  }

  if (changed) {
    writeFileSync(filePath, content, 'utf-8');
  }

  return { changed, count };
}

// Main execution
const files = globSync('server/**/*.ts', {
  ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
});

console.log(`Found ${files.length} TypeScript files to process`);

let totalChanged = 0;
let totalReplacements = 0;

for (const file of files) {
  const { changed, count } = migrateFile(file);
  if (changed) {
    totalChanged++;
    totalReplacements += count;
    console.log(`✓ ${file}: ${count} replacements`);
  }
}

console.log('');
console.log(`Migration complete:`);
console.log(`- Files changed: ${totalChanged}`);
console.log(`- Total replacements: ${totalReplacements}`);
console.log(`- Remaining console.* calls: Run 'grep -r "console\\." server/ --include="*.ts" | wc -l' to check`);
