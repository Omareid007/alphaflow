import { Router, Request, Response } from "express";
import { log } from "../utils/logger";
import { badRequest, notFound, serverError, validationError } from "../lib/standard-errors";
import {
  getCacheStats,
  getAllCacheEntries,
  purgeExpiredCache,
  invalidateCache,
} from "../lib/persistentApiCache";
import {
  getLLMCacheStats,
  clearLLMCache,
  clearLLMCacheForRole,
  resetLLMCacheStats,
} from "../ai/llmGateway";

const router = Router();

/**
 * LLM Response Cache Management Endpoints
 */

// GET /api/cache/llm/stats - Get LLM cache statistics
router.get("/llm/stats", async (req: Request, res: Response) => {
  try {
    const stats = getLLMCacheStats();
    res.json(stats);
  } catch (error) {
    log.error("CacheAPI", `Failed to get LLM cache stats: ${error}`);
    res.status(500).json({ error: "Failed to get cache stats" });
  }
});

// POST /api/cache/llm/clear - Clear entire LLM cache
router.post("/llm/clear", async (req: Request, res: Response) => {
  try {
    clearLLMCache();
    res.json({ success: true, message: "LLM cache cleared" });
  } catch (error) {
    log.error("CacheAPI", `Failed to clear LLM cache: ${error}`);
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

// POST /api/cache/llm/clear/:role - Clear LLM cache for specific role
router.post("/llm/clear/:role", async (req: Request, res: Response) => {
  try {
    const { role } = req.params;

    if (!role) {
      return badRequest(res, "Role parameter is required");
    }

    clearLLMCacheForRole(role as any);
    res.json({ success: true, message: `Cache cleared for role: ${role}` });
  } catch (error) {
    log.error("CacheAPI", `Failed to clear LLM cache for role: ${error}`);
    res.status(500).json({ error: "Failed to clear cache for role" });
  }
});

// POST /api/cache/llm/reset-stats - Reset LLM cache statistics
router.post("/llm/reset-stats", async (req: Request, res: Response) => {
  try {
    resetLLMCacheStats();
    res.json({ success: true, message: "Cache statistics reset" });
  } catch (error) {
    log.error("CacheAPI", `Failed to reset LLM cache stats: ${error}`);
    res.status(500).json({ error: "Failed to reset cache stats" });
  }
});

/**
 * API Cache Management Endpoints
 */

// GET /api/cache/api - Get API cache statistics and entries
router.get("/api", async (req: Request, res: Response) => {
  try {
    const { provider } = req.query;
    const providerFilter = typeof provider === "string" ? provider : undefined;

    const stats = await getCacheStats(providerFilter);
    const entries = await getAllCacheEntries(providerFilter);

    res.json({ stats, entries });
  } catch (error) {
    log.error("CacheAPI", `Failed to get API cache stats: ${error}`);
    res.status(500).json({ error: "Failed to get API cache stats" });
  }
});

// POST /api/cache/api/purge - Purge API cache entries
router.post("/api/purge", async (req: Request, res: Response) => {
  try {
    const { provider, key, expiredOnly } = req.body;

    if (!provider && !expiredOnly) {
      return badRequest(
        res,
        "Either 'provider' or 'expiredOnly' must be specified"
      );
    }

    let purgedCount = 0;
    let message = "";

    if (provider && key) {
      // Invalidate specific cache entry
      purgedCount = await invalidateCache(provider, key);
      message = `Invalidated cache for ${provider}:${key}`;
    } else if (provider && !expiredOnly) {
      // Invalidate all entries for a provider
      purgedCount = await invalidateCache(provider);
      message = `Invalidated all cache entries for ${provider}`;
    } else {
      // Purge expired entries
      purgedCount = await purgeExpiredCache();
      message = provider
        ? `Purged expired cache entries (provider filter not supported for expired purge)`
        : "Purged all expired cache entries";
    }

    res.json({ success: true, purgedCount, message });
  } catch (error) {
    log.error("CacheAPI", `Failed to purge API cache: ${error}`);
    res.status(500).json({ error: "Failed to purge API cache" });
  }
});

export default router;
