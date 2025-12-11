/**
 * LLM Router - Intelligent routing of tasks to appropriate LLM providers
 * 
 * Routes tasks based on:
 * - Complexity: Simple tasks → cheap models (Groq Llama 8B)
 * - Quality needs: Complex reasoning → GPT-4o-mini or better
 * - Speed requirements: Real-time → Groq (fastest)
 * - Cost optimization: Bulk tasks → Together.ai or AIML API
 * 
 * Priority order (with fallbacks):
 * 1. OpenAI (primary, most reliable)
 * 2. Groq (fast, cost-effective)
 * 3. Together.ai (wide model selection)
 * 4. AIML API (400+ models)
 * 5. OpenRouter (fallback)
 * 
 * @see docs/AI_MODELS_AND_PROVIDERS.md
 */

import { log } from "../utils/logger";
import {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMClientError,
} from "./llmClient";
import { openaiClient } from "./openaiClient";
import { groqClient } from "./groqClient";
import { togetherClient } from "./togetherClient";
import { aimlClient } from "./aimlClient";
import { openrouterClient } from "./openrouterClient";

export type TaskComplexity = "simple" | "moderate" | "complex";
export type TaskPriority = "speed" | "cost" | "quality" | "balanced";

export interface RouterConfig {
  complexity?: TaskComplexity;
  priority?: TaskPriority;
  preferredProvider?: string;
  fallbackEnabled?: boolean;
  maxRetries?: number;
}

interface ProviderInfo {
  client: LLMClient;
  costTier: "cheap" | "moderate" | "premium";
  speedTier: "fast" | "moderate" | "slow";
  qualityTier: "basic" | "good" | "excellent";
  defaultModel?: string;
}

const providers: Record<string, ProviderInfo> = {
  openai: {
    client: openaiClient,
    costTier: "premium",
    speedTier: "moderate",
    qualityTier: "excellent",
  },
  groq: {
    client: groqClient,
    costTier: "cheap",
    speedTier: "fast",
    qualityTier: "good",
    defaultModel: "llama-3.1-8b-instant",
  },
  together: {
    client: togetherClient,
    costTier: "cheap",
    speedTier: "moderate",
    qualityTier: "good",
    defaultModel: "meta-llama/Llama-3.2-3B-Instruct-Turbo",
  },
  aimlapi: {
    client: aimlClient,
    costTier: "moderate",
    speedTier: "moderate",
    qualityTier: "good",
  },
  openrouter: {
    client: openrouterClient,
    costTier: "moderate",
    speedTier: "moderate",
    qualityTier: "excellent",
  },
};

function selectProviderByPriority(
  config: RouterConfig
): { name: string; info: ProviderInfo }[] {
  const { complexity = "moderate", priority = "balanced" } = config;
  const available = Object.entries(providers)
    .filter(([_, info]) => info.client.isAvailable())
    .map(([name, info]) => ({ name, info }));

  if (available.length === 0) {
    return [];
  }

  switch (priority) {
    case "speed":
      return available.sort((a, b) => {
        const speedOrder = { fast: 0, moderate: 1, slow: 2 };
        return speedOrder[a.info.speedTier] - speedOrder[b.info.speedTier];
      });

    case "cost":
      return available.sort((a, b) => {
        const costOrder = { cheap: 0, moderate: 1, premium: 2 };
        return costOrder[a.info.costTier] - costOrder[b.info.costTier];
      });

    case "quality":
      return available.sort((a, b) => {
        const qualityOrder = { excellent: 0, good: 1, basic: 2 };
        return qualityOrder[a.info.qualityTier] - qualityOrder[b.info.qualityTier];
      });

    case "balanced":
    default:
      if (complexity === "simple") {
        return available.sort((a, b) => {
          const costOrder = { cheap: 0, moderate: 1, premium: 2 };
          return costOrder[a.info.costTier] - costOrder[b.info.costTier];
        });
      }
      if (complexity === "complex") {
        return available.sort((a, b) => {
          const qualityOrder = { excellent: 0, good: 1, basic: 2 };
          return qualityOrder[a.info.qualityTier] - qualityOrder[b.info.qualityTier];
        });
      }
      const preferredOrder = ["openai", "groq", "together", "aimlapi", "openrouter"];
      return available.sort((a, b) => {
        const aIndex = preferredOrder.indexOf(a.name);
        const bIndex = preferredOrder.indexOf(b.name);
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      });
  }
}

export class LLMRouter {
  private defaultConfig: RouterConfig;

  constructor(config: RouterConfig = {}) {
    this.defaultConfig = {
      complexity: "moderate",
      priority: "balanced",
      fallbackEnabled: true,
      maxRetries: 2,
      ...config,
    };
  }

  async call(req: LLMRequest, config?: RouterConfig): Promise<LLMResponse> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const { preferredProvider, fallbackEnabled, maxRetries = 2 } = mergedConfig;

    let orderedProviders = selectProviderByPriority(mergedConfig);

    if (preferredProvider && providers[preferredProvider]?.client.isAvailable()) {
      const preferred = orderedProviders.find(p => p.name === preferredProvider);
      if (preferred) {
        orderedProviders = [
          preferred,
          ...orderedProviders.filter(p => p.name !== preferredProvider),
        ];
      }
    }

    if (orderedProviders.length === 0) {
      throw new Error("No LLM providers available");
    }

    const providersToTry = fallbackEnabled ? orderedProviders : [orderedProviders[0]];
    let lastError: Error | undefined;

    for (const { name, info } of providersToTry) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const requestWithModel = {
            ...req,
            model: req.model || info.defaultModel,
          };

          log.debug("LLMRouter", `Attempting ${name}${attempt > 0 ? ` (retry ${attempt})` : ""}`, {
            model: requestWithModel.model,
            complexity: mergedConfig.complexity,
            priority: mergedConfig.priority,
          });

          const response = await info.client.call(requestWithModel);

          log.ai(`LLMRouter: ${name} succeeded`, {
            provider: name,
            model: response.model,
            tokensUsed: response.tokensUsed,
            attempt,
          });

          return {
            ...response,
            model: `${name}:${response.model || requestWithModel.model}`,
          };
        } catch (error) {
          lastError = error as Error;
          const llmError = error as LLMClientError;

          log.warn("LLMRouter", `${name} failed`, {
            attempt,
            isRateLimit: llmError?.isRateLimit,
            isAuthError: llmError?.isAuthError,
            error: String(error),
          });

          if (llmError?.isAuthError) {
            break;
          }

          if (llmError?.isRateLimit && attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }

          if (attempt === maxRetries) {
            break;
          }
        }
      }
    }

    log.error("LLMRouter", "All providers failed", {
      triedProviders: providersToTry.map(p => p.name),
      lastError: String(lastError),
    });

    throw lastError || new Error("All LLM providers failed");
  }

  getAvailableProviders(): string[] {
    return Object.entries(providers)
      .filter(([_, info]) => info.client.isAvailable())
      .map(([name]) => name);
  }

  getProviderStatus(): Record<string, boolean> {
    return Object.fromEntries(
      Object.entries(providers).map(([name, info]) => [name, info.client.isAvailable()])
    );
  }
}

export const llmRouter = new LLMRouter();

export async function routedLLMCall(
  req: LLMRequest,
  config?: RouterConfig
): Promise<LLMResponse> {
  return llmRouter.call(req, config);
}
