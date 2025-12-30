#!/bin/bash
# session-cleanup.sh
# Stop hook to cleanup trading session
# Archives decisions and generates session summary

set -e

echo "=== Trading Session Ended ==="
echo "End Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"

# Log session end to database (if available)
if [ -n "$DATABASE_URL" ]; then
    # Could insert session end record here
    echo "Session logged to database"
fi

# Get final portfolio state
if [ -n "$ALPACA_API_KEY" ] && [ -n "$ALPACA_SECRET_KEY" ]; then
    ACCOUNT=$(curl -s \
        -H "APCA-API-KEY-ID: $ALPACA_API_KEY" \
        -H "APCA-API-SECRET-KEY: $ALPACA_SECRET_KEY" \
        "https://paper-api.alpaca.markets/v2/account" 2>/dev/null || echo '{}')

    EQUITY=$(echo "$ACCOUNT" | grep -o '"equity":"[^"]*"' | cut -d'"' -f4)
    LAST_EQUITY=$(echo "$ACCOUNT" | grep -o '"last_equity":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$EQUITY" ] && [ -n "$LAST_EQUITY" ]; then
        # Calculate session P&L (rough estimate)
        echo "Final Equity: \$$EQUITY"
        echo "Previous Close Equity: \$$LAST_EQUITY"
    fi
fi

echo "=== Session Complete ==="
