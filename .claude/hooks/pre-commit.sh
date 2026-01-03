#!/bin/bash
echo "Pre-commit checks..."

# Block forbidden files
FORBIDDEN=$(git diff --cached --name-only | grep -E "(_COMPLETE\.md|_IMPLEMENTATION\.md|\.bak$|\.old$)")
if [ -n "$FORBIDDEN" ]; then
    echo "ERROR: Forbidden file patterns:"
    echo "$FORBIDDEN"
    exit 1
fi

# Block .env files
if git diff --cached --name-only | grep -q "^\.env"; then
    echo "ERROR: Cannot commit .env files"
    exit 1
fi

echo "Pre-commit OK"
exit 0
