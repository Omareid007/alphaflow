const fs = require("fs");
const content = fs.readFileSync(
  "/home/runner/workspace/server/routes.ts",
  "utf8"
);
const lines = content.split("\n");

console.log("Original lines:", lines.length);

// Specific route patterns to remove (be very precise)
const routeRangesToRemove = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Only match exact app.METHOD patterns for our extracted routes
  const isNotificationRoute = line.match(
    /^\s*app\.(get|post|put|delete)\s*\(\s*["']\/api\/notifications/
  );
  const isUniverseRoute = line.match(
    /^\s*app\.(get|post)\s*\(\s*["']\/api\/universe/
  );
  const isCandidatesRoute = line.match(
    /^\s*app\.get\s*\(\s*["']\/api\/candidates"/
  );
  const isWatchlistRoute = line.match(
    /^\s*app\.get\s*\(\s*["']\/api\/watchlist"/
  );
  const isAllocationPolicyRoute = line.match(
    /^\s*app\.(get|post|patch|delete)\s*\(\s*["']\/api\/allocation-policies/
  );
  const isRebalanceRoute = line.match(
    /^\s*app\.(get|post)\s*\(\s*["']\/api\/rebalance/
  );
  const isEnforcementRoute = line.match(
    /^\s*app\.(get|post|patch|delete)\s*\(\s*["']\/api\/enforcement\/rules/
  );
  const isFundamentalsRoute = line.match(
    /^\s*app\.(get|post)\s*\(\s*["']\/api\/fundamentals/
  );
  const isStrategyConfigRoute = line.match(
    /^\s*app\.post\s*\(\s*["']\/api\/strategy-config"/
  );
  const isStrategyValidateRoute = line.match(
    /^\s*app\.post\s*\(\s*["']\/api\/strategy-validate"/
  );
  const isPortfolioSnapshotRoute = line.match(
    /^\s*app\.get\s*\(\s*["']\/api\/portfolio\/snapshot"/
  );
  const isTradingCandidatesRoute = line.match(
    /^\s*app\.get\s*\(\s*["']\/api\/trading\/candidates"/
  );

  const isTargetRoute =
    isNotificationRoute ||
    isUniverseRoute ||
    isCandidatesRoute ||
    isWatchlistRoute ||
    isAllocationPolicyRoute ||
    isRebalanceRoute ||
    isEnforcementRoute ||
    isFundamentalsRoute ||
    isStrategyConfigRoute ||
    isStrategyValidateRoute ||
    isPortfolioSnapshotRoute ||
    isTradingCandidatesRoute;

  if (isTargetRoute) {
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

      if (foundFirstBrace && braceCount === 0 && parenCount <= 0) {
        endLine = j;
        break;
      }

      if (j - i > 150) {
        console.log("Warning: Could not find end at line", startLine + 1);
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

console.log("Route blocks found to remove:", routeRangesToRemove.length);

// Create set of lines to remove
const linesToRemove = new Set();
for (const [start, end] of routeRangesToRemove) {
  for (let i = start; i <= end; i++) {
    linesToRemove.add(i);
  }
}

// Remove adjacent comment/blank lines before routes
for (const [start, _] of routeRangesToRemove) {
  for (let i = start - 1; i >= Math.max(0, start - 3); i--) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("//")) {
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
