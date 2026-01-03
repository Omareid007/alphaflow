/**
 * Modular Schema - Main Index
 *
 * This file re-exports all schema definitions from domain modules.
 * The schema has been split from a monolithic 1864-line file into 14 focused modules.
 *
 * Import any schema from this index: import { User, Trade, Order } from '@shared/schema'
 */

// Core domains
export * from "./auth";
export * from "./trading";
export * from "./orders";

// AI & Decision Making
export * from "./ai-decisions";
export * from "./orchestration";
export * from "./debate-arena";

// Market & Analysis
export * from "./market-data";
export * from "./analysis";
export * from "./universe";
export * from "./allocation";

// Testing & Evaluation
export * from "./backtest";
export * from "./competition";
export * from "./strategy-versioning";

// Monitoring & Infrastructure
export * from "./monitoring";

// User Features
export * from "./watchlist";
export * from "./user-preferences";
export * from "./notification-preferences";
