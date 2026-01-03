const fs = require("fs");
const content = fs.readFileSync(
  "/home/runner/workspace/server/routes.ts",
  "utf8"
);
const lines = content.split("\n");

console.log("Original lines:", lines.length);

// Pattern-based route identification (more robust than fixed line numbers)
const routePatternsToRemove = [
  // Admin routes
  /app\.(get|post|put|patch|delete)\s*\(\s*["']\/api\/admin/,
  // Notifications routes and imports
  /\/\/.*NOTIFICATION.*SYSTEM/i,
  /import.*notification-service/,
  /registerChannel|getChannel|updateChannel|deleteChannel/,
  /registerTemplate|getTemplate|updateTemplate|deleteTemplate/,
  /sendNotification|getNotificationHistory|getNotificationStats/,
  /redactChannelConfig/,
  /app\.(get|post|put|patch|delete)\s*\(\s*["']\/api\/notifications/,
  // Universe routes
  /app\.(get|post)\s*\(\s*["']\/api\/universe/,
  /app\.get\s*\(\s*["']\/api\/candidates"/,
  /app\.get\s*\(\s*["']\/api\/watchlist"/,
  // Allocation policies routes
  /app\.(get|post|patch|delete)\s*\(\s*["']\/api\/allocation-policies/,
  // Rebalance routes
  /app\.(get|post)\s*\(\s*["']\/api\/rebalance/,
  // Enforcement rules routes
  /app\.(get|post|patch|delete)\s*\(\s*["']\/api\/enforcement\/rules/,
  // Fundamentals routes
  /app\.(get|post)\s*\(\s*["']\/api\/fundamentals/,
  // Portfolio/trading utility routes
  /app\.post\s*\(\s*["']\/api\/strategy-config"/,
  /app\.post\s*\(\s*["']\/api\/strategy-validate"/,
  /app\.get\s*\(\s*["']\/api\/portfolio\/snapshot"/,
  /app\.get\s*\(\s*["']\/api\/trading\/candidates"/,
];

// Find all route handler ranges
const routeRangesToRemove = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Check if this line matches any pattern
  let matched = false;
  for (const pattern of routePatternsToRemove) {
    if (pattern.test(line)) {
      matched = true;
      break;
    }
  }

  if (matched) {
    const startLine = i;
    let braceCount = 0;
    let parenCount = 0;
    let foundFirstBrace = false;
    let endLine = i;

    // Find the matching closing });
    for (let j = i; j < lines.length; j++) {
      const checkLine = lines[j];

      for (let k = 0; k < checkLine.length; k++) {
        const char = checkLine[k];

        // Skip characters inside strings
        if (char === '"' || char === "'" || char === "`") {
          const quote = char;
          k++;
          while (k < checkLine.length && checkLine[k] !== quote) {
            if (checkLine[k] === "\\\\") k++;
            k++;
          }
          continue;
        }

        if (char === "{") {
          braceCount++;
          foundFirstBrace = true;
        }
        if (char === "}") {
          braceCount--;
        }
        if (char === "(") {
          parenCount++;
        }
        if (char === ")") {
          parenCount--;
        }
      }

      // For imports and simple statements, just remove the line
      if (!line.includes("app.") && !line.includes("router.")) {
        endLine = i;
        break;
      }

      // For route handlers, find the closing });
      if (foundFirstBrace && braceCount === 0 && parenCount <= 0) {
        endLine = j;
        break;
      }

      if (j - i > 250) {
        console.log(
          "Warning: Could not find end at line",
          startLine + 1,
          ":",
          line.substring(0, 60)
        );
        endLine = -1;
        break;
      }
    }

    if (endLine >= 0) {
      routeRangesToRemove.push([startLine, endLine]);
      i = endLine;
    }
  }
}

console.log("Route blocks found:", routeRangesToRemove.length);

// Create set of lines to remove
const linesToRemove = new Set();
for (const [start, end] of routeRangesToRemove) {
  for (let i = start; i <= end; i++) {
    linesToRemove.add(i);
  }
}

// Remove adjacent comment blocks
for (const [start, _] of routeRangesToRemove) {
  for (let i = start - 1; i >= Math.max(0, start - 5); i--) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("//") || line.startsWith("/*")) {
      linesToRemove.add(i);
    } else {
      break;
    }
  }
}

const filteredLines = lines.filter((_, index) => !linesToRemove.has(index));

console.log("Lines removed:", lines.length - filteredLines.length);
console.log("New line count:", filteredLines.length);

fs.writeFileSync(
  "/home/runner/workspace/server/routes.ts",
  filteredLines.join("\n")
);
console.log("File updated successfully");
