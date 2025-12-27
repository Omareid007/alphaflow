const fs = require('fs');
const content = fs.readFileSync('/home/runner/workspace/server/routes.ts', 'utf8');
const lines = content.split('\n');

console.log('Original lines:', lines.length);

// All route patterns to remove (routes now handled by dedicated routers)
const routePatternsToRemove = [
    // AI decisions routes (handled by aiDecisionsRouter)
    /app\.get\s*\(\s*["']\/api\/ai-decisions['"]/,
    /app\.post\s*\(\s*["']\/api\/ai-decisions['"]/,

    // Analytics routes (handled by analyticsRouter)
    /app\.get\s*\(\s*["']\/api\/analytics/,

    // Crypto routes (handled by cryptoRouter)
    /app\.get\s*\(\s*["']\/api\/crypto/,

    // Stock routes (handled by stockRouter)
    /app\.get\s*\(\s*["']\/api\/stock/,

    // UAE markets routes (handled by uaeMarketsRouter)
    /app\.get\s*\(\s*["']\/api\/uae/,

    // News routes (handled by newsRouter)
    /app\.get\s*\(\s*["']\/api\/news/,

    // CMC routes (handled by cmcRouter)
    /app\.get\s*\(\s*["']\/api\/cmc/,

    // Trading sessions routes (handled by tradingSessionsRouter)
    /app\.get\s*\(\s*["']\/api\/trading-sessions/,

    // Feeds route (handled by feedsRouter)
    /app\.get\s*\(\s*["']\/api\/feeds['"]/,

    // Connectors route (handled by connectorsRouter)
    /app\.get\s*\(\s*["']\/api\/connectors/,

    // Fusion routes (handled by fusionRouter)
    /app\.get\s*\(\s*["']\/api\/fusion/,

    // Market quotes route (handled by marketQuotesRouter)
    /app\.get\s*\(\s*["']\/api\/market/,

    // Health route (handled by healthRouter)
    /app\.get\s*\(\s*["']\/api\/health/,

    // AI analysis routes (handled by aiAnalysisRouter)
    /app\.post\s*\(\s*["']\/api\/ai\/analyze['"]/,
    /app\.get\s*\(\s*["']\/api\/ai\/status['"]/,
    /app\.get\s*\(\s*["']\/api\/ai\/events['"]/,
    /app\.get\s*\(\s*["']\/api\/ai\/cache/,
    /app\.post\s*\(\s*["']\/api\/ai\/cache/,
    /app\.get\s*\(\s*["']\/api\/ai\/sentiment['"]/,

    // Agent control routes (handled by agentControlRouter)
    /app\.get\s*\(\s*["']\/api\/agent\/status['"]/,
    /app\.post\s*\(\s*["']\/api\/agent\/toggle['"]/,

    // Activity timeline route (handled by activityRouter)
    /app\.get\s*\(\s*["']\/api\/activity\/timeline['"]/,

    // Performance metrics route (handled by performanceRouter)
    /app\.get\s*\(\s*["']\/api\/performance\/metrics['"]/,
];

// Find all matching route blocks
const routeRangesToRemove = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line matches any removal pattern
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
                if (char === '}') {
                    braceCount--;
                }
                if (char === '(') {
                    parenCount++;
                }
                if (char === ')') {
                    parenCount--;
                }
            }

            if (foundFirstBrace && braceCount === 0 && parenCount <= 0) {
                endLine = j;
                break;
            }

            if (j - i > 250) {
                console.log('Warning: Could not find end at line', startLine + 1, '-', line.substring(0, 70));
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

// Create set of lines to remove
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
