#!/bin/bash
# inject-market-context.sh
# UserPromptSubmit hook to inject market context into prompts
# Outputs context that will be prepended to user prompts

set -e

# Get market clock status
if [ -n "$ALPACA_API_KEY" ] && [ -n "$ALPACA_SECRET_KEY" ]; then
    MARKET_CLOCK=$(curl -s \
        -H "APCA-API-KEY-ID: $ALPACA_API_KEY" \
        -H "APCA-API-SECRET-KEY: $ALPACA_SECRET_KEY" \
        "https://paper-api.alpaca.markets/v2/clock" 2>/dev/null || echo '{}')

    IS_OPEN=$(echo "$MARKET_CLOCK" | grep -o '"is_open":[^,}]*' | cut -d':' -f2 | tr -d ' ')
    NEXT_OPEN=$(echo "$MARKET_CLOCK" | grep -o '"next_open":"[^"]*"' | cut -d'"' -f4)
    NEXT_CLOSE=$(echo "$MARKET_CLOCK" | grep -o '"next_close":"[^"]*"' | cut -d'"' -f4)
else
    IS_OPEN="unknown"
    NEXT_OPEN="unknown"
    NEXT_CLOSE="unknown"
fi

# Get circuit breaker status
CB_STATUS=$(curl -s http://localhost:5000/api/alpaca/circuit-breaker/status 2>/dev/null || echo '{"isOpen": false}')
CB_OPEN=$(echo "$CB_STATUS" | grep -o '"isOpen":[^,}]*' | cut -d':' -f2 | tr -d ' ')

# Format context
if [ "$IS_OPEN" = "true" ]; then
    MARKET_STATUS="OPEN"
else
    MARKET_STATUS="CLOSED"
fi

if [ "$CB_OPEN" = "true" ]; then
    CB_STATUS_TEXT="OPEN (trading blocked)"
else
    CB_STATUS_TEXT="NORMAL"
fi

# Output context (will be shown to Claude)
cat << EOF
---
Market Context (auto-injected):
- Market: $MARKET_STATUS
- Circuit Breaker: $CB_STATUS_TEXT
- Next Open: $NEXT_OPEN
- Next Close: $NEXT_CLOSE
---
EOF
