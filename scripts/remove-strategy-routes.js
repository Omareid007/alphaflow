const fs = require("fs");
const content = fs.readFileSync(
  "/home/runner/workspace/server/routes.ts",
  "utf8"
);
const lines = content.split("\n");

console.log("Original lines:", lines.length);

// Find all strategy route handlers (excluding the router mount)
const strategyRouteRanges = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Match app.get/post/put/patch/delete with /api/strategies path (but not app.use)
  const routeMatch = line.match(
    /^\s*app\.(get|post|put|patch|delete)\s*\(\s*["']\/api\/strategies/
  );

  if (routeMatch) {
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
            if (checkLine[k] === "\\") k++;
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

      if (j - i > 100) {
        console.log(
          "Warning: Could not find end of route at line",
          startLine + 1
        );
        endLine = -1;
        break;
      }
    }

    if (endLine >= 0) {
      strategyRouteRanges.push([startLine, endLine]);
      i = endLine;
    }
  }
}

console.log("Strategy route handlers found:", strategyRouteRanges.length);

// Create set of lines to remove
const linesToRemove = new Set();
for (const [start, end] of strategyRouteRanges) {
  for (let i = start; i <= end; i++) {
    linesToRemove.add(i);
  }
}

// Also remove comment blocks immediately before
for (const [start, _] of strategyRouteRanges) {
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
