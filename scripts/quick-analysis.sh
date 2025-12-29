#!/bin/bash
# Quick Codebase Analysis

echo "=== SIZE OVERVIEW ==="
du -sh --exclude=node_modules . 2>/dev/null || du -sh . 2>/dev/null
echo ""
echo "=== LARGEST DIRECTORIES ==="
du -sh */ 2>/dev/null | sort -rh | head -10
echo ""
echo "=== SOURCE FILE COUNT ==="
echo "TypeScript: $(find . -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | wc -l)"
echo "TSX: $(find . -name '*.tsx' -not -path '*/node_modules/*' 2>/dev/null | wc -l)"
echo "JavaScript: $(find . -name '*.js' -not -path '*/node_modules/*' 2>/dev/null | wc -l)"
echo ""
echo "=== DEPENDENCY CHECK ==="
if command -v npx &> /dev/null && [ -f package.json ]; then
    echo "Unused packages:"
    npx depcheck 2>/dev/null | head -10 || echo "(install depcheck: npm i -g depcheck)"
fi
