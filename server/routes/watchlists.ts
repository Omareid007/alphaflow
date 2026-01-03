/**
 * @module server/routes/watchlists
 * @description Watchlist management API routes
 *
 * Provides CRUD operations for user watchlists and their symbols.
 * All routes require authentication.
 */

import { Router, Request, Response } from "express";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../db";
import {
  watchlists,
  watchlistSymbols,
  createWatchlistSchema,
  updateWatchlistSchema,
  addWatchlistSymbolSchema,
  updateWatchlistSymbolSchema,
  Watchlist,
  WatchlistSymbol,
  WatchlistWithSymbols,
} from "@shared/schema";
import { getSession } from "../lib/session";
import { log } from "../utils/logger";

const router = Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Authentication middleware
 * Validates session and attaches userId to request
 */
async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: () => void
): Promise<void> {
  const sessionId = req.cookies?.session;
  if (!sessionId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const session = await getSession(sessionId);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = session.userId;
  next();
}

// Apply auth middleware to all routes
router.use(requireAuth as unknown as Router);

// ============================================================================
// WATCHLIST ROUTES
// ============================================================================

/**
 * GET /api/watchlists
 * Get all watchlists for the current user
 */
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const userWatchlists = await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(asc(watchlists.sortOrder), asc(watchlists.createdAt));

    // Get symbols for each watchlist
    const watchlistsWithSymbols: WatchlistWithSymbols[] = await Promise.all(
      userWatchlists.map(async (watchlist) => {
        const symbols = await db
          .select()
          .from(watchlistSymbols)
          .where(eq(watchlistSymbols.watchlistId, watchlist.id))
          .orderBy(
            asc(watchlistSymbols.sortOrder),
            desc(watchlistSymbols.addedAt)
          );

        return {
          ...watchlist,
          symbols,
        };
      })
    );

    res.json(watchlistsWithSymbols);
  } catch (error) {
    log.error("Watchlists", "Failed to get watchlists", { error });
    res.status(500).json({ error: "Failed to get watchlists" });
  }
});

/**
 * POST /api/watchlists
 * Create a new watchlist
 */
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const validationResult = createWatchlistSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        error: "Invalid input",
        details: validationResult.error.errors,
      });
      return;
    }

    const { name, description, isDefault } = validationResult.data;

    // If setting as default, unset any existing default
    if (isDefault) {
      await db
        .update(watchlists)
        .set({ isDefault: false })
        .where(
          and(eq(watchlists.userId, userId), eq(watchlists.isDefault, true))
        );
    }

    const [newWatchlist] = await db
      .insert(watchlists)
      .values({
        userId,
        name,
        description,
        isDefault: isDefault || false,
      })
      .returning();

    log.info("Watchlists", "Created watchlist", {
      userId,
      watchlistId: newWatchlist.id,
      name,
    });

    res.status(201).json({
      ...newWatchlist,
      symbols: [],
    });
  } catch (error) {
    log.error("Watchlists", "Failed to create watchlist", { error });
    res.status(500).json({ error: "Failed to create watchlist" });
  }
});

/**
 * GET /api/watchlists/:id
 * Get a specific watchlist with its symbols
 */
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const [watchlist] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));

    if (!watchlist) {
      res.status(404).json({ error: "Watchlist not found" });
      return;
    }

    const symbols = await db
      .select()
      .from(watchlistSymbols)
      .where(eq(watchlistSymbols.watchlistId, id))
      .orderBy(asc(watchlistSymbols.sortOrder), desc(watchlistSymbols.addedAt));

    res.json({
      ...watchlist,
      symbols,
    });
  } catch (error) {
    log.error("Watchlists", "Failed to get watchlist", { error });
    res.status(500).json({ error: "Failed to get watchlist" });
  }
});

/**
 * PUT /api/watchlists/:id
 * Update a watchlist
 */
router.put("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const validationResult = updateWatchlistSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        error: "Invalid input",
        details: validationResult.error.errors,
      });
      return;
    }

    const updates = validationResult.data;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Watchlist not found" });
      return;
    }

    // If setting as default, unset any existing default
    if (updates.isDefault) {
      await db
        .update(watchlists)
        .set({ isDefault: false })
        .where(
          and(eq(watchlists.userId, userId), eq(watchlists.isDefault, true))
        );
    }

    const [updated] = await db
      .update(watchlists)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .returning();

    log.info("Watchlists", "Updated watchlist", { userId, watchlistId: id });

    res.json(updated);
  } catch (error) {
    log.error("Watchlists", "Failed to update watchlist", { error });
    res.status(500).json({ error: "Failed to update watchlist" });
  }
});

/**
 * DELETE /api/watchlists/:id
 * Delete a watchlist and all its symbols
 */
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Watchlist not found" });
      return;
    }

    // Cascade delete handled by foreign key constraint
    await db
      .delete(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));

    log.info("Watchlists", "Deleted watchlist", { userId, watchlistId: id });

    res.json({ success: true });
  } catch (error) {
    log.error("Watchlists", "Failed to delete watchlist", { error });
    res.status(500).json({ error: "Failed to delete watchlist" });
  }
});

// ============================================================================
// WATCHLIST SYMBOL ROUTES
// ============================================================================

/**
 * POST /api/watchlists/:id/symbols
 * Add a symbol to a watchlist
 */
router.post(
  "/:id/symbols",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id: watchlistId } = req.params;
      const validationResult = addWatchlistSymbolSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          error: "Invalid input",
          details: validationResult.error.errors,
        });
        return;
      }

      const { symbol, notes, tags } = validationResult.data;

      // Verify watchlist ownership
      const [watchlist] = await db
        .select()
        .from(watchlists)
        .where(
          and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId))
        );

      if (!watchlist) {
        res.status(404).json({ error: "Watchlist not found" });
        return;
      }

      // Check if symbol already exists in watchlist
      const [existingSymbol] = await db
        .select()
        .from(watchlistSymbols)
        .where(
          and(
            eq(watchlistSymbols.watchlistId, watchlistId),
            eq(watchlistSymbols.symbol, symbol.toUpperCase())
          )
        );

      if (existingSymbol) {
        res.status(409).json({ error: "Symbol already in watchlist" });
        return;
      }

      const [newSymbol] = await db
        .insert(watchlistSymbols)
        .values({
          watchlistId,
          symbol: symbol.toUpperCase(),
          notes,
          tags,
        })
        .returning();

      log.info("Watchlists", "Added symbol to watchlist", {
        userId,
        watchlistId,
        symbol: symbol.toUpperCase(),
      });

      res.status(201).json({
        success: true,
        item: newSymbol,
      });
    } catch (error) {
      log.error("Watchlists", "Failed to add symbol", { error });
      res.status(500).json({ error: "Failed to add symbol" });
    }
  }
);

/**
 * PUT /api/watchlists/:id/symbols/:symbol
 * Update a symbol in a watchlist
 */
router.put(
  "/:id/symbols/:symbol",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id: watchlistId, symbol } = req.params;
      const validationResult = updateWatchlistSymbolSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          error: "Invalid input",
          details: validationResult.error.errors,
        });
        return;
      }

      const updates = validationResult.data;

      // Verify watchlist ownership
      const [watchlist] = await db
        .select()
        .from(watchlists)
        .where(
          and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId))
        );

      if (!watchlist) {
        res.status(404).json({ error: "Watchlist not found" });
        return;
      }

      const [updated] = await db
        .update(watchlistSymbols)
        .set(updates)
        .where(
          and(
            eq(watchlistSymbols.watchlistId, watchlistId),
            eq(watchlistSymbols.symbol, symbol.toUpperCase())
          )
        )
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Symbol not found in watchlist" });
        return;
      }

      log.info("Watchlists", "Updated symbol in watchlist", {
        userId,
        watchlistId,
        symbol: symbol.toUpperCase(),
      });

      res.json(updated);
    } catch (error) {
      log.error("Watchlists", "Failed to update symbol", { error });
      res.status(500).json({ error: "Failed to update symbol" });
    }
  }
);

/**
 * DELETE /api/watchlists/:id/symbols/:symbol
 * Remove a symbol from a watchlist
 */
router.delete(
  "/:id/symbols/:symbol",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id: watchlistId, symbol } = req.params;

      // Verify watchlist ownership
      const [watchlist] = await db
        .select()
        .from(watchlists)
        .where(
          and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId))
        );

      if (!watchlist) {
        res.status(404).json({ error: "Watchlist not found" });
        return;
      }

      const result = await db
        .delete(watchlistSymbols)
        .where(
          and(
            eq(watchlistSymbols.watchlistId, watchlistId),
            eq(watchlistSymbols.symbol, symbol.toUpperCase())
          )
        )
        .returning();

      if (result.length === 0) {
        res.status(404).json({ error: "Symbol not found in watchlist" });
        return;
      }

      log.info("Watchlists", "Removed symbol from watchlist", {
        userId,
        watchlistId,
        symbol: symbol.toUpperCase(),
      });

      res.json({ success: true });
    } catch (error) {
      log.error("Watchlists", "Failed to remove symbol", { error });
      res.status(500).json({ error: "Failed to remove symbol" });
    }
  }
);

export default router;
