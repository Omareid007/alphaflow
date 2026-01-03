#!/bin/bash
# AlphaFlow Pre-Commit Hook
# Prevents committing forbidden file patterns

echo "Running pre-commit checks..."

# Check for forbidden file patterns
FORBIDDEN=$(git diff --cached --name-only | grep -E "(_COMPLETE\.md|_IMPLEMENTATION\.md|_INTEGRATION\.md|\.bak$|\.old$|\.backup$|_new\.|_temp\.)")
if [ -n "$FORBIDDEN" ]; then
    echo "ERROR: Attempting to commit forbidden file patterns:"
    echo "$FORBIDDEN"
    echo ""
    echo "Remove these files and try again."
    exit 1
fi

# Check for .env files
if git diff --cached --name-only | grep -q "^\.env"; then
    echo "ERROR: Cannot commit .env files"
    exit 1
fi

# Check for large files (>5MB)
LARGE_FILES=$(git diff --cached --name-only | xargs -I {} sh -c 'test -f "{}" && du -k "{}" | awk "\$1 > 5120 {print \$2}"' 2>/dev/null)
if [ -n "$LARGE_FILES" ]; then
    echo "WARNING: Large files detected (>5MB):"
    echo "$LARGE_FILES"
    echo "Consider if these should be committed."
fi

echo "Pre-commit checks passed!"
exit 0
