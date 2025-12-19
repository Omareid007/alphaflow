#!/bin/bash
#
# Database Backup Script for AI Trading System
#
# Features:
# - Daily automated backups with pg_dump
# - 7-day retention policy (auto-cleanup old backups)
# - Compressed backups (.sql.gz)
# - Supports DATABASE_URL or individual connection params
#
# Usage:
#   ./scripts/backup-database.sh                    # Manual backup
#   ./scripts/backup-database.sh --restore <file>   # Restore from backup
#   ./scripts/backup-database.sh --list             # List backups
#   ./scripts/backup-database.sh --cleanup          # Manual cleanup
#
# To schedule daily backups, add to crontab:
#   0 2 * * * /path/to/scripts/backup-database.sh >> /var/log/db-backup.log 2>&1
#

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/home/runner/workspace/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="aitrader_backup_${TIMESTAMP}.sql.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# Parse DATABASE_URL if available
parse_database_url() {
    if [ -n "$DATABASE_URL" ]; then
        # Parse postgresql://user:password@host:port/database
        DB_USER=$(echo $DATABASE_URL | sed -e 's/.*\/\/\([^:]*\):.*/\1/')
        DB_PASS=$(echo $DATABASE_URL | sed -e 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')
        DB_HOST=$(echo $DATABASE_URL | sed -e 's/.*@\([^:]*\):.*/\1/')
        DB_PORT=$(echo $DATABASE_URL | sed -e 's/.*:\([0-9]*\)\/.*/\1/')
        DB_NAME=$(echo $DATABASE_URL | sed -e 's/.*\/\([^?]*\).*/\1/')
    else
        DB_HOST="${DB_HOST:-localhost}"
        DB_PORT="${DB_PORT:-5432}"
        DB_NAME="${DB_NAME:-aitrader}"
        DB_USER="${DB_USER:-aitrader}"
        DB_PASS="${DB_PASS:-}"
    fi
}

# Create backup directory if it doesn't exist
ensure_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi
}

# Perform database backup
do_backup() {
    log_info "Starting database backup..."
    log_info "Host: $DB_HOST:$DB_PORT, Database: $DB_NAME"

    ensure_backup_dir

    # Set password for pg_dump
    export PGPASSWORD="$DB_PASS"

    # Perform backup with compression
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$BACKUP_DIR/$BACKUP_FILE"; then
        log_info "Backup completed: $BACKUP_DIR/$BACKUP_FILE"

        # Show backup size
        BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        log_info "Backup size: $BACKUP_SIZE"

        # Cleanup old backups
        cleanup_old_backups
    else
        log_error "Backup failed!"
        exit 1
    fi
}

# Cleanup backups older than retention period
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."

    DELETED=$(find "$BACKUP_DIR" -name "aitrader_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)

    if [ "$DELETED" -gt 0 ]; then
        log_info "Deleted $DELETED old backup(s)"
    else
        log_info "No old backups to delete"
    fi
}

# List available backups
list_backups() {
    log_info "Available backups in $BACKUP_DIR:"
    echo ""

    if [ -d "$BACKUP_DIR" ]; then
        ls -lh "$BACKUP_DIR"/aitrader_backup_*.sql.gz 2>/dev/null || echo "No backups found"
    else
        echo "Backup directory does not exist"
    fi
}

# Restore from backup
do_restore() {
    RESTORE_FILE="$1"

    if [ ! -f "$RESTORE_FILE" ]; then
        log_error "Backup file not found: $RESTORE_FILE"
        exit 1
    fi

    log_warn "This will OVERWRITE the current database!"
    read -p "Are you sure you want to restore from $RESTORE_FILE? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi

    log_info "Restoring database from: $RESTORE_FILE"

    export PGPASSWORD="$DB_PASS"

    # Drop and recreate database connections, then restore
    if gunzip -c "$RESTORE_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; then
        log_info "Restore completed successfully!"
    else
        log_error "Restore failed!"
        exit 1
    fi
}

# Show usage
show_usage() {
    echo "Database Backup Script for AI Trading System"
    echo ""
    echo "Usage:"
    echo "  $0                    Perform backup"
    echo "  $0 --restore <file>   Restore from backup file"
    echo "  $0 --list             List available backups"
    echo "  $0 --cleanup          Manual cleanup of old backups"
    echo "  $0 --help             Show this help"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL          PostgreSQL connection URL"
    echo "  BACKUP_DIR            Backup directory (default: ./backups)"
    echo "  RETENTION_DAYS        Days to keep backups (default: 7)"
}

# Main
parse_database_url

case "${1:-}" in
    --restore)
        if [ -z "${2:-}" ]; then
            log_error "Please specify a backup file to restore"
            exit 1
        fi
        do_restore "$2"
        ;;
    --list)
        list_backups
        ;;
    --cleanup)
        ensure_backup_dir
        cleanup_old_backups
        ;;
    --help|-h)
        show_usage
        ;;
    *)
        do_backup
        ;;
esac
