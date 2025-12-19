#!/bin/bash
# Claude Code Trading Monitor
# Run periodically to monitor and manage the trading orchestrator
# Usage: Run via cron every 5 minutes during market hours

WORKSPACE="/home/runner/workspace"
LOG_DIR="$WORKSPACE/logs/claude-monitor"
LOG_FILE="$LOG_DIR/$(date +%Y%m%d).log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check if market is open (9:30 AM - 4:00 PM ET, Mon-Fri)
is_market_open() {
    local HOUR=$(TZ=America/New_York date +%H)
    local MINUTE=$(TZ=America/New_York date +%M)
    local DOW=$(date +%u)

    # Weekend check (Sat=6, Sun=7)
    if [ "$DOW" -ge 6 ]; then
        return 1
    fi

    # Time check (9:30 AM to 4:00 PM ET)
    if [ "$HOUR" -lt 9 ] || [ "$HOUR" -ge 16 ]; then
        return 1
    fi

    if [ "$HOUR" -eq 9 ] && [ "$MINUTE" -lt 30 ]; then
        return 1
    fi

    return 0
}

# Check orchestrator status
check_orchestrator() {
    log "Checking orchestrator status..."

    # Call the API to check status
    STATUS=$(curl -s http://localhost:5000/api/agent/status 2>/dev/null)

    if [ -z "$STATUS" ]; then
        log "WARNING: Could not reach API server"
        return 1
    fi

    # Parse isRunning from JSON
    IS_RUNNING=$(echo "$STATUS" | grep -o '"isRunning":[^,}]*' | cut -d':' -f2)
    KILL_SWITCH=$(echo "$STATUS" | grep -o '"killSwitchActive":[^,}]*' | cut -d':' -f2)

    log "Orchestrator running: $IS_RUNNING, Kill switch: $KILL_SWITCH"

    if [ "$KILL_SWITCH" = "true" ]; then
        log "ALERT: Kill switch is active!"
        return 2
    fi

    if [ "$IS_RUNNING" != "true" ]; then
        log "WARNING: Orchestrator is not running"
        return 3
    fi

    return 0
}

# Check for stuck orders
check_stuck_orders() {
    log "Checking for stuck orders..."

    ORDERS=$(curl -s http://localhost:5000/api/autonomous/open-orders 2>/dev/null)
    ORDER_COUNT=$(echo "$ORDERS" | grep -o '"id"' | wc -l)

    log "Open orders count: $ORDER_COUNT"

    if [ "$ORDER_COUNT" -gt 10 ]; then
        log "WARNING: High number of open orders ($ORDER_COUNT)"
    fi
}

# Check positions
check_positions() {
    log "Checking positions..."

    POSITIONS=$(curl -s http://localhost:5000/api/alpaca/positions 2>/dev/null)
    POS_COUNT=$(echo "$POSITIONS" | grep -o '"symbol"' | wc -l)

    log "Open positions: $POS_COUNT"
}

# Main execution
main() {
    log "=== Claude Trading Monitor Started ==="

    if ! is_market_open; then
        log "Market is closed. Skipping checks."
        log "=== Monitor Complete ==="
        exit 0
    fi

    log "Market is open. Running checks..."

    check_orchestrator
    ORCH_STATUS=$?

    check_stuck_orders
    check_positions

    # If orchestrator is down during market hours, log alert
    if [ $ORCH_STATUS -ne 0 ]; then
        log "ALERT: Issues detected with orchestrator (status code: $ORCH_STATUS)"
    fi

    log "=== Monitor Complete ==="
}

# Run main function
main
