#!/bin/bash
# AlphaFlow Stop Hook
# Validates work before session ends

echo "Running stop hook validation..."

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "WARNING: Uncommitted changes detected"
    git status --short
fi

# Check for forbidden files in workspace
FORBIDDEN=$(find . -name "*_COMPLETE.md" -o -name "*_IMPLEMENTATION.md" -o -name "*.bak" -o -name "*.old" 2>/dev/null | grep -v node_modules | grep -v .git)
if [ -n "$FORBIDDEN" ]; then
    echo "WARNING: Forbidden files found in workspace:"
    echo "$FORBIDDEN"
fi

# Quick build check
echo "Checking build status..."
npm run build --silent 2>/dev/null
if [ $? -ne 0 ]; then
    echo "WARNING: Build is failing"
else
    echo "Build: OK"
fi

echo "Stop hook complete."
