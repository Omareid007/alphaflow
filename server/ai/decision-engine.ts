import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry from "p-retry";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const MODEL = "gpt-5";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
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
}

function isRateLimitError(error: unknown): boolean {
  const errorMsg = (error as { message?: string })?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

const limit = pLimit(2);

export class AIDecisionEngine {
  async analyzeOpportunity(
    symbol: string,
    marketData: MarketData,
    newsContext?: NewsContext,
    strategy?: StrategyContext
  ): Promise<AIDecision> {
    const systemPrompt = `You are an expert trading analyst AI assistant for a paper trading application. Your role is to analyze market data and provide trading recommendations.

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

    const userPrompt = this.buildUserPrompt(symbol, marketData, newsContext, strategy);

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
              throw new Error("Empty response from AI");
            }

            const parsed = JSON.parse(content) as AIDecision;
            return this.validateDecision(parsed);
          } catch (error) {
            if (isRateLimitError(error)) {
              throw error;
            }
            const abortError = new Error((error as Error).message);
            (abortError as Error & { name: string }).name = 'AbortError';
            throw abortError;
          }
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 10000,
          factor: 2,
        }
      )
    );
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

    return {
      action,
      confidence,
      reasoning: decision.reasoning || "Unable to provide detailed reasoning.",
      riskLevel,
      suggestedQuantity: decision.suggestedQuantity,
      targetPrice: decision.targetPrice,
      stopLoss: decision.stopLoss,
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
        console.error(`Failed to analyze ${opp.symbol}:`, error);
        results.set(opp.symbol, {
          action: "hold",
          confidence: 0,
          reasoning: "Analysis failed due to an error.",
          riskLevel: "high",
        });
      }
    });

    await Promise.all(promises);
    return results;
  }

  getStatus(): { available: boolean; model: string; provider: string } {
    return {
      available: !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
      model: MODEL,
      provider: "Replit AI Integrations (OpenAI)",
    };
  }
}

export const aiDecisionEngine = new AIDecisionEngine();
