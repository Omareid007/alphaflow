/**
 * Admin Routes - Main Router
 * Aggregates all admin sub-routers for modular organization
 */

import { Router } from "express";
import apiRouter from "./api";
import aiRouter from "./ai";
import systemRouter from "./system";
import tradingRouter from "./trading";
import managementRouter from "./management";
import { requireAuth, requireAdmin } from "../../middleware/requireAuth";

const router = Router();

// Mount sub-routers
router.use("/", apiRouter); // API usage, cache, providers, connectors
router.use("/", aiRouter); // AI config, model router, work items
router.use("/", systemRouter); // Modules, RBAC, settings, orchestrator, jobs
router.use("/", tradingRouter); // Universe, liquidity, fundamentals, candidates, allocation
router.use("/", managementRouter); // Audit, dashboard, users, observability

export default router;
