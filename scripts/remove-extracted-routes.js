const fs = require("fs");
const content = fs.readFileSync(
  "/home/runner/workspace/server/routes.ts",
  "utf8"
);
const lines = content.split("\n");

console.log("Original lines:", lines.length);

// Line ranges identified by agents (1-indexed)
// Remove from highest to lowest to preserve line numbers
const rangesToRemove = [
  [2966, 3086], // Enforcement/fundamentals
  [2834, 2964], // Allocation/rebalance
  [2790, 2832], // Universe (candidates/watchlist)
  [2695, 2787], // Universe (stats/symbols/search/check/sync)
  [2523, 2692], // Notifications (import block + all routes)
  [384, 485], // Portfolio/trading (strategy-config, strategy-validate, portfolio snapshot, trading candidates)
];

// Sort by start line (descending) to remove from end to beginning
rangesToRemove.sort((a, b) => b[0] - a[0]);

console.log("Ranges to remove (high to low):", rangesToRemove);

// Convert to 0-indexed and filter
const linesToRemove = new Set();
for (const [start, end] of rangesToRemove) {
  for (let i = start - 1; i <= end - 1; i++) {
    linesToRemove.add(i);
  }
}

const filteredLines = lines.filter((_, index) => !linesToRemove.has(index));

console.log("Lines removed:", lines.length - filteredLines.length);
console.log("New line count:", filteredLines.length);

// Write the result
fs.writeFileSync(
  "/home/runner/workspace/server/routes.ts",
  filteredLines.join("\n")
);
console.log("File updated successfully");
