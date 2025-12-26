#!/bin/bash

# API Endpoint Testing Script
# This script tests all critical backend endpoints

API_BASE="http://localhost:3000"
REPORT_FILE="/home/runner/workspace/API_TEST_RESULTS.md"

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Initialize report
echo "# API Endpoint Test Results" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Test Date:** $(date)" >> "$REPORT_FILE"
echo "**API Base URL:** $API_BASE" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local auth_header=$4
    local expected_status=$5

    echo -e "${YELLOW}Testing: $method $endpoint${NC}"
    echo "### $description" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "- **Endpoint:** \`$method $endpoint\`" >> "$REPORT_FILE"
    echo "- **Expected Status:** $expected_status" >> "$REPORT_FILE"

    # Make the request
    if [ -z "$auth_header" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_BASE$endpoint" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -H "$auth_header" -X "$method" "$API_BASE$endpoint" 2>&1)
    fi

    # Extract status code (last line) and body (everything else)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Check if we got a valid status code
    if [[ ! "$status_code" =~ ^[0-9]{3}$ ]]; then
        echo -e "${RED}✗ Failed - Connection Error${NC}"
        echo "- **Actual Status:** Connection Error" >> "$REPORT_FILE"
        echo "- **Result:** ❌ FAILED" >> "$REPORT_FILE"
        echo "- **Error:** Unable to connect to server" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        echo "$response" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        return 1
    fi

    echo "- **Actual Status:** $status_code" >> "$REPORT_FILE"

    # Check if status matches expected
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ Passed - Status: $status_code${NC}"
        echo "- **Result:** ✅ PASSED" >> "$REPORT_FILE"
    else
        echo -e "${RED}✗ Failed - Expected: $expected_status, Got: $status_code${NC}"
        echo "- **Result:** ❌ FAILED (Expected $expected_status)" >> "$REPORT_FILE"
    fi

    # Add response body (truncated if too long)
    echo "" >> "$REPORT_FILE"
    echo "**Response Body:**" >> "$REPORT_FILE"
    echo "\`\`\`json" >> "$REPORT_FILE"
    if [ ${#body} -gt 1000 ]; then
        echo "$body" | head -c 1000 >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "... (truncated)" >> "$REPORT_FILE"
    else
        echo "$body" >> "$REPORT_FILE"
    fi
    echo "\`\`\`" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
}

echo ""
echo "=================================================="
echo "  API ENDPOINT TESTING"
echo "=================================================="
echo ""

# Wait for server to be ready
echo "Waiting for server to be ready..."
sleep 2

# Test 1: Public Endpoints (No Auth Required)
echo "" >> "$REPORT_FILE"
echo "## 1. Public Endpoints (No Auth Required)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

test_endpoint "GET" "/api/auth/me" "Auth Status Check" "" "200"

# Test 2: Protected Endpoints (Should return 401 without auth)
echo "" >> "$REPORT_FILE"
echo "## 2. Protected Endpoints (Should Return 401 Without Auth)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

test_endpoint "GET" "/api/backtests" "List Backtests (No Auth)" "" "401"
test_endpoint "GET" "/api/strategies" "List Strategies (No Auth)" "" "401"
test_endpoint "GET" "/api/positions" "List Positions (No Auth)" "" "401"
test_endpoint "GET" "/api/ai-decisions" "List AI Decisions (No Auth)" "" "401"
test_endpoint "GET" "/api/feeds" "List Feeds (No Auth)" "" "401"
test_endpoint "GET" "/api/ai/sentiment" "AI Sentiment (No Auth)" "" "401"

# Test 3: Health Check Endpoints
echo "" >> "$REPORT_FILE"
echo "## 3. Health Check Endpoints" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

test_endpoint "GET" "/api/health/db" "Database Health Check" "" "200"
test_endpoint "GET" "/api/alpaca/health" "Alpaca Health Check" "" "200"

# Additional endpoint discovery
echo "" >> "$REPORT_FILE"
echo "## 4. Additional Endpoint Tests" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Test root endpoint
test_endpoint "GET" "/" "Root Endpoint" "" "200"
test_endpoint "GET" "/api" "API Root" "" "200"

# Test common trading endpoints
test_endpoint "GET" "/api/trading/candidates" "Trading Candidates (Public)" "" "200"
test_endpoint "GET" "/api/watchlist" "Watchlist (Public)" "" "200"

# Test health endpoint
test_endpoint "GET" "/health" "Health Endpoint" "" "200"

echo ""
echo "=================================================="
echo "  TEST SUMMARY"
echo "=================================================="
echo ""

# Generate summary
echo "" >> "$REPORT_FILE"
echo "## Summary" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Count results
total_tests=$(grep -c "### " "$REPORT_FILE")
passed_tests=$(grep -c "✅ PASSED" "$REPORT_FILE")
failed_tests=$(grep -c "❌ FAILED" "$REPORT_FILE")

echo "- **Total Tests:** $total_tests" >> "$REPORT_FILE"
echo "- **Passed:** $passed_tests" >> "$REPORT_FILE"
echo "- **Failed:** $failed_tests" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ $failed_tests -eq 0 ]; then
    echo "- **Overall Status:** ✅ All tests passed" >> "$REPORT_FILE"
    echo -e "${GREEN}All tests passed!${NC}"
else
    echo "- **Overall Status:** ⚠️ Some tests failed" >> "$REPORT_FILE"
    echo -e "${RED}$failed_tests test(s) failed${NC}"
fi

echo ""
echo "Report saved to: $REPORT_FILE"
echo ""
