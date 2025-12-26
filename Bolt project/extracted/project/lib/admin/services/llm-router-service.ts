import { adminSupabase } from '../supabase';
import { LlmModel, LlmRouteRule, LlmRoutingDecision } from '../types';

export interface ILlmRouterService {
  listModels(): Promise<LlmModel[]>;
  createModel(data: Omit<LlmModel, 'id' | 'createdAt'>): Promise<LlmModel>;
  updateModel(id: string, data: Partial<LlmModel>): Promise<LlmModel>;
  deleteModel(id: string): Promise<void>;
  listRules(): Promise<LlmRouteRule[]>;
  createRule(data: Omit<LlmRouteRule, 'id' | 'createdAt'>): Promise<LlmRouteRule>;
  updateRule(id: string, data: Partial<LlmRouteRule>): Promise<LlmRouteRule>;
  deleteRule(id: string): Promise<void>;
  dryRunRouting(taskType: string, promptLength: number, tier?: string): Promise<LlmRoutingDecision>;
}

class LlmRouterService implements ILlmRouterService {
  async listModels(): Promise<LlmModel[]> {
    const { data, error } = await adminSupabase
      .from('admin_llm_models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapModel);
  }

  async createModel(input: Omit<LlmModel, 'id' | 'createdAt'>): Promise<LlmModel> {
    const { data, error } = await adminSupabase
      .from('admin_llm_models')
      .insert({
        provider_id: input.providerId,
        model_name: input.modelName,
        context_window: input.contextWindow,
        cost_input: input.costInput,
        cost_output: input.costOutput,
        enabled: input.enabled,
        metadata: input.metadata
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapModel(data);
  }

  async updateModel(id: string, input: Partial<LlmModel>): Promise<LlmModel> {
    const { data, error } = await adminSupabase
      .from('admin_llm_models')
      .update({
        ...(input.contextWindow && { context_window: input.contextWindow }),
        ...(input.costInput !== undefined && { cost_input: input.costInput }),
        ...(input.costOutput !== undefined && { cost_output: input.costOutput }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.metadata && { metadata: input.metadata })
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapModel(data);
  }

  async deleteModel(id: string): Promise<void> {
    const { error } = await adminSupabase
      .from('admin_llm_models')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async listRules(): Promise<LlmRouteRule[]> {
    const { data, error } = await adminSupabase
      .from('admin_llm_route_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapRule);
  }

  async createRule(input: Omit<LlmRouteRule, 'id' | 'createdAt'>): Promise<LlmRouteRule> {
    const { data, error } = await adminSupabase
      .from('admin_llm_route_rules')
      .insert({
        name: input.name,
        match_conditions: input.matchConditions,
        preferred_models: input.preferredModels,
        fallback_models: input.fallbackModels,
        max_cost_per_req: input.maxCostPerReq,
        timeout_ms: input.timeoutMs,
        enabled: input.enabled,
        priority: input.priority
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapRule(data);
  }

  async updateRule(id: string, input: Partial<LlmRouteRule>): Promise<LlmRouteRule> {
    const { data, error } = await adminSupabase
      .from('admin_llm_route_rules')
      .update({
        ...(input.name && { name: input.name }),
        ...(input.matchConditions && { match_conditions: input.matchConditions }),
        ...(input.preferredModels && { preferred_models: input.preferredModels }),
        ...(input.fallbackModels && { fallback_models: input.fallbackModels }),
        ...(input.maxCostPerReq !== undefined && { max_cost_per_req: input.maxCostPerReq }),
        ...(input.timeoutMs && { timeout_ms: input.timeoutMs }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.priority !== undefined && { priority: input.priority })
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapRule(data);
  }

  async deleteRule(id: string): Promise<void> {
    const { error } = await adminSupabase
      .from('admin_llm_route_rules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async dryRunRouting(taskType: string, promptLength: number, tier?: string): Promise<LlmRoutingDecision> {
    const rules = await this.listRules();
    const models = await this.listModels();
    const enabledModels = models.filter(m => m.enabled);

    let matchedRule: LlmRouteRule | undefined;
    for (const rule of rules.filter(r => r.enabled)) {
      const conditions = rule.matchConditions as any;
      if (conditions.taskType === taskType || conditions.taskType === '*') {
        if (!tier || conditions.tier === tier || conditions.tier === '*') {
          matchedRule = rule;
          break;
        }
      }
    }

    let selectedModel: LlmModel;
    let reason: string;

    if (matchedRule && matchedRule.preferredModels.length > 0) {
      const preferred = enabledModels.find(m => matchedRule!.preferredModels.includes(m.id));
      if (preferred && preferred.contextWindow >= promptLength) {
        selectedModel = preferred;
        reason = `Matched rule "${matchedRule.name}" - using preferred model`;
      } else {
        const fallback = enabledModels.find(m => matchedRule!.fallbackModels.includes(m.id) && m.contextWindow >= promptLength);
        if (fallback) {
          selectedModel = fallback;
          reason = `Preferred model unavailable, using fallback from rule "${matchedRule.name}"`;
        } else {
          selectedModel = enabledModels.sort((a, b) => a.costInput - b.costInput)[0];
          reason = `No suitable model in rule, defaulting to lowest cost model`;
        }
      }
    } else {
      selectedModel = enabledModels.sort((a, b) => a.costInput - b.costInput)[0];
      reason = 'No matching rules, using default (lowest cost) model';
    }

    const estimatedCost = (promptLength / 1000) * selectedModel.costInput + (promptLength * 0.5 / 1000) * selectedModel.costOutput;
    const fallbacks = enabledModels
      .filter(m => m.id !== selectedModel.id && m.contextWindow >= promptLength)
      .slice(0, 2);

    return {
      selectedModel,
      reason,
      matchedRule,
      estimatedCost: Math.round(estimatedCost * 100000) / 100000,
      fallbacksAvailable: fallbacks
    };
  }

  private mapModel(row: any): LlmModel {
    return {
      id: row.id,
      providerId: row.provider_id,
      modelName: row.model_name,
      contextWindow: row.context_window,
      costInput: Number(row.cost_input),
      costOutput: Number(row.cost_output),
      enabled: row.enabled,
      metadata: row.metadata || {},
      createdAt: row.created_at
    };
  }

  private mapRule(row: any): LlmRouteRule {
    return {
      id: row.id,
      name: row.name,
      matchConditions: row.match_conditions || {},
      preferredModels: row.preferred_models || [],
      fallbackModels: row.fallback_models || [],
      maxCostPerReq: row.max_cost_per_req ? Number(row.max_cost_per_req) : undefined,
      timeoutMs: row.timeout_ms,
      enabled: row.enabled,
      priority: row.priority,
      createdAt: row.created_at
    };
  }
}

export const llmRouterService = new LlmRouterService();
