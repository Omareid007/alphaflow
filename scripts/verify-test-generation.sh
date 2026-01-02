#!/bin/bash
#
# Verify OpenSpec Test Generation Setup
#
# Checks that all required files and dependencies are in place
# for automatic test generation from OpenSpec specifications.
#

set -e

echo "OpenSpec Test Generation - Setup Verification"
echo "============================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check file exists
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} Found: $1"
  else
    echo -e "${RED}✗${NC} Missing: $1"
    ERRORS=$((ERRORS + 1))
  fi
}

# Function to check directory exists
check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} Found: $1"
  else
    echo -e "${RED}✗${NC} Missing: $1"
    ERRORS=$((ERRORS + 1))
  fi
}

# Check generator script
echo "Checking generator script..."
check_file "scripts/generate-tests-from-openspec.ts"
echo ""

# Check documentation
echo "Checking documentation..."
check_file "docs/OPENSPEC_TEST_GENERATION.md"
check_file "docs/OPENSPEC_QUICK_START.md"
check_file "docs/TEST_GENERATION_SUMMARY.md"
check_file "docs/examples/SAMPLE_GENERATED_TEST.md"
check_file "TESTING.md"
check_file "tests/generated/openspec/README.md"
echo ""

# Check OpenSpec specs
echo "Checking OpenSpec specifications..."
check_dir "openspec/specs"

SPEC_FILES=(
  "authentication/spec.md"
  "trading-orders/spec.md"
  "strategy-management/spec.md"
  "portfolio-management/spec.md"
  "market-data/spec.md"
  "ai-analysis/spec.md"
  "admin-system/spec.md"
  "real-time-streaming/spec.md"
)

for spec in "${SPEC_FILES[@]}"; do
  check_file "openspec/specs/$spec"
done
echo ""

# Check output directory
echo "Checking output directory..."
check_dir "tests/generated/openspec"
echo ""

# Check test helpers
echo "Checking test infrastructure..."
check_file "tests/e2e/test-helpers.ts"
check_file "vitest.config.ts"
check_file "tests/setup.ts"
echo ""

# Check package.json scripts
echo "Checking npm scripts..."
if grep -q "\"generate-tests\"" package.json; then
  echo -e "${GREEN}✓${NC} Found: npm script 'generate-tests'"
else
  echo -e "${RED}✗${NC} Missing: npm script 'generate-tests'"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "\"test:coverage\"" package.json; then
  echo -e "${GREEN}✓${NC} Found: npm script 'test:coverage'"
else
  echo -e "${YELLOW}⚠${NC} Missing: npm script 'test:coverage' (optional)"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Count scenarios
echo "Counting OpenSpec scenarios..."
SCENARIO_COUNT=$(grep -r "^#### Scenario:" openspec/specs --include="spec.md" | wc -l)
echo -e "${GREEN}✓${NC} Found: $SCENARIO_COUNT scenarios across all specs"
echo ""

# Check dependencies
echo "Checking dependencies..."
if command -v tsx &> /dev/null; then
  echo -e "${GREEN}✓${NC} Found: tsx (required to run generator)"
else
  echo -e "${RED}✗${NC} Missing: tsx (install with: npm install)"
  ERRORS=$((ERRORS + 1))
fi

if command -v vitest &> /dev/null || [ -f "node_modules/.bin/vitest" ]; then
  echo -e "${GREEN}✓${NC} Found: vitest (required to run tests)"
else
  echo -e "${RED}✗${NC} Missing: vitest (install with: npm install)"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Summary
echo "============================================================"
echo "Verification Summary"
echo "============================================================"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "You can now generate tests with:"
  echo "  npm run generate-tests"
  echo ""
  echo "And run them with:"
  echo "  npm run test -- tests/generated/openspec"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Found $ERRORS error(s)${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $WARNINGS warning(s)${NC}"
  fi
  echo ""
  echo "Please fix the errors above before running the generator."
  echo ""
  exit 1
fi
