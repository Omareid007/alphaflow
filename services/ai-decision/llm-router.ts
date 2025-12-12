/**
 * AI Active Trader - LLM Router
 * Simple provider selection based on availability
 * Uses OpenAI as primary with fallback options
 */

import { LLMProvider, ProviderStatus, CostTier, SpeedTier, QualityTier, LLMRouterConfig } from './types';
import { createLogger } from '../shared/common';

const logger = createLogger('ai-decision:llm-router');

interface ProviderConfig {
  envVar: string;
  costTier: CostTier;
  speedTier: SpeedTier;
  qualityTier: QualityTier;
  defaultModel: string;
}

const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig> = {
  [LLMProvider.OPENAI]: {
    envVar: 'OPENAI_API_KEY',
    costTier: 'premium',
    speedTier: 'moderate',
    qualityTier: 'excellent',
    defaultModel: 'gpt-4o-mini',
  },
  [LLMProvider.GROQ]: {
    envVar: 'GROQ_API_KEY',
    costTier: 'cheap',
    speedTier: 'fast',
    qualityTier: 'good',
    defaultModel: 'llama-3.1-8b-instant',
  },
  [LLMProvider.TOGETHER]: {
    envVar: 'TOGETHER_API_KEY',
    costTier: 'cheap',
    speedTier: 'moderate',
    qualityTier: 'good',
    defaultModel: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
  },
  [LLMProvider.AIMLAPI]: {
    envVar: 'AIML_API_KEY',
    costTier: 'moderate',
    speedTier: 'moderate',
    qualityTier: 'good',
    defaultModel: 'gpt-4o-mini',
  },
  [LLMProvider.OPENROUTER]: {
    envVar: 'OPENROUTER_API_KEY',
    costTier: 'moderate',
    speedTier: 'moderate',
    qualityTier: 'excellent',
    defaultModel: 'openai/gpt-4o-mini',
  },
};

const PRIORITY_ORDER: LLMProvider[] = [
  LLMProvider.OPENAI,
  LLMProvider.GROQ,
  LLMProvider.TOGETHER,
  LLMProvider.AIMLAPI,
  LLMProvider.OPENROUTER,
];

export class LLMRouter {
  private config: LLMRouterConfig;

  constructor(config: LLMRouterConfig = {}) {
    this.config = {
      fallbackEnabled: true,
      prioritizeSpeed: false,
      prioritizeCost: false,
      ...config,
    };
  }

  isProviderAvailable(provider: LLMProvider): boolean {
    const config = PROVIDER_CONFIGS[provider];
    if (!config) return false;
    const apiKey = process.env[config.envVar];
    return !!apiKey && apiKey.length > 0;
  }

  getProviderStatus(provider: LLMProvider): ProviderStatus {
    const config = PROVIDER_CONFIGS[provider];
    return {
      name: provider,
      available: this.isProviderAvailable(provider),
      costTier: config.costTier,
      speedTier: config.speedTier,
      qualityTier: config.qualityTier,
      defaultModel: config.defaultModel,
    };
  }

  getAvailableProviders(): ProviderStatus[] {
    return Object.values(LLMProvider)
      .map((provider) => this.getProviderStatus(provider))
      .filter((status) => status.available);
  }

  getAllProviders(): ProviderStatus[] {
    return Object.values(LLMProvider).map((provider) => this.getProviderStatus(provider));
  }

  selectBestProvider(): ProviderStatus | null {
    const available = this.getAvailableProviders();
    
    if (available.length === 0) {
      logger.warn('No LLM providers available');
      return null;
    }

    if (this.config.preferredProvider) {
      const preferred = available.find((p) => p.name === this.config.preferredProvider);
      if (preferred) {
        logger.debug('Using preferred provider', { provider: preferred.name });
        return preferred;
      }
    }

    if (this.config.prioritizeSpeed) {
      const sorted = [...available].sort((a, b) => {
        const speedOrder: Record<SpeedTier, number> = { fast: 0, moderate: 1, slow: 2 };
        return speedOrder[a.speedTier] - speedOrder[b.speedTier];
      });
      logger.debug('Selected fastest provider', { provider: sorted[0].name });
      return sorted[0];
    }

    if (this.config.prioritizeCost) {
      const sorted = [...available].sort((a, b) => {
        const costOrder: Record<CostTier, number> = { cheap: 0, moderate: 1, premium: 2 };
        return costOrder[a.costTier] - costOrder[b.costTier];
      });
      logger.debug('Selected cheapest provider', { provider: sorted[0].name });
      return sorted[0];
    }

    for (const provider of PRIORITY_ORDER) {
      const status = available.find((p) => p.name === provider);
      if (status) {
        logger.debug('Selected provider by priority', { provider: status.name });
        return status;
      }
    }

    return available[0];
  }

  getNextFallbackProvider(currentProvider: LLMProvider): ProviderStatus | null {
    if (!this.config.fallbackEnabled) {
      return null;
    }

    const available = this.getAvailableProviders();
    const currentIndex = PRIORITY_ORDER.indexOf(currentProvider);

    for (let i = currentIndex + 1; i < PRIORITY_ORDER.length; i++) {
      const provider = PRIORITY_ORDER[i];
      const status = available.find((p) => p.name === provider);
      if (status) {
        logger.info('Falling back to next provider', { 
          from: currentProvider, 
          to: status.name 
        });
        return status;
      }
    }

    return null;
  }
}

export const llmRouter = new LLMRouter();
