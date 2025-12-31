import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { log } from "../utils/logger";
import { getAlpacaBaseUrl, tradingConfig } from "../config/trading-config";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// In-memory storage for providers (in production, this would be in database)
let providers: any[] = [
  {
    id: "alpaca-trading",
    type: "broker",
    name: `Alpaca ${tradingConfig.alpaca.tradingMode === "live" ? "Live" : "Paper"} Trading`,
    baseUrl: getAlpacaBaseUrl(),
    status: "active",
    tags: ["trading", tradingConfig.alpaca.tradingMode],
    metadata: { mode: tradingConfig.alpaca.tradingMode },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "openrouter",
    type: "llm",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    status: "active",
    tags: ["llm", "ai"],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "finnhub",
    type: "data",
    name: "Finnhub",
    baseUrl: "https://finnhub.io/api/v1",
    status: "active",
    tags: ["market-data", "news"],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let credentials: Map<string, any[]> = new Map();
let budgets: Map<string, any> = new Map();
let apiFunctions: Map<string, any[]> = new Map();

// GET /api/admin/providers - List all providers
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(providers);
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to get providers", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to get providers" });
  }
});

// POST /api/admin/providers - Create new provider
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const provider = {
      id: randomUUID(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    providers.push(provider);
    res.status(201).json(provider);
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to create provider", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to create provider" });
  }
});

// GET /api/admin/providers/:id - Get single provider
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const provider = providers.find((p) => p.id === req.params.id);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }
    res.json(provider);
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to get provider", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to get provider" });
  }
});

// PATCH /api/admin/providers/:id - Update provider
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const index = providers.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Provider not found" });
    }
    providers[index] = {
      ...providers[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    res.json(providers[index]);
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to update provider", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to update provider" });
  }
});

// DELETE /api/admin/providers/:id - Delete provider
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const index = providers.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Provider not found" });
    }
    providers.splice(index, 1);
    credentials.delete(req.params.id);
    budgets.delete(req.params.id);
    apiFunctions.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to delete provider", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to delete provider" });
  }
});

// POST /api/admin/providers/:id/test - Test provider connection
router.post("/:id/test", requireAuth, async (req: Request, res: Response) => {
  try {
    const provider = providers.find((p) => p.id === req.params.id);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const startTime = Date.now();
    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 100));
    const latency = Date.now() - startTime;

    res.json({
      success: true,
      latency,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to test provider", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: "Connection test failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/admin/providers/:id/credentials - Get provider credentials
router.get("/:id/credentials", requireAuth, async (req: Request, res: Response) => {
  try {
    const creds = credentials.get(req.params.id) || [];
    // Mask credential values for security
    const maskedCreds = creds.map((c) => ({
      ...c,
      encryptedValue: "********",
    }));
    res.json(maskedCreds);
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to get credentials", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to get credentials" });
  }
});

// POST /api/admin/providers/:id/credentials - Add credential
router.post("/:id/credentials", requireAuth, async (req: Request, res: Response) => {
  try {
    const credential = {
      id: randomUUID(),
      providerId: req.params.id,
      kind: req.body.kind,
      encryptedValue: req.body.value, // In production, encrypt this
      lastRotatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const existing = credentials.get(req.params.id) || [];
    existing.push(credential);
    credentials.set(req.params.id, existing);

    res.status(201).json({
      ...credential,
      encryptedValue: "********",
    });
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to add credential", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to add credential" });
  }
});

// GET /api/admin/providers/:id/budget - Get provider budget
router.get("/:id/budget", requireAuth, async (req: Request, res: Response) => {
  try {
    let budget = budgets.get(req.params.id);
    if (!budget) {
      budget = {
        id: randomUUID(),
        providerId: req.params.id,
        dailyLimit: 100,
        monthlyLimit: 1000,
        softLimit: 80,
        hardLimit: 100,
        usageToday: 0,
        usageMonth: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      budgets.set(req.params.id, budget);
    }
    res.json(budget);
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to get budget", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to get budget" });
  }
});

// PUT /api/admin/providers/:id/budget - Update provider budget
router.put("/:id/budget", requireAuth, async (req: Request, res: Response) => {
  try {
    const existing = budgets.get(req.params.id) || {
      id: randomUUID(),
      providerId: req.params.id,
      usageToday: 0,
      usageMonth: 0,
      createdAt: new Date().toISOString(),
    };

    const budget = {
      ...existing,
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    budgets.set(req.params.id, budget);
    res.json(budget);
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to update budget", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to update budget" });
  }
});

// GET /api/admin/providers/:id/usage - Get usage metrics
router.get("/:id/usage", requireAuth, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    // Generate mock usage data
    const metrics = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      metrics.push({
        date: date.toISOString().split("T")[0],
        amount: Math.floor(Math.random() * 10),
        requests: Math.floor(Math.random() * 100),
      });
    }
    res.json(metrics);
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to get usage metrics", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to get usage metrics" });
  }
});

// GET /api/admin/providers/:id/functions - Get API functions
router.get("/:id/functions", requireAuth, async (req: Request, res: Response) => {
  try {
    const funcs = apiFunctions.get(req.params.id) || [];
    res.json(funcs);
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to get API functions", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to get API functions" });
  }
});

// POST /api/admin/providers/:id/discover - Discover API endpoints
router.post("/:id/discover", requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentUrl } = req.body;
    // Mock discovery - in production, parse OpenAPI spec
    const discovered = [
      {
        id: randomUUID(),
        providerId: req.params.id,
        name: "getAccount",
        method: "GET",
        path: "/account",
        summary: "Get account information",
        tags: ["account"],
        parameters: [],
        responses: {},
        security: [],
        authRequired: true,
        costPerCall: 0.001,
        isEnabled: true,
        isDeprecated: false,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const existing = apiFunctions.get(req.params.id) || [];
    existing.push(...discovered);
    apiFunctions.set(req.params.id, existing);

    res.json({
      success: true,
      functionsDiscovered: discovered.length,
      schemasDiscovered: 0,
      functions: discovered,
      schemas: [],
    });
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to discover APIs", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: "API discovery failed",
    });
  }
});

// PATCH /api/admin/providers/:id/functions/:funcId - Update API function
router.patch("/:id/functions/:funcId", requireAuth, async (req: Request, res: Response) => {
  try {
    const funcs = apiFunctions.get(req.params.id) || [];
    const index = funcs.findIndex((f) => f.id === req.params.funcId);
    if (index === -1) {
      return res.status(404).json({ error: "Function not found" });
    }
    funcs[index] = {
      ...funcs[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    apiFunctions.set(req.params.id, funcs);
    res.json(funcs[index]);
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to update function", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to update function" });
  }
});

// POST /api/admin/providers/:id/functions/:funcId/test - Test API function
router.post(
  "/:id/functions/:funcId/test",
  async (req: Request, res: Response) => {
    try {
      const funcs = apiFunctions.get(req.params.id) || [];
      const func = funcs.find((f) => f.id === req.params.funcId);
      if (!func) {
        return res.status(404).json({ error: "Function not found" });
      }

      const startTime = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const latencyMs = Date.now() - startTime;

      // Update last tested
      func.lastTestedAt = new Date().toISOString();
      func.lastTestSuccess = true;
      func.lastTestLatencyMs = latencyMs;

      res.json({
        success: true,
        latencyMs,
      });
    } catch (error) {
      log.error("ProvidersRoutes", "Failed to test function", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: "Function test failed",
      });
    }
  }
);

// DELETE /api/admin/providers/:id/functions/:funcId - Delete API function
router.delete("/:id/functions/:funcId", requireAuth, async (req: Request, res: Response) => {
  try {
    const funcs = apiFunctions.get(req.params.id) || [];
    const index = funcs.findIndex((f) => f.id === req.params.funcId);
    if (index === -1) {
      return res.status(404).json({ error: "Function not found" });
    }
    funcs.splice(index, 1);
    apiFunctions.set(req.params.id, funcs);
    res.status(204).send();
  } catch (error) {
    log.error("ProvidersRoutes", "Failed to delete function", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to delete function" });
  }
});

export default router;
