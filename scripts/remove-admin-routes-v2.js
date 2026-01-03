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
    /^\s*app\.(get|post|put|patch|delete)\s*\(\s*["']\/api\/admin/
  );

  if (routeMatch) {
    const startLine = i;
    let braceCount = 0;
    let parenCount = 0;
    let foundFirstBrace = false;
    let endLine = i;

    // Find the matching closing });
    // We need to track both braces {} and parentheses ()
    for (let j = i; j < lines.length; j++) {
      const checkLine = lines[j];

      for (let k = 0; k < checkLine.length; k++) {
        const char = checkLine[k];

        // Skip characters inside strings
        if (char === '"' || char === "'" || char === "`") {
          // Simple string skip - find the closing quote
          const quote = char;
          k++;
          while (k < checkLine.length && checkLine[k] !== quote) {
            if (checkLine[k] === "\\") k++; // skip escaped char
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

      // Route handler ends when we close all braces and the line ends with });
      // or when both brace and paren counts are 0 after seeing the first brace
      if (foundFirstBrace && braceCount === 0 && parenCount <= 0) {
        endLine = j;
        break;
      }

      // Safety: don't go more than 200 lines
      if (j - i > 200) {
        console.log(
          "Warning: Could not find end of route at line",
          startLine + 1,
          "after 200 lines"
        );
        console.log("First line:", lines[i].substring(0, 80));
        endLine = -1; // Mark as failed
        break;
      }
    }

    if (endLine >= 0) {
      adminRouteRanges.push([startLine, endLine]);
      // Skip to end of this route to avoid double-counting
      i = endLine;
    }
  }
}

console.log("Admin route handlers found:", adminRouteRanges.length);

// Create set of lines to remove
const linesToRemove = new Set();
for (const [start, end] of adminRouteRanges) {
  for (let i = start; i <= end; i++) {
    linesToRemove.add(i);
  }
}

// Also remove comment blocks immediately before admin routes
for (const [start, _] of adminRouteRanges) {
  // Look up to 5 lines before for comment headers
  for (let i = start - 1; i >= Math.max(0, start - 5); i--) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("//")) {
      linesToRemove.add(i);
    } else {
      break; // Stop if we hit actual code
    }
  }
}

// Remove empty line runs (more than 2 consecutive empty lines become 2)
const filteredLines = lines.filter((_, index) => !linesToRemove.has(index));

console.log("Lines removed:", lines.length - filteredLines.length);
console.log("New line count:", filteredLines.length);

// Verify by checking for orphaned code patterns
let hasOrphanedCode = false;
for (let i = 0; i < filteredLines.length - 1; i++) {
  const line = filteredLines[i].trim();
  const nextLine = filteredLines[i + 1]?.trim() || "";

  // Check for orphaned try blocks
  if (line === "" && nextLine === "try {") {
    console.log("Warning: Possible orphaned code at new line", i + 1);
    hasOrphanedCode = true;
  }
}

if (hasOrphanedCode) {
  console.log("ERROR: Orphaned code detected. Not writing file.");
  process.exit(1);
}

// Write the result
fs.writeFileSync(
  "/home/runner/workspace/server/routes.ts",
  filteredLines.join("\n")
);
console.log("File updated successfully");
