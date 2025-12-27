/**
 * Admin API Management Routes
 * Handles API usage, cache, provider status, connectors health
 */

import { Router, Request, Response } from "express";
import { getAllUsageStats, getUsageStats } from "../../lib/apiBudget";
import { getCacheStats, getAllCacheEntries, purgeExpiredCache, invalidateCache } from "../../lib/persistentApiCache";
import { getAllProviderPolicies, getProviderPolicy, enableProvider, disableProvider } from "../../lib/apiPolicy";
import { dataFusionEngine } from "../../fusion/data-fusion-engine";
import { log } from "../../utils/logger";

const router = Router();

// GET /api/admin/api-usage - Get API usage stats
router.get("/api-usage", async (req: Request, res: Response) => {
  try {
    const { provider } = req.query;

    if (provider && typeof provider === "string") {
      const stats = await getUsageStats(provider);
      const policy = getProviderPolicy(provider);
      res.json({ provider, stats, policy });
    } else {
      const allStats = await getAllUsageStats();
      const policies = getAllProviderPolicies();
      res.json({ usage: allStats, policies });
    }
  } catch (error) {
    log.error("AdminAPI", "Failed to get API usage stats", { error });
    res.status(500).json({ error: "Failed to get API usage stats" });
  }
});

// GET /api/admin/api-cache - Get API cache stats
router.get("/api-cache", async (req: Request, res: Response) => {
  try {
    const { provider } = req.query;
    const providerFilter = typeof provider === "string" ? provider : undefined;

    const stats = await getCacheStats(providerFilter);
    const entries = await getAllCacheEntries(providerFilter);

    res.json({ stats, entries });
  } catch (error) {
    log.error("AdminAPI", "Failed to get API cache stats", { error });
    res.status(500).json({ error: "Failed to get API cache stats" });
  }
});

// POST /api/admin/api-cache/purge - Purge API cache (requires admin:danger)
router.post("/api-cache/purge", async (req: Request, res: Response) => {
  try {
    const { provider, key, expiredOnly } = req.body;

    let purgedCount = 0;
    let message = "";

    if (provider && key) {
      purgedCount = await invalidateCache(provider, key);
      message = `Invalidated cache for ${provider}:${key}`;
    } else if (provider && !expiredOnly) {
      purgedCount = await invalidateCache(provider);
      message = `Invalidated all cache entries for ${provider}`;
    } else {
      purgedCount = await purgeExpiredCache();
      message = provider
        ? `Purged expired cache entries (provider filter not supported for expired purge)`
        : "Purged all expired cache entries";
    }

    res.json({ success: true, purgedCount, message });
  } catch (error) {
    log.error("AdminAPI", "Failed to purge API cache", { error });
    res.status(500).json({ error: "Failed to purge API cache" });
  }
});

// GET /api/admin/provider-status - Get provider statuses
router.get("/provider-status", async (req: Request, res: Response) => {
  try {
    const { getAllProviderStatuses } = await import("../../lib/callExternal");
    const statuses = await getAllProviderStatuses();
    res.json({ providers: statuses });
  } catch (error) {
    log.error("AdminAPI", "Failed to get provider statuses", { error });
    res.status(500).json({ error: "Failed to get provider statuses" });
  }
});

// POST /api/admin/provider/:provider/force-refresh - Force refresh provider (requires admin:danger)
router.post("/provider/:provider/force-refresh", async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { cacheKey, confirmValyu } = req.body;

    if (provider.toLowerCase() === "valyu" && !confirmValyu) {
      return res.status(400).json({
        error: "Valyu force refresh requires explicit confirmation",
        message: "Set confirmValyu: true to force refresh Valyu data (1 call/week limit)"
      });
    }

    if (cacheKey) {
      await invalidateCache(provider, cacheKey);
      res.json({
        success: true,
        message: `Cache invalidated for ${provider}:${cacheKey}. Next request will fetch fresh data.`
      });
    } else {
      await invalidateCache(provider);
      res.json({
        success: true,
        message: `All cache entries invalidated for ${provider}. Next requests will fetch fresh data.`
      });
    }
  } catch (error) {
    log.error("AdminAPI", "Failed to force refresh provider", { error });
    res.status(500).json({ error: "Failed to force refresh provider" });
  }
});

// PATCH /api/admin/provider/:provider/toggle - Toggle provider (requires admin:write)
router.patch("/provider/:provider/toggle", async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { enabled } = req.body;

    if (enabled === true) {
      enableProvider(provider);
    } else if (enabled === false) {
      disableProvider(provider);
    } else {
      return res.status(400).json({ error: "enabled must be true or false" });
    }

    const policy = getProviderPolicy(provider);
    res.json({
      success: true,
      provider,
      enabled: policy.enabled,
      message: `Provider ${provider} is now ${policy.enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    log.error("AdminAPI", "Failed to toggle provider", { error });
    res.status(500).json({ error: "Failed to toggle provider" });
  }
});

// GET /api/admin/valyu-budget - Get Valyu budget status
router.get("/valyu-budget", async (req: Request, res: Response) => {
  try {
    const { getValyuBudgetStatus, getValyuBudgetConfig } = await import("../../lib/valyuBudget");
    const statuses = await getValyuBudgetStatus();
    const config = getValyuBudgetConfig();
    res.json({ statuses, config });
  } catch (error) {
    log.error("AdminAPI", "Failed to get Valyu budget status", { error });
    res.status(500).json({ error: "Failed to get Valyu budget status" });
  }
});

// PUT /api/admin/valyu-budget - Update Valyu budget
router.put("/valyu-budget", async (req: Request, res: Response) => {
  try {
    const { updateValyuBudgetConfig, getValyuBudgetConfig } = await import("../../lib/valyuBudget");
    const { webRetrievalsPerMonth, financeRetrievalsPerMonth, proprietaryRetrievalsPerMonth } = req.body;

    const updates: {
      webRetrievalsPerMonth?: number;
      financeRetrievalsPerMonth?: number;
      proprietaryRetrievalsPerMonth?: number;
    } = {};

    if (webRetrievalsPerMonth !== undefined) updates.webRetrievalsPerMonth = webRetrievalsPerMonth;
    if (financeRetrievalsPerMonth !== undefined) updates.financeRetrievalsPerMonth = financeRetrievalsPerMonth;
    if (proprietaryRetrievalsPerMonth !== undefined) updates.proprietaryRetrievalsPerMonth = proprietaryRetrievalsPerMonth;

    updateValyuBudgetConfig(updates);
    const config = getValyuBudgetConfig();

    res.json({ success: true, config, message: "Valyu budget limits updated" });
  } catch (error) {
    log.error("AdminAPI", "Failed to update Valyu budget", { error });
    res.status(500).json({ error: "Failed to update Valyu budget" });
  }
});

// GET /api/admin/connectors-health - Get connector health status
router.get("/connectors-health", async (req: Request, res: Response) => {
  try {
    const { getAllProviderStatuses } = await import("../../lib/callExternal");
    const providerStatuses = await getAllProviderStatuses();

    const connectors = [
      {
        name: "Alpaca Paper",
        provider: "alpaca",
        type: "brokerage",
        hasApiKey: !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY),
        status: "checking" as string,
        lastSync: null as string | null,
        callsRemaining: null as number | null,
        healthDetails: null as { overall: string; account?: unknown } | null,
      },
      {
        name: "Finnhub",
        provider: "finnhub",
        type: "market_data",
        hasApiKey: !!process.env.FINNHUB_API_KEY,
        status: providerStatuses.finnhub?.enabled ? "active" : "disabled",
        lastSync: null,
        callsRemaining: null,
        healthDetails: null,
      },
      {
        name: "CoinGecko",
        provider: "coingecko",
        type: "crypto",
        hasApiKey: true,
        status: providerStatuses.coingecko?.enabled ? "active" : "disabled",
        lastSync: null,
        callsRemaining: null,
        healthDetails: null,
      },
      {
        name: "CoinMarketCap",
        provider: "coinmarketcap",
        type: "crypto",
        hasApiKey: !!process.env.COINMARKETCAP_API_KEY,
        status: providerStatuses.coinmarketcap?.enabled ? "active" : "disabled",
        lastSync: null,
        callsRemaining: null,
        healthDetails: null,
      },
      {
        name: "NewsAPI",
        provider: "newsapi",
        type: "news",
        hasApiKey: !!process.env.NEWS_API_KEY,
        status: providerStatuses.newsapi?.enabled ? "active" : "disabled",
        lastSync: null,
        callsRemaining: null,
        healthDetails: null,
      },
      {
        name: "GDELT",
        provider: "gdelt",
        type: "news",
        hasApiKey: true,
        status: providerStatuses.gdelt?.enabled ? "active" : "disabled",
        lastSync: null,
        callsRemaining: null,
        healthDetails: null,
      },
      {
        name: "Valyu",
        provider: "valyu",
        type: "research",
        hasApiKey: !!process.env.VALYU_API_KEY,
        status: providerStatuses.valyu?.enabled ? "active" : "disabled",
        lastSync: null,
        callsRemaining: null,
        healthDetails: null,
      },
    ];

    // Check Alpaca health
    try {
      const { alpaca } = await import("../../connectors/alpaca");
      const account = await alpaca.getAccount();
      connectors[0].status = account.status === "ACTIVE" ? "active" : "error";
      connectors[0].healthDetails = { overall: account.status, account };
    } catch {
      connectors[0].status = "error";
    }

    res.json({
      connectors,
      summary: {
        total: connectors.length,
        active: connectors.filter(c => c.status === "active").length,
        error: connectors.filter(c => c.status === "error").length,
        disabled: connectors.filter(c => c.status === "disabled").length,
      }
    });
  } catch (error) {
    log.error("AdminAPI", "Failed to get connector health", { error });
    res.status(500).json({ error: "Failed to get connector health" });
  }
});

// GET /api/admin/api-keys-status - Get API keys status
router.get("/api-keys-status", async (req: Request, res: Response) => {
  try {
    const { getAllAvailableProviders } = await import("../../ai/index");
    const aiProviders = getAllAvailableProviders();
    const providerPolicies = getAllProviderPolicies();

    const getPolicyEnabled = (provider: string): boolean => {
      const policy = providerPolicies.find(p => p.provider.toLowerCase() === provider.toLowerCase());
      return policy?.enabled ?? true;
    };

    const apiKeys = [
      { name: "Alpaca API", key: "ALPACA_API_KEY", category: "brokerage", configured: !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY), enabled: getPolicyEnabled("alpaca") },
      { name: "Finnhub API", key: "FINNHUB_API_KEY", category: "market_data", configured: !!process.env.FINNHUB_API_KEY, enabled: getPolicyEnabled("finnhub") },
      { name: "CoinGecko API", key: "COINGECKO_API_KEY", category: "crypto", configured: true, enabled: getPolicyEnabled("coingecko") },
      { name: "CoinMarketCap API", key: "COINMARKETCAP_API_KEY", category: "crypto", configured: !!process.env.COINMARKETCAP_API_KEY, enabled: getPolicyEnabled("coinmarketcap") },
      { name: "NewsAPI", key: "NEWS_API_KEY", category: "news", configured: !!process.env.NEWS_API_KEY, enabled: getPolicyEnabled("newsapi") },
      { name: "GDELT News", key: "GDELT", category: "news", configured: true, enabled: getPolicyEnabled("gdelt") },
      { name: "Valyu API", key: "VALYU_API_KEY", category: "data", configured: !!process.env.VALYU_API_KEY, enabled: getPolicyEnabled("valyu") },
      { name: "Hugging Face API", key: "HUGGINGFACE_API_KEY", category: "ai", configured: !!process.env.HUGGINGFACE_API_KEY, enabled: getPolicyEnabled("huggingface") },
      { name: "OpenAI API", key: "OPENAI_API_KEY", category: "ai", configured: aiProviders.includes("openai"), enabled: getPolicyEnabled("openai") },
      { name: "Groq API", key: "GROQ_API_KEY", category: "ai", configured: aiProviders.includes("groq"), enabled: getPolicyEnabled("groq") },
      { name: "Together API", key: "TOGETHER_API_KEY", category: "ai", configured: aiProviders.includes("together"), enabled: getPolicyEnabled("together") },
      { name: "AIML API", key: "AIMLAPI_KEY", category: "ai", configured: aiProviders.includes("aimlapi"), enabled: true },
      { name: "OpenRouter API", key: "OPENROUTER_API_KEY", category: "ai", configured: !!process.env.OPENROUTER_API_KEY, enabled: true },
    ];

    const summary = {
      total: apiKeys.length,
      configured: apiKeys.filter(k => k.configured).length,
      missing: apiKeys.filter(k => !k.configured).length,
      enabled: apiKeys.filter(k => k.enabled).length,
      byCategory: {
        brokerage: apiKeys.filter(k => k.category === "brokerage"),
        market_data: apiKeys.filter(k => k.category === "market_data"),
        crypto: apiKeys.filter(k => k.category === "crypto"),
        news: apiKeys.filter(k => k.category === "news"),
        data: apiKeys.filter(k => k.category === "data"),
        ai: apiKeys.filter(k => k.category === "ai"),
      }
    };

    res.json({ apiKeys, summary });
  } catch (error) {
    log.error("AdminAPI", "Failed to get API keys status", { error });
    res.status(500).json({ error: "Failed to get API keys status" });
  }
});

// GET /api/admin/data-fusion-status - Get data fusion status
router.get("/data-fusion-status", async (req: Request, res: Response) => {
  try {
    const { getAllProviderStatuses } = await import("../../lib/callExternal");
    const providerStatuses = await getAllProviderStatuses();

    const fusionEngineStatus = dataFusionEngine.getStatus();

    let marketIntelligence = null;
    try {
      marketIntelligence = await dataFusionEngine.getMarketIntelligence();
    } catch (err) {
      log.error("AdminAPI", "Failed to get market intelligence", { error: err });
    }

    const dataSources = [
      { name: "Market Prices", provider: "finnhub", active: !!process.env.FINNHUB_API_KEY && providerStatuses.finnhub?.enabled, category: "market_data" },
      { name: "Crypto Prices", provider: "coingecko", active: providerStatuses.coingecko?.enabled, category: "market_data" },
      { name: "Trade Execution", provider: "alpaca", active: !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY) && providerStatuses.alpaca?.enabled, category: "brokerage" },
      { name: "SEC Filings (EDGAR)", provider: "sec-edgar", active: true, category: "fundamentals" },
      { name: "Financial Data", provider: "valyu", active: !!process.env.VALYU_API_KEY && providerStatuses.valyu?.enabled, category: "fundamentals" },
      { name: "Macro Indicators (FRED)", provider: "fred", active: !!process.env.FRED_API_KEY, category: "macro" },
      { name: "Short Interest (FINRA)", provider: "finra", active: true, category: "short_interest" },
      { name: "Forex Rates (ECB)", provider: "frankfurter", active: true, category: "forex" },
      { name: "News Feed", provider: "gdelt", active: providerStatuses.gdelt?.enabled, category: "news" },
      { name: "News Headlines", provider: "newsapi", active: !!process.env.NEWS_API_KEY && providerStatuses.newsapi?.enabled, category: "news" },
      { name: "Sentiment Analysis", provider: "huggingface", active: !!process.env.HUGGINGFACE_API_KEY && providerStatuses.huggingface?.enabled, category: "sentiment" },
    ];

    const activeSourcesCount = marketIntelligence?.activeSources ?? dataSources.filter(s => s.active).length;
    const totalSources = marketIntelligence?.totalSources ?? dataSources.length;
    const intelligenceScore = marketIntelligence?.overall ?? (activeSourcesCount / totalSources);

    const fusionMetrics = {
      intelligenceScore,
      activeSources: activeSourcesCount,
      totalSources,
      dataSources,
      dataQuality: marketIntelligence?.dataQuality ?? "unknown",
      components: marketIntelligence?.components ?? null,
      signals: marketIntelligence?.signals ?? [],
      embeddingsCount: fusionEngineStatus.cacheSize,
      lastFusionRun: fusionEngineStatus.lastFusionTime
        ? new Date(fusionEngineStatus.lastFusionTime).toISOString()
        : null,
      capabilities: {
        marketData: dataSources.some(s => s.provider === "finnhub" && s.active) || dataSources.some(s => s.provider === "coingecko" && s.active),
        newsAnalysis: dataSources.some(s => (s.provider === "gdelt" || s.provider === "newsapi") && s.active),
        sentimentAnalysis: dataSources.some(s => s.provider === "huggingface" && s.active),
        tradingCapability: dataSources.some(s => s.provider === "alpaca" && s.active),
        fundamentals: dataSources.some(s => (s.provider === "sec-edgar" || s.provider === "valyu") && s.active),
        shortInterest: dataSources.some(s => s.provider === "finra" && s.active),
        macroAnalysis: dataSources.some(s => s.provider === "fred" && s.active),
        forexData: dataSources.some(s => s.provider === "frankfurter" && s.active),
      }
    };

    res.json(fusionMetrics);
  } catch (error) {
    log.error("AdminAPI", "Failed to get data fusion status", { error });
    res.status(500).json({ error: "Failed to get data fusion status" });
  }
});

export default router;
