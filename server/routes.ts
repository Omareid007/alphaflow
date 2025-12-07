import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import {
  insertStrategySchema,
  insertTradeSchema,
  insertPositionSchema,
  insertAiDecisionSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/agent/status", async (req, res) => {
    try {
      const status = await storage.getAgentStatus();
      if (!status) {
        const defaultStatus = await storage.updateAgentStatus({
          isRunning: false,
          totalTrades: 0,
          totalPnl: "0",
        });
        return res.json(defaultStatus);
      }
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get agent status" });
    }
  });

  app.post("/api/agent/toggle", async (req, res) => {
    try {
      const currentStatus = await storage.getAgentStatus();
      const newIsRunning = !(currentStatus?.isRunning ?? false);
      const status = await storage.updateAgentStatus({
        isRunning: newIsRunning,
        lastHeartbeat: new Date(),
      });
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle agent" });
    }
  });

  app.get("/api/strategies", async (req, res) => {
    try {
      const strategies = await storage.getStrategies();
      res.json(strategies);
    } catch (error) {
      res.status(500).json({ error: "Failed to get strategies" });
    }
  });

  app.get("/api/strategies/:id", async (req, res) => {
    try {
      const strategy = await storage.getStrategy(req.params.id);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      res.json(strategy);
    } catch (error) {
      res.status(500).json({ error: "Failed to get strategy" });
    }
  });

  app.post("/api/strategies", async (req, res) => {
    try {
      const parsed = insertStrategySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const strategy = await storage.createStrategy(parsed.data);
      res.status(201).json(strategy);
    } catch (error) {
      res.status(500).json({ error: "Failed to create strategy" });
    }
  });

  app.patch("/api/strategies/:id", async (req, res) => {
    try {
      const strategy = await storage.updateStrategy(req.params.id, req.body);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      res.json(strategy);
    } catch (error) {
      res.status(500).json({ error: "Failed to update strategy" });
    }
  });

  app.post("/api/strategies/:id/toggle", async (req, res) => {
    try {
      const currentStrategy = await storage.getStrategy(req.params.id);
      if (!currentStrategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      const strategy = await storage.toggleStrategy(req.params.id, !currentStrategy.isActive);
      res.json(strategy);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle strategy" });
    }
  });

  app.get("/api/trades", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = await storage.getTrades(limit);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: "Failed to get trades" });
    }
  });

  app.get("/api/trades/:id", async (req, res) => {
    try {
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      res.json(trade);
    } catch (error) {
      res.status(500).json({ error: "Failed to get trade" });
    }
  });

  app.post("/api/trades", async (req, res) => {
    try {
      const parsed = insertTradeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const trade = await storage.createTrade(parsed.data);
      res.status(201).json(trade);
    } catch (error) {
      res.status(500).json({ error: "Failed to create trade" });
    }
  });

  app.get("/api/positions", async (req, res) => {
    try {
      const positions = await storage.getPositions();
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get positions" });
    }
  });

  app.get("/api/positions/:id", async (req, res) => {
    try {
      const position = await storage.getPosition(req.params.id);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: "Failed to get position" });
    }
  });

  app.post("/api/positions", async (req, res) => {
    try {
      const parsed = insertPositionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const position = await storage.createPosition(parsed.data);
      res.status(201).json(position);
    } catch (error) {
      res.status(500).json({ error: "Failed to create position" });
    }
  });

  app.patch("/api/positions/:id", async (req, res) => {
    try {
      const position = await storage.updatePosition(req.params.id, req.body);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: "Failed to update position" });
    }
  });

  app.delete("/api/positions/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePosition(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Position not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete position" });
    }
  });

  app.get("/api/ai-decisions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const decisions = await storage.getAiDecisions(limit);
      res.json(decisions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get AI decisions" });
    }
  });

  app.post("/api/ai-decisions", async (req, res) => {
    try {
      const parsed = insertAiDecisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const decision = await storage.createAiDecision(parsed.data);
      res.status(201).json(decision);
    } catch (error) {
      res.status(500).json({ error: "Failed to create AI decision" });
    }
  });

  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const trades = await storage.getTrades(1000);
      const positions = await storage.getPositions();
      const status = await storage.getAgentStatus();

      const winningTrades = trades.filter(t => parseFloat(t.pnl || "0") > 0);
      const totalPnl = trades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0);
      const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
      const unrealizedPnl = positions.reduce((sum, p) => sum + parseFloat(p.unrealizedPnl || "0"), 0);

      res.json({
        totalTrades: trades.length,
        totalPnl: totalPnl.toFixed(2),
        winRate: winRate.toFixed(1),
        winningTrades: winningTrades.length,
        losingTrades: trades.length - winningTrades.length,
        openPositions: positions.length,
        unrealizedPnl: unrealizedPnl.toFixed(2),
        isAgentRunning: status?.isRunning ?? false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get analytics summary" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
