const fs = require('fs');
const content = fs.readFileSync('/home/runner/workspace/server/routes.ts', 'utf8');
const lines = content.split('\n');

console.log('Original lines:', lines.length);

// Final cleanup - remove remaining duplicates
const routePatternsToRemove = [
    // Alpaca routes (handled by alpacaRouter)
    /app\.get\s*\(\s*["']\/api\/alpaca/,
    /app\.post\s*\(\s*["']\/api\/alpaca/,

    // Risk routes (handled by riskRouter)
    /app\.get\s*\(\s*["']\/api\/risk/,
    /app\.post\s*\(\s*["']\/api\/risk/,

    // AI decisions remaining routes (handled by aiDecisionsRouter)
    /app\.get\s*\(\s*["']\/api\/ai-decisions\/history['"]/,
    /app\.get\s*\(\s*["']\/api\/ai-decisions\/enriched['"]/,
];

const routeRangesToRemove = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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

        for (let j = i; j < lines.length; j++) {
            const checkLine = lines[j];

            for (let k = 0; k < checkLine.length; k++) {
                const char = checkLine[k];

                if (char === '"' || char === "'" || char === '`') {
                    const quote = char;
                    k++;
                    while (k < checkLine.length && checkLine[k] !== quote) {
                        if (checkLine[k] === '\\') k++;
                        k++;
                    }
                    continue;
                }

                if (char === '{') {
                    braceCount++;
                    foundFirstBrace = true;
                }
                if (char === '}') braceCount--;
                if (char === '(') parenCount++;
                if (char === ')') parenCount--;
            }

            if (foundFirstBrace && braceCount === 0 && parenCount <= 0) {
                endLine = j;
                break;
            }

            if (j - i > 350) {
                console.log('Warning: Could not find end at line', startLine + 1);
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

console.log('Route blocks found:', routeRangesToRemove.length);

const linesToRemove = new Set();
for (const [start, end] of routeRangesToRemove) {
    for (let i = start; i <= end; i++) {
        linesToRemove.add(i);
    }
}

// Remove comment blocks before routes
for (const [start, _] of routeRangesToRemove) {
    for (let i = start - 1; i >= Math.max(0, start - 4); i--) {
        const line = lines[i].trim();
        if (line === '' || line.startsWith('//')) {
            linesToRemove.add(i);
        } else {
            break;
        }
    }
}

const filteredLines = lines.filter((_, index) => !linesToRemove.has(index));

console.log('Lines removed:', lines.length - filteredLines.length);
console.log('New line count:', filteredLines.length);

fs.writeFileSync('/home/runner/workspace/server/routes.ts', filteredLines.join('\n'));
console.log('File updated successfully');
