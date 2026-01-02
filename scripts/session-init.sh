#!/bin/bash
# session-init.sh
# SessionStart hook to initialize trading session
# Loads current positions and market state

set -e

echo "=== Trading Session Initialized ==="
echo "Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"

# Check Alpaca connection
if [ -n "$ALPACA_API_KEY" ] && [ -n "$ALPACA_SECRET_KEY" ]; then
    # Get account info
    ACCOUNT=$(curl -s \
        -H "APCA-API-KEY-ID: $ALPACA_API_KEY" \
        -H "APCA-API-SECRET-KEY: $ALPACA_SECRET_KEY" \
        "https://paper-api.alpaca.markets/v2/account" 2>/dev/null || echo '{}')

    EQUITY=$(echo "$ACCOUNT" | grep -o '"equity":"[^"]*"' | cut -d'"' -f4)
    BUYING_POWER=$(echo "$ACCOUNT" | grep -o '"buying_power":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$EQUITY" ]; then
        echo "Alpaca: Connected"
        echo "Equity: \$$EQUITY"
        echo "Buying Power: \$$BUYING_POWER"
    else
        echo "Alpaca: Connection failed"
    fi

    # Get position count
    POSITIONS=$(curl -s \
        -H "APCA-API-KEY-ID: $ALPACA_API_KEY" \
        -H "APCA-API-SECRET-KEY: $ALPACA_SECRET_KEY" \
        "https://paper-api.alpaca.markets/v2/positions" 2>/dev/null || echo '[]')

    POS_COUNT=$(echo "$POSITIONS" | grep -o '"symbol"' | wc -l)
    echo "Open Positions: $POS_COUNT"

    # Get market status
    CLOCK=$(curl -s \
        -H "APCA-API-KEY-ID: $ALPACA_API_KEY" \
        -H "APCA-API-SECRET-KEY: $ALPACA_SECRET_KEY" \
        "https://paper-api.alpaca.markets/v2/clock" 2>/dev/null || echo '{}')

    IS_OPEN=$(echo "$CLOCK" | grep -o '"is_open":[^,}]*' | cut -d':' -f2 | tr -d ' ')
    if [ "$IS_OPEN" = "true" ]; then
        echo "Market: OPEN"
    else
        echo "Market: CLOSED"
    fi
else
    echo "Alpaca: Not configured (missing API keys)"
fi

# Check circuit breaker
CB_STATUS=$(curl -s http://localhost:5000/api/alpaca/circuit-breaker/status 2>/dev/null || echo '{}')
CB_OPEN=$(echo "$CB_STATUS" | grep -o '"isOpen":[^,}]*' | cut -d':' -f2 | tr -d ' ')
if [ "$CB_OPEN" = "true" ]; then
    echo "Circuit Breaker: OPEN (trading blocked)"
else
    echo "Circuit Breaker: NORMAL"
fi

echo "==================================="
