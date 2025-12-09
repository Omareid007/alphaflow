import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry from "p-retry";
import type { MovingAverageCrossoverConfig } from "../strategies/moving-average-crossover";

const MODEL = "gpt-4o";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const limit = pLimit(2);

export interface StrategyValidationResult {
  summary: string;
  riskAssessment: string;
  parameterFeedback: string[];
  suitability: "retail_friendly" | "borderline" | "advanced_only";
  confidence: number;
}

export interface MarketIntelligence {
  currentTrend?: "bullish" | "bearish" | "sideways";
  volatility?: "low" | "medium" | "high";
  recentNews?: string[];
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

export async function validateMovingAverageConfig(
  config: MovingAverageCrossoverConfig,
  marketIntelligence?: MarketIntelligence
): Promise<StrategyValidationResult> {
  const systemPrompt = `You are an expert financial strategy analyst reviewing a Moving Average Crossover trading strategy configuration for a retail investor using a paper trading application.

Your role is to:
1. Explain what this configuration means in plain English
2. Assess the risk level for a retail investor with modest experience
3. Identify any concerning parameter choices
4. Rate suitability: "retail_friendly" (safe for beginners), "borderline" (requires caution), or "advanced_only" (experienced traders only)

You MUST respond with a valid JSON object containing these exact fields:
- summary: 2-3 sentences explaining what this strategy does in simple terms
- riskAssessment: 1-2 sentences about the risk profile of this configuration
- parameterFeedback: array of strings, each pointing out a specific concern or positive aspect of the parameters
- suitability: one of "retail_friendly", "borderline", or "advanced_only"
- confidence: number between 0 and 1 indicating your confidence in this assessment

Be educational and supportive, not alarmist. This is paper trading for learning purposes.`;

  const userPrompt = buildValidationPrompt(config, marketIntelligence);

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

          const parsed = JSON.parse(content) as StrategyValidationResult;
          return validateResult(parsed);
        } catch (error) {
          if (isRateLimitError(error)) {
            throw error;
          }
          const abortError = new Error((error as Error).message);
          (abortError as Error & { name: string }).name = "AbortError";
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

function buildValidationPrompt(
  config: MovingAverageCrossoverConfig,
  marketIntelligence?: MarketIntelligence
): string {
  let prompt = `Please review this Moving Average Crossover strategy configuration:

## Configuration
- Symbol: ${config.symbol}
- Fast SMA Period: ${config.fastPeriod} days
- Slow SMA Period: ${config.slowPeriod} days
- Position Allocation: ${(config.allocationPct * 100).toFixed(1)}% of portfolio
- Risk Limit: ${(config.riskLimitPct * 100).toFixed(1)}% max loss

## Strategy Explanation
This strategy generates buy signals when the ${config.fastPeriod}-day moving average crosses above the ${config.slowPeriod}-day moving average (golden cross), and sell signals when it crosses below (death cross).`;

  if (marketIntelligence) {
    prompt += `\n\n## Current Market Context`;
    if (marketIntelligence.currentTrend) {
      prompt += `\n- Market Trend: ${marketIntelligence.currentTrend}`;
    }
    if (marketIntelligence.volatility) {
      prompt += `\n- Volatility Level: ${marketIntelligence.volatility}`;
    }
    if (marketIntelligence.recentNews && marketIntelligence.recentNews.length > 0) {
      prompt += `\n- Recent News:\n${marketIntelligence.recentNews.slice(0, 3).map(n => `  - ${n}`).join("\n")}`;
    }
  }

  prompt += `\n\nProvide your assessment as a JSON object.`;

  return prompt;
}

function validateResult(result: Partial<StrategyValidationResult>): StrategyValidationResult {
  const validSuitability = ["retail_friendly", "borderline", "advanced_only"] as const;

  const suitability = validSuitability.includes(result.suitability as typeof validSuitability[number])
    ? (result.suitability as typeof validSuitability[number])
    : "borderline";

  let confidence = Number(result.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    confidence = 0.7;
  }

  return {
    summary: result.summary || "This moving average crossover strategy follows price trends by tracking when short-term momentum crosses long-term averages.",
    riskAssessment: result.riskAssessment || "Risk assessment pending. Please review parameters carefully.",
    parameterFeedback: Array.isArray(result.parameterFeedback) ? result.parameterFeedback : [],
    suitability,
    confidence,
  };
}

export function getValidatorStatus(): { available: boolean; model: string } {
  return {
    available: !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
    model: MODEL,
  };
}
