#!/bin/bash
# validate-trading-command.sh
# PreToolUse hook script for validating trading commands before execution
# Returns JSON with decision: "approve" or "deny"

set -e

# Input: Command being executed (from CLAUDE_TOOL_INPUT environment variable)
COMMAND="${1:-$CLAUDE_TOOL_INPUT}"

# Trading-related keywords that trigger validation
TRADING_KEYWORDS="order|trade|position|buy|sell|submit_order|place_order|alpaca"

# Check if this is a trading-related command
if echo "$COMMAND" | grep -qiE "$TRADING_KEYWORDS"; then
    # This is a trading command - perform validation

    # 1. Check market hours (via Alpaca API)
    if [ -n "$ALPACA_API_KEY" ] && [ -n "$ALPACA_SECRET_KEY" ]; then
        MARKET_CLOCK=$(curl -s \
            -H "APCA-API-KEY-ID: $ALPACA_API_KEY" \
            -H "APCA-API-SECRET-KEY: $ALPACA_SECRET_KEY" \
            "https://paper-api.alpaca.markets/v2/clock" 2>/dev/null || echo '{"is_open": true}')

        IS_OPEN=$(echo "$MARKET_CLOCK" | grep -o '"is_open":[^,}]*' | cut -d':' -f2 | tr -d ' ')

        # For buy/long orders, market must be open (unless extended hours)
        if echo "$COMMAND" | grep -qiE "buy|long" && [ "$IS_OPEN" != "true" ]; then
            if ! echo "$COMMAND" | grep -qiE "extended_hours"; then
                echo '{"decision": "deny", "reason": "Market is closed. Use extended_hours flag or wait for market open."}'
                exit 0
            fi
        fi
    fi

    # 2. Check circuit breaker state (if endpoint available)
    CB_STATUS=$(curl -s http://localhost:5000/api/alpaca/circuit-breaker/status 2>/dev/null || echo '{"isOpen": false}')
    CB_OPEN=$(echo "$CB_STATUS" | grep -o '"isOpen":[^,}]*' | cut -d':' -f2 | tr -d ' ')

    if [ "$CB_OPEN" = "true" ]; then
        echo '{"decision": "deny", "reason": "Circuit breaker is OPEN. Trading is temporarily disabled."}'
        exit 0
    fi

    # 3. Check for dangerous patterns
    # Block rm -rf, DROP TABLE, etc. in trading context
    if echo "$COMMAND" | grep -qiE "rm -rf|DROP TABLE|DELETE FROM|TRUNCATE"; then
        echo '{"decision": "deny", "reason": "Dangerous command detected in trading context."}'
        exit 0
    fi

    # All checks passed
    echo '{"decision": "approve", "reason": "Trading command validated successfully."}'
else
    # Not a trading command - approve by default
    echo '{"decision": "approve", "reason": "Non-trading command."}'
fi
