import pLimit from "p-limit";
import pRetry from "p-retry";
import type { MovingAverageCrossoverConfig } from "../strategies/moving-average-crossover";
import { callLLM, generateTraceId } from "./llmGateway";

const MODEL = "gpt-4o";

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
  const systemPrompt = `You are an AI trading agent evaluating a Moving Average Crossover strategy for a retail user inside a paper-trading environment.

Voice and rules:
- Write with the precision and restraint of an AI model, not a human analyst.
- Keep every answer concise and signal-focused.
- No paragraphs longer than one sentence.
- No filler, no storytelling, no disclaimers.
- Insights should read as if they were derived directly from data.

Your tasks:
1. Describe the strategy behavior in exactly ONE short, clear sentence.
2. Give a risk assessment in exactly ONE sentence.
3. Provide 2 bullet points of parameter feedback. Each bullet must be:
   - specific,
   - no longer than one sentence,
   - describing either a strength or a risk in the configuration.
4. Use MARKET INTELLIGENCE when provided (trend, volatility, sentiment):
   - Include ONE sentence giving a strategy adjustment or caution that logically follows from the market conditions.
5. Do not include any flair lines, taglines, or meta statements. The tone alone must feel like AI-curated insight.

Output format:
Return a JSON object with EXACT fields:
- summary: one concise sentence.
- riskAssessment: one concise sentence.
- parameterFeedback: array of 2 short, precise bullet points.
- marketSuggestion: one sentence reflecting market intelligence.
- suitability: "retail_friendly" | "borderline" | "advanced_only"
- confidence: number between 0 and 1

Keep the output tight, data-driven, and free of unnecessary explanation.
`;

  const userPrompt = buildValidationPrompt(config, marketIntelligence);

  return limit(() =>
    pRetry(
      async () => {
        try {
          const response = await callLLM({
            role: "risk_manager",
            criticality: "medium",
            purpose: "strategy_validation",
            traceId: generateTraceId(),
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            responseFormat: { type: "json_object" },
            maxTokens: 1024,
          });

          const content = response.text;
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
