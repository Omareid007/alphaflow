/**
 * Database Schema - Main Entry Point
 *
 * This file has been refactored from a monolithic 1,864-line file into 14 domain-focused modules.
 * All schema definitions are re-exported from /shared/schema/ for backward compatibility.
 *
 * Migration: The schema structure is unchanged - only the code organization has improved.
 *
 * @see /shared/schema/index.ts for module organization
 */

export * from "./schema/index";
