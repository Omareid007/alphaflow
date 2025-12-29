import { Router, Request, Response } from "express";
import { coingecko } from "../connectors/coingecko";
import { finnhub } from "../connectors/finnhub";
import { alpaca } from "../connectors/alpaca";
import { coinmarketcap } from "../connectors/coinmarketcap";
import { newsapi } from "../connectors/newsapi";
import { uaeMarkets } from "../connectors/uae-markets";
import { valyu } from "../connectors/valyu";
import { huggingface } from "../connectors/huggingface";
import { gdelt } from "../connectors/gdelt";
import { aiDecisionEngine } from "../ai/decision-engine";
import { dataFusionEngine } from "../fusion/data-fusion-engine";
import { log } from "../utils/logger";

const router = Router();

/**
 * GET /api/connectors/status
 * Get connection status of all connectors
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const cryptoStatus = coingecko.getConnectionStatus();
    const stockStatus = finnhub.getConnectionStatus();
    const aiStatus = aiDecisionEngine.getStatus();
    const fusionStatus = dataFusionEngine.getStatus();
    const alpacaStatus = alpaca.getConnectionStatus();
    const newsStatus = await newsapi.getConnectionStatus();
    const coinmarketcapStatus = coinmarketcap.getConnectionStatus();
    const valyuStatus = valyu.getConnectionStatus();
    const huggingfaceStatus = huggingface.getConnectionStatus();
    const uaeStatus = uaeMarkets.getConnectionStatus();
    const gdeltStatus = gdelt.getConnectionStatus();

    res.json({
      crypto: {
        provider: "CoinGecko",
        ...cryptoStatus,
        lastChecked: new Date().toISOString(),
      },
      stock: {
        provider: "Finnhub",
        ...stockStatus,
        lastChecked: new Date().toISOString(),
      },
      ai: {
        ...aiStatus,
        lastChecked: new Date().toISOString(),
      },
      fusion: {
        provider: "Data Fusion Engine",
        ...fusionStatus,
        lastChecked: new Date().toISOString(),
      },
      allConnectors: [
        {
          id: "alpaca",
          name: "Alpaca",
          category: "broker",
          description: "Paper trading execution & account management",
          connected: alpacaStatus.connected,
          hasApiKey: alpacaStatus.hasCredentials,
          cacheSize: alpacaStatus.cacheSize,
          lastChecked: new Date().toISOString(),
        },
        {
          id: "finnhub",
          name: "Finnhub",
          category: "market_data",
          description: "Real-time stock quotes & fundamentals",
          connected: stockStatus.connected,
          hasApiKey: stockStatus.hasApiKey,
          cacheSize: stockStatus.cacheSize,
          lastChecked: new Date().toISOString(),
        },
        {
          id: "coingecko",
          name: "CoinGecko",
          category: "market_data",
          description: "Cryptocurrency prices & market data",
          connected: cryptoStatus.connected,
          hasApiKey: cryptoStatus.hasApiKey,
          cacheSize: cryptoStatus.cacheSize,
          lastChecked: new Date().toISOString(),
        },
        {
          id: "coinmarketcap",
          name: "CoinMarketCap",
          category: "market_data",
          description: "Comprehensive crypto market data",
          connected: coinmarketcapStatus.connected,
          hasApiKey: coinmarketcapStatus.hasApiKey,
          cacheSize: coinmarketcapStatus.cacheSize,
          lastChecked: new Date().toISOString(),
        },
        {
          id: "newsapi",
          name: "NewsAPI",
          category: "news",
          description: "Real-time news headlines for sentiment",
          connected: newsStatus.connected,
          hasApiKey: newsStatus.hasApiKey,
          cacheSize: newsStatus.cacheSize,
          budgetAllowed: newsStatus.budgetStatus.allowed,
          lastChecked: new Date().toISOString(),
        },
        {
          id: "valyu",
          name: "Valyu.ai",
          category: "enrichment",
          description:
            "9 financial datasets: earnings, ratios, balance sheets, income, cash flow, dividends, insider trades, SEC filings, market movers",
          connected: valyuStatus.connected,
          hasApiKey: valyuStatus.hasApiKey,
          cacheSize: valyuStatus.cacheSize,
          lastChecked: new Date().toISOString(),
        },
        {
          id: "huggingface",
          name: "Hugging Face",
          category: "enrichment",
          description: "FinBERT sentiment analysis & ML models",
          connected: huggingfaceStatus.connected,
          hasApiKey: huggingfaceStatus.hasApiKey,
          cacheSize: huggingfaceStatus.cacheSize,
          lastChecked: new Date().toISOString(),
        },
        {
          id: "openai",
          name: "OpenAI",
          category: "ai",
          description: "GPT-4o-mini for trading decisions",
          connected: aiStatus.available,
          hasApiKey: aiStatus.available,
          model: aiStatus.model,
          lastChecked: new Date().toISOString(),
        },
        {
          id: "uae-markets",
          name: "UAE Markets",
          category: "market_data",
          description: "Dubai DFM & Abu Dhabi ADX stocks",
          connected: uaeStatus.connected,
          hasApiKey: false, // Demo data, no API key required
          cacheSize: uaeStatus.cacheSize,
          isMockData: uaeStatus.isMockData,
          lastChecked: new Date().toISOString(),
        },
        {
          id: "gdelt",
          name: "GDELT",
          category: "news",
          description:
            "Real-time global news (100+ languages), sentiment tracking, breaking news detection (FREE, updates every 15min)",
          connected: gdeltStatus.connected,
          hasApiKey: true,
          cacheSize: gdeltStatus.cacheSize,
          lastChecked: new Date().toISOString(),
        },
      ],
    });
  } catch (error) {
    log.error("ConnectorsRoutes", "Failed to get connector status", {
      error: error,
    });
    res.status(500).json({ error: "Failed to get connector status" });
  }
});

export default router;
