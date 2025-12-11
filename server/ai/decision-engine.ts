import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry from "p-retry";
import { openRouterProvider } from "./openrouter-provider";
import { log } from "../utils/logger";
import { gdelt } from "../connectors/gdelt";
import { valyu } from "../connectors/valyu";
import { finnhub } from "../connectors/finnhub";
import { newsapi } from "../connectors/newsapi";

const MODEL = "gpt-4o-mini";

const DATA_QUERY_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_news_sentiment",
      description: "Get real-time news sentiment and headlines for a stock or crypto symbol from GDELT (free, updates every 15 min)",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "The stock ticker (e.g., AAPL, MSFT) or crypto name (e.g., Bitcoin, Ethereum)"
          },
          isCrypto: {
            type: "boolean",
            description: "Whether this is a cryptocurrency (true) or stock (false)"
          }
        },
        required: ["symbol", "isCrypto"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_financial_ratios",
      description: "Get fundamental financial ratios for a stock (P/E, ROE, debt-to-equity, etc.) from Valyu.ai",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "The stock ticker symbol (e.g., AAPL, MSFT)"
          }
        },
        required: ["symbol"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_earnings_data",
      description: "Get recent earnings data (EPS, revenue, surprises) for a stock",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string", 
            description: "The stock ticker symbol (e.g., AAPL, MSFT)"
          }
        },
        required: ["symbol"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_insider_transactions",
      description: "Get recent insider trading activity (buys/sells by executives)",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "The stock ticker symbol (e.g., AAPL, MSFT)"
          }
        },
        required: ["symbol"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_additional_news",
      description: "Get additional news headlines from NewsAPI for broader market context",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for news (e.g., 'Apple earnings', 'tech sector')"
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_market_quote",
      description: "Get real-time stock quote data from Finnhub",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "The stock ticker symbol (e.g., AAPL, MSFT)"
          }
        },
        required: ["symbol"],
        additionalProperties: false
      }
    }
  }
];

async function executeToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "get_news_sentiment": {
        const symbol = args.symbol as string;
        const isCrypto = args.isCrypto as boolean;
        if (isCrypto) {
          const sentiment = await gdelt.getCryptoSentiment(symbol);
          return JSON.stringify({
            sentiment: sentiment.sentiment,
            articleCount: sentiment.articleCount,
            averageTone: sentiment.averageTone,
            volumeSpike: sentiment.volumeSpike,
            topHeadlines: sentiment.topHeadlines.slice(0, 3)
          });
        } else {
          const articles = await gdelt.searchArticles(`${symbol} stock`, { timespan: "24hours", maxRecords: 20 });
          const tone = await gdelt.getToneTimeline(`${symbol} stock`, "24hours");
          const sentiment = tone.averageTone > 2 ? "bullish" : tone.averageTone < -2 ? "bearish" : "neutral";
          return JSON.stringify({
            sentiment,
            articleCount: articles.totalResults,
            averageTone: tone.averageTone,
            volumeSpike: false,
            topHeadlines: articles.articles.slice(0, 3).map(a => a.title)
          });
        }
      }
      case "get_financial_ratios": {
        const ratios = await valyu.getFinancialRatios(args.symbol as string);
        return JSON.stringify({
          peRatio: ratios.peRatio,
          roe: ratios.roe,
          debtToEquity: ratios.debtToEquity,
          hasData: !!ratios.rawData
        });
      }
      case "get_earnings_data": {
        const earnings = await valyu.getEarnings(args.symbol as string);
        return JSON.stringify({
          eps: earnings.eps,
          revenue: earnings.revenue,
          hasData: !!earnings.rawData
        });
      }
      case "get_insider_transactions": {
        const insider = await valyu.getInsiderTransactions(args.symbol as string);
        const buys = insider.transactions.filter(t => t.transactionType === "buy");
        const sells = insider.transactions.filter(t => t.transactionType === "sell");
        return JSON.stringify({
          recentBuys: buys.length,
          recentSells: sells.length,
          netInsiderSentiment: insider.netInsiderSentiment,
          totalBuyValue: insider.totalBuyValue,
          totalSellValue: insider.totalSellValue
        });
      }
      case "get_additional_news": {
        const news = await newsapi.searchNews(args.query as string, "relevancy", 5);
        return JSON.stringify({
          articles: news.slice(0, 3).map(a => ({
            title: a.title,
            source: a.source
          })),
          totalResults: news.length
        });
      }
      case "get_market_quote": {
        const quote = await finnhub.getQuote(args.symbol as string);
        return JSON.stringify({
          currentPrice: quote.c,
          change: quote.d,
          changePercent: quote.dp,
          high: quote.h,
          low: quote.l,
          open: quote.o,
          previousClose: quote.pc
        });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    log.warn("AI", `Tool call failed: ${name}`, { error: String(error) });
    return JSON.stringify({ error: `Failed to fetch data: ${(error as Error).message}` });
  }
}

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface MarketData {
  symbol: string;
  currentPrice: number;
  priceChange24h?: number;
  priceChangePercent24h?: number;
  high24h?: number;
  low24h?: number;
  volume?: number;
  marketCap?: number;
}

export interface NewsContext {
  headlines?: string[];
  sentiment?: "bullish" | "bearish" | "neutral";
  summary?: string;
}

export interface StrategyContext {
  id: string;
  name: string;
  type: string;
  parameters?: Record<string, unknown>;
}

export interface AIDecision {
  action: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string;
  riskLevel: "low" | "medium" | "high";
  suggestedQuantity?: number;
  targetPrice?: number;
  stopLoss?: number;
  trailingStopPercent?: number;
}

function isRateLimitOrQuotaError(error: unknown): boolean {
  const errorMsg = (error as { message?: string })?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("403") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit") ||
    errorMsg.toLowerCase().includes("spend limit") ||
    errorMsg.toLowerCase().includes("exceeded")
  );
}

const limit = pLimit(2);

let useOpenRouterFallback = false;
let openAIFailureCount = 0;
const MAX_OPENAI_FAILURES = 3;

export class AIDecisionEngine {
  private getSystemPrompt(): string {
    return `You are an expert trading analyst AI assistant for a paper trading application. Your role is to analyze market data and provide trading recommendations.

You MUST respond with a valid JSON object containing these exact fields:
- action: "buy", "sell", or "hold"
- confidence: number between 0 and 1 (e.g., 0.75 for 75% confidence)
- reasoning: a brief explanation of your decision (2-3 sentences)
- riskLevel: "low", "medium", or "high"
- suggestedQuantity: optional number suggesting position size as a percentage of portfolio (0.01-0.25)
- targetPrice: optional number for take-profit target
- stopLoss: optional number for stop-loss level

Consider:
1. Current price action and technical indicators implied by price data
2. Market sentiment from news if available
3. Risk management - never suggest more than 25% of portfolio on any single trade
4. The strategy type and parameters if provided

This is for PAPER TRADING only - educational purposes. Be decisive but conservative.`;
  }

  async analyzeOpportunity(
    symbol: string,
    marketData: MarketData,
    newsContext?: NewsContext,
    strategy?: StrategyContext
  ): Promise<AIDecision> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(symbol, marketData, newsContext, strategy);

    if (useOpenRouterFallback && openRouterProvider.isAvailable()) {
      return this.analyzeWithOpenRouter(systemPrompt, userPrompt);
    }

    return limit(() =>
      pRetry(
        async () => {
          try {
            const response = await openai.chat.completions.create({
              model: MODEL,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              response_format: { type: "json_object" },
              max_completion_tokens: 1024,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
              log.warn("AI", "Empty response from AI for analysis, trying OpenRouter fallback");
              if (openRouterProvider.isAvailable()) {
                return this.analyzeWithOpenRouter(systemPrompt, userPrompt);
              }
              return this.getDefaultDecision("AI returned empty response");
            }

            openAIFailureCount = 0;
            const parsed = JSON.parse(content) as AIDecision;
            return this.validateDecision(parsed);
          } catch (error) {
            const errorMsg = (error as Error).message || String(error);
            
            // Check for empty response or parse errors - use fallback instead of throwing
            if (errorMsg.includes("Empty response") || errorMsg.includes("JSON")) {
              log.warn("AI", "Parse/empty error, trying OpenRouter fallback", { error: errorMsg });
              if (openRouterProvider.isAvailable()) {
                return this.analyzeWithOpenRouter(systemPrompt, userPrompt);
              }
              return this.getDefaultDecision(`AI analysis issue: ${errorMsg}`);
            }
            
            if (isRateLimitOrQuotaError(error)) {
              openAIFailureCount++;
              log.warn("AI", `OpenAI failure ${openAIFailureCount}/${MAX_OPENAI_FAILURES}`, { error: errorMsg });
              
              if (openAIFailureCount >= MAX_OPENAI_FAILURES && openRouterProvider.isAvailable()) {
                log.info("AI", "Switching to OpenRouter fallback");
                useOpenRouterFallback = true;
                return this.analyzeWithOpenRouter(systemPrompt, userPrompt);
              }
              throw error;
            }
            const abortError = new Error(errorMsg);
            (abortError as Error & { name: string }).name = 'AbortError';
            throw abortError;
          }
        },
        {
          retries: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          factor: 2,
        }
      )
    );
  }

  private async analyzeWithOpenRouter(
    systemPrompt: string,
    userPrompt: string
  ): Promise<AIDecision> {
    try {
      const { content, model } = await openRouterProvider.chat(systemPrompt, userPrompt);
      log.info("AI", `OpenRouter response from ${model}`);
      const parsed = JSON.parse(content) as AIDecision;
      return this.validateDecision(parsed);
    } catch (error) {
      log.error("AI", "OpenRouter failed", { error: (error as Error).message });
      return this.getDefaultDecision("OpenRouter analysis failed");
    }
  }

  async analyzeWithFunctionCalling(
    symbol: string,
    marketData: MarketData,
    newsContext?: NewsContext,
    strategy?: StrategyContext
  ): Promise<AIDecision & { toolsUsed?: string[] }> {
    const systemPrompt = `You are an expert trading analyst AI assistant for a paper trading application.

You have access to tools to query real-time market data, news sentiment, financial ratios, earnings, and insider trading activity. Use these tools when you need additional information to make a better trading decision.

After gathering the data you need, provide your final recommendation as a valid JSON object with these fields:
- action: "buy", "sell", or "hold"
- confidence: number between 0 and 1
- reasoning: explanation of your decision including data sources used
- riskLevel: "low", "medium", or "high"
- suggestedQuantity: optional position size (0.01-0.25)
- targetPrice: optional take-profit target
- stopLoss: optional stop-loss level

This is for PAPER TRADING only. Be decisive but conservative.`;

    const userPrompt = this.buildUserPrompt(symbol, marketData, newsContext, strategy);
    const toolsUsed: string[] = [];

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      let response = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools: DATA_QUERY_TOOLS,
        tool_choice: "auto",
        max_completion_tokens: 2048,
        parallel_tool_calls: false,
      });

      let iterations = 0;
      const maxIterations = 3;

      while (response.choices[0]?.message?.tool_calls && iterations < maxIterations) {
        const toolCalls = response.choices[0].message.tool_calls;
        messages.push(response.choices[0].message);

        for (const toolCall of toolCalls) {
          const funcCall = toolCall as { id: string; type: string; function: { name: string; arguments: string } };
          const args = JSON.parse(funcCall.function.arguments);
          log.debug("AI", `Function call: ${funcCall.function.name}`, { args });
          toolsUsed.push(funcCall.function.name);

          const result = await executeToolCall(funcCall.function.name, args);
          messages.push({
            role: "tool",
            tool_call_id: funcCall.id,
            content: result,
          });
        }

        response = await openai.chat.completions.create({
          model: MODEL,
          messages,
          tools: DATA_QUERY_TOOLS,
          tool_choice: "auto",
          max_completion_tokens: 2048,
          parallel_tool_calls: false,
        });

        iterations++;
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        log.warn("AI", "Empty response from function-calling analysis");
        return { ...this.getDefaultDecision("Empty response"), toolsUsed };
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log.warn("AI", "No JSON found in function-calling response");
        return { ...this.getDefaultDecision("No JSON in response"), toolsUsed };
      }

      const parsed = JSON.parse(jsonMatch[0]) as AIDecision;
      log.info("AI", `Function-calling analysis complete`, { 
        symbol, 
        action: parsed.action, 
        toolsUsed: toolsUsed.length 
      });
      
      return { ...this.validateDecision(parsed), toolsUsed };
    } catch (error) {
      log.error("AI", "Function-calling analysis failed", { error: (error as Error).message });
      return { ...await this.analyzeOpportunity(symbol, marketData, newsContext, strategy), toolsUsed };
    }
  }

  private getDefaultDecision(reason: string): AIDecision {
    return {
      action: "hold",
      confidence: 0.3,
      reasoning: reason + ". Defaulting to hold for safety.",
      riskLevel: "medium",
    };
  }

  private buildUserPrompt(
    symbol: string,
    marketData: MarketData,
    newsContext?: NewsContext,
    strategy?: StrategyContext
  ): string {
    let prompt = `Analyze the following trading opportunity and provide a recommendation:

## Asset
Symbol: ${symbol}

## Market Data
- Current Price: $${marketData.currentPrice.toFixed(4)}`;

    if (marketData.priceChange24h !== undefined) {
      prompt += `\n- 24h Price Change: $${marketData.priceChange24h.toFixed(4)}`;
    }
    if (marketData.priceChangePercent24h !== undefined) {
      prompt += `\n- 24h Change %: ${marketData.priceChangePercent24h.toFixed(2)}%`;
    }
    if (marketData.high24h !== undefined) {
      prompt += `\n- 24h High: $${marketData.high24h.toFixed(4)}`;
    }
    if (marketData.low24h !== undefined) {
      prompt += `\n- 24h Low: $${marketData.low24h.toFixed(4)}`;
    }
    if (marketData.volume !== undefined) {
      prompt += `\n- 24h Volume: $${marketData.volume.toLocaleString()}`;
    }

    if (newsContext) {
      prompt += `\n\n## News Context`;
      if (newsContext.sentiment) {
        prompt += `\n- Overall Sentiment: ${newsContext.sentiment}`;
      }
      if (newsContext.headlines && newsContext.headlines.length > 0) {
        prompt += `\n- Recent Headlines:\n${newsContext.headlines.slice(0, 5).map(h => `  - ${h}`).join("\n")}`;
      }
      if (newsContext.summary) {
        prompt += `\n- Summary: ${newsContext.summary}`;
      }
    }

    if (strategy) {
      prompt += `\n\n## Strategy Context
- Strategy Name: ${strategy.name}
- Strategy Type: ${strategy.type}`;
      if (strategy.parameters) {
        prompt += `\n- Parameters: ${JSON.stringify(strategy.parameters)}`;
      }
    }

    prompt += `\n\nBased on this information, what is your trading recommendation? Provide your response as a JSON object.`;

    return prompt;
  }

  private validateDecision(decision: Partial<AIDecision>): AIDecision {
    const validActions = ["buy", "sell", "hold"] as const;
    const validRiskLevels = ["low", "medium", "high"] as const;

    const action = validActions.includes(decision.action as "buy" | "sell" | "hold")
      ? (decision.action as "buy" | "sell" | "hold")
      : "hold";

    let confidence = Number(decision.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      confidence = 0.5;
    }

    const riskLevel = validRiskLevels.includes(decision.riskLevel as "low" | "medium" | "high")
      ? (decision.riskLevel as "low" | "medium" | "high")
      : "medium";

    let trailingStopPercent = decision.trailingStopPercent;
    if (trailingStopPercent !== undefined) {
      trailingStopPercent = Number(trailingStopPercent);
      if (isNaN(trailingStopPercent) || trailingStopPercent < 0.5 || trailingStopPercent > 20) {
        trailingStopPercent = undefined;
      }
    }

    return {
      action,
      confidence,
      reasoning: decision.reasoning || "Unable to provide detailed reasoning.",
      riskLevel,
      suggestedQuantity: decision.suggestedQuantity,
      targetPrice: decision.targetPrice,
      stopLoss: decision.stopLoss,
      trailingStopPercent,
    };
  }

  async batchAnalyze(
    opportunities: Array<{
      symbol: string;
      marketData: MarketData;
      newsContext?: NewsContext;
      strategy?: StrategyContext;
    }>
  ): Promise<Map<string, AIDecision>> {
    const results = new Map<string, AIDecision>();

    const promises = opportunities.map(async (opp) => {
      try {
        const decision = await this.analyzeOpportunity(
          opp.symbol,
          opp.marketData,
          opp.newsContext,
          opp.strategy
        );
        results.set(opp.symbol, decision);
      } catch (error) {
        log.error("AI", `Failed to analyze ${opp.symbol}`, { error: String(error) });
        results.set(opp.symbol, this.getDefaultDecision(`Analysis failed for ${opp.symbol}`));
      }
    });

    await Promise.all(promises);
    return results;
  }

  getStatus(): { available: boolean; model: string; provider: string; usingFallback: boolean } {
    const openAIAvailable = !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
    const openRouterStatus = openRouterProvider.getStatus();
    
    return {
      available: openAIAvailable || openRouterStatus.available,
      model: useOpenRouterFallback ? (openRouterStatus.currentModel || "openrouter") : MODEL,
      provider: useOpenRouterFallback ? "OpenRouter" : "Replit AI Integrations (OpenAI)",
      usingFallback: useOpenRouterFallback,
    };
  }

  resetToOpenAI() {
    useOpenRouterFallback = false;
    openAIFailureCount = 0;
    log.info("AI", "Reset to OpenAI primary");
  }

  forceOpenRouter() {
    useOpenRouterFallback = true;
    log.info("AI", "Forced OpenRouter mode");
  }
}

export const aiDecisionEngine = new AIDecisionEngine();
