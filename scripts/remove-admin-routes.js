const fs = require("fs");
const content = fs.readFileSync(
  "/home/runner/workspace/server/routes.ts",
  "utf8"
);
const lines = content.split("\n");

console.log("Original lines:", lines.length);

// Find all admin route handlers and their closing braces
const adminRouteRanges = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Match app.get/post/put/patch/delete with /api/admin path
  const routeMatch = line.match(
    /app\.(get|post|put|patch|delete)\s*\(\s*["']\/api\/admin/
  );

  if (routeMatch) {
    const startLine = i;
    let braceCount = 0;
    let foundStart = false;
    let endLine = i;

    // Find the matching closing });
    for (let j = i; j < lines.length; j++) {
      const checkLine = lines[j];

      // Count opening braces
      for (const char of checkLine) {
        if (char === "{") {
          braceCount++;
          foundStart = true;
        }
        if (char === "}") {
          braceCount--;
        }
      }

      // Check if we've closed the route handler
      if (foundStart && braceCount === 0 && checkLine.trim().endsWith("});")) {
        endLine = j;
        break;
      }

      // Safety: don't go more than 100 lines
      if (j - i > 100) {
        console.log(
          "Warning: Could not find end of route at line",
          startLine + 1
        );
        endLine = i;
        break;
      }
    }

    adminRouteRanges.push([startLine, endLine]);
    // Skip to end of this route to avoid double-counting
    i = endLine;
  }
}

console.log("Admin route handlers found:", adminRouteRanges.length);
console.log("Sample ranges (0-indexed):", adminRouteRanges.slice(0, 3));

// Now remove these ranges
const linesToRemove = new Set();
for (const [start, end] of adminRouteRanges) {
  for (let i = start; i <= end; i++) {
    linesToRemove.add(i);
  }
}

// Also remove comment blocks immediately before admin routes
// Look for lines like "// Admin API" or "// ====" patterns
for (const [start, _] of adminRouteRanges) {
  // Look up to 5 lines before for comment headers
  for (let i = start - 1; i >= Math.max(0, start - 5); i--) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("//")) {
      // Check if this is part of a comment block for admin
      if (line.includes("Admin") || line.match(/^\/\/\s*=+$/)) {
        linesToRemove.add(i);
      }
    } else {
      break; // Stop if we hit actual code
    }
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
