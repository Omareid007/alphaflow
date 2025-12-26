import OpenAI from "openai";
import { log } from "../utils/logger";

const FREE_MODELS = [
  "meta-llama/llama-3.2-3b-instruct:free",
  "google/gemma-2-9b-it:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "mistralai/mistral-7b-instruct:free",
];

const LOW_COST_MODELS = [
  "meta-llama/llama-3.1-8b-instruct",
  "google/gemini-flash-1.5-8b",
  "anthropic/claude-3-haiku",
  "openai/gpt-4o-mini",
];

interface ModelState {
  model: string;
  failures: number;
  lastFailure: number;
  blocked: boolean;
  blockedUntil: number;
}

class OpenRouterProvider {
  private client: OpenAI | null = null;
  private modelStates: Map<string, ModelState> = new Map();
  private currentModelIndex = 0;
  private usingPaidModels = false;
  private maxFailures = 3;
  private blockDurationMs = 5 * 60 * 1000;
  
  constructor() {
    this.initModels();
  }
  
  private initModels() {
    [...FREE_MODELS, ...LOW_COST_MODELS].forEach(model => {
      this.modelStates.set(model, {
        model,
        failures: 0,
        lastFailure: 0,
        blocked: false,
        blockedUntil: 0,
      });
    });
  }
  
  private getClient(): OpenAI | null {
    if (!process.env.OPENROUTER_API_KEY) {
      return null;
    }
    
    if (!this.client) {
      this.client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultHeaders: {
          "HTTP-Referer": process.env.REPLIT_DEV_DOMAIN || "https://replit.com",
          "X-Title": "AI Active Trader",
        },
      });
    }
    
    return this.client;
  }
  
  isAvailable(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
  }
  
  private getAvailableModels(): string[] {
    const now = Date.now();
    const models = this.usingPaidModels ? LOW_COST_MODELS : FREE_MODELS;
    
    return models.filter(model => {
      const state = this.modelStates.get(model);
      if (!state) return true;
      
      if (state.blocked && now > state.blockedUntil) {
        state.blocked = false;
        state.failures = 0;
      }
      
      return !state.blocked;
    });
  }
  
  private selectModel(): string | null {
    let availableModels = this.getAvailableModels();
    
    if (availableModels.length === 0 && !this.usingPaidModels) {
      log.ai("All free models exhausted, switching to paid models");
      this.usingPaidModels = true;
      this.currentModelIndex = 0;
      availableModels = this.getAvailableModels();
    }

    if (availableModels.length === 0) {
      log.ai("All models exhausted");
      return null;
    }
    
    this.currentModelIndex = this.currentModelIndex % availableModels.length;
    return availableModels[this.currentModelIndex];
  }
  
  private markModelFailure(model: string, isRateLimit: boolean) {
    const state = this.modelStates.get(model);
    if (!state) return;
    
    state.failures++;
    state.lastFailure = Date.now();
    
    if (isRateLimit || state.failures >= this.maxFailures) {
      state.blocked = true;
      state.blockedUntil = Date.now() + this.blockDurationMs;
      log.ai("Blocked model", { model, blockedUntil: new Date(state.blockedUntil).toISOString() });
    }
    
    this.currentModelIndex++;
  }
  
  private markModelSuccess(model: string) {
    const state = this.modelStates.get(model);
    if (state) {
      state.failures = 0;
    }
  }
  
  async chat(
    systemPrompt: string,
    userPrompt: string,
    options?: { maxRetries?: number }
  ): Promise<{ content: string; model: string }> {
    const client = this.getClient();
    if (!client) {
      throw new Error("OpenRouter API key not configured");
    }
    
    const maxRetries = options?.maxRetries ?? 5;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const model = this.selectModel();
      if (!model) {
        throw new Error("All OpenRouter models exhausted or rate limited");
      }
      
      try {
        log.ai("Trying model", { model, attempt: attempt + 1 });
        
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1024,
          temperature: 0.7,
        });
        
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from OpenRouter");
        }
        
        this.markModelSuccess(model);
        log.ai("Success with model", { model });
        
        return { content, model };
      } catch (error) {
        const errorMsg = (error as Error).message || String(error);
        const isRateLimit = 
          errorMsg.includes("429") ||
          errorMsg.includes("rate") ||
          errorMsg.includes("quota") ||
          errorMsg.includes("limit");
        
        log.ai("Model failed", { model, error: errorMsg });
        this.markModelFailure(model, isRateLimit);
        lastError = error as Error;
        
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    
    throw lastError || new Error("OpenRouter request failed after all retries");
  }
  
  getStatus(): { 
    available: boolean; 
    currentModel: string | null;
    usingPaidModels: boolean;
    blockedModels: string[];
  } {
    const blocked = [...this.modelStates.entries()]
      .filter(([_, state]) => state.blocked)
      .map(([model, _]) => model);
    
    return {
      available: this.isAvailable(),
      currentModel: this.selectModel(),
      usingPaidModels: this.usingPaidModels,
      blockedModels: blocked,
    };
  }
  
  resetModelStates() {
    this.initModels();
    this.currentModelIndex = 0;
    this.usingPaidModels = false;
    log.ai("Reset all model states");
  }
}

export const openRouterProvider = new OpenRouterProvider();
