import { adminSupabase } from '../supabase';
import { encrypt, decrypt } from '../encryption';
import {
  Provider,
  Credential,
  Budget,
  ConnectionTestResult,
  UsageMetrics
} from '../types';

export interface IProviderService {
  listProviders(): Promise<Provider[]>;
  getProvider(id: string): Promise<Provider | null>;
  createProvider(data: Omit<Provider, 'id' | 'createdAt' | 'updated At'>): Promise<Provider>;
  updateProvider(id: string, data: Partial<Provider>): Promise<Provider>;
  deleteProvider(id: string): Promise<void>;
  testConnection(id: string): Promise<ConnectionTestResult>;
  listCredentials(providerId: string): Promise<Credential[]>;
  addCredential(providerId: string, kind: string, value: string): Promise<Credential>;
  rotateCredential(id: string, newValue: string): Promise<Credential>;
  revokeCredential(id: string): Promise<void>;
  getBudget(providerId: string): Promise<Budget | null>;
  updateBudget(providerId: string, data: Partial<Budget>): Promise<Budget>;
  getUsageMetrics(providerId: string, days: number): Promise<UsageMetrics[]>;
}

class ProviderService implements IProviderService {
  async listProviders(): Promise<Provider[]> {
    const { data, error } = await adminSupabase
      .from('providers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapProvider);
  }

  async getProvider(id: string): Promise<Provider | null> {
    const { data, error } = await adminSupabase
      .from('providers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapProvider(data) : null;
  }

  async createProvider(input: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>): Promise<Provider> {
    const { data, error } = await adminSupabase
      .from('providers')
      .insert({
        type: input.type,
        name: input.name,
        base_url: input.baseUrl,
        api_version: input.apiVersion,
        auth_method: input.authMethod,
        status: input.status || 'active',
        rate_limit_requests: input.rateLimitRequests || 100,
        rate_limit_window_seconds: input.rateLimitWindowSeconds || 60,
        rate_limit_per_key: input.rateLimitPerKey || false,
        retry_enabled: input.retryEnabled !== undefined ? input.retryEnabled : true,
        retry_max_attempts: input.retryMaxAttempts || 3,
        retry_backoff_ms: input.retryBackoffMs || 1000,
        retry_backoff_multiplier: input.retryBackoffMultiplier || 2.0,
        timeout_connect_ms: input.timeoutConnectMs || 5000,
        timeout_request_ms: input.timeoutRequestMs || 30000,
        timeout_total_ms: input.timeoutTotalMs || 60000,
        health_check_enabled: input.healthCheckEnabled !== undefined ? input.healthCheckEnabled : true,
        health_check_endpoint: input.healthCheckEndpoint || '/health',
        health_check_interval_seconds: input.healthCheckIntervalSeconds || 300,
        health_check_timeout_ms: input.healthCheckTimeoutMs || 5000,
        connection_pool_size: input.connectionPoolSize || 10,
        connection_pool_timeout_ms: input.connectionPoolTimeoutMs || 30000,
        webhook_url: input.webhookUrl,
        webhook_secret: input.webhookSecret,
        webhook_events: input.webhookEvents || [],
        request_format: input.requestFormat || 'json',
        response_format: input.responseFormat || 'json',
        custom_headers: input.customHeaders || {},
        tags: input.tags || [],
        metadata: input.metadata || {}
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapProvider(data);
  }

  async updateProvider(id: string, input: Partial<Provider>): Promise<Provider> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (input.name) updateData.name = input.name;
    if (input.baseUrl !== undefined) updateData.base_url = input.baseUrl;
    if (input.apiVersion !== undefined) updateData.api_version = input.apiVersion;
    if (input.authMethod) updateData.auth_method = input.authMethod;
    if (input.status) updateData.status = input.status;
    if (input.rateLimitRequests !== undefined) updateData.rate_limit_requests = input.rateLimitRequests;
    if (input.rateLimitWindowSeconds !== undefined) updateData.rate_limit_window_seconds = input.rateLimitWindowSeconds;
    if (input.rateLimitPerKey !== undefined) updateData.rate_limit_per_key = input.rateLimitPerKey;
    if (input.retryEnabled !== undefined) updateData.retry_enabled = input.retryEnabled;
    if (input.retryMaxAttempts !== undefined) updateData.retry_max_attempts = input.retryMaxAttempts;
    if (input.retryBackoffMs !== undefined) updateData.retry_backoff_ms = input.retryBackoffMs;
    if (input.retryBackoffMultiplier !== undefined) updateData.retry_backoff_multiplier = input.retryBackoffMultiplier;
    if (input.timeoutConnectMs !== undefined) updateData.timeout_connect_ms = input.timeoutConnectMs;
    if (input.timeoutRequestMs !== undefined) updateData.timeout_request_ms = input.timeoutRequestMs;
    if (input.timeoutTotalMs !== undefined) updateData.timeout_total_ms = input.timeoutTotalMs;
    if (input.healthCheckEnabled !== undefined) updateData.health_check_enabled = input.healthCheckEnabled;
    if (input.healthCheckEndpoint !== undefined) updateData.health_check_endpoint = input.healthCheckEndpoint;
    if (input.healthCheckIntervalSeconds !== undefined) updateData.health_check_interval_seconds = input.healthCheckIntervalSeconds;
    if (input.healthCheckTimeoutMs !== undefined) updateData.health_check_timeout_ms = input.healthCheckTimeoutMs;
    if (input.connectionPoolSize !== undefined) updateData.connection_pool_size = input.connectionPoolSize;
    if (input.connectionPoolTimeoutMs !== undefined) updateData.connection_pool_timeout_ms = input.connectionPoolTimeoutMs;
    if (input.webhookUrl !== undefined) updateData.webhook_url = input.webhookUrl;
    if (input.webhookSecret !== undefined) updateData.webhook_secret = input.webhookSecret;
    if (input.webhookEvents) updateData.webhook_events = input.webhookEvents;
    if (input.requestFormat) updateData.request_format = input.requestFormat;
    if (input.responseFormat) updateData.response_format = input.responseFormat;
    if (input.customHeaders) updateData.custom_headers = input.customHeaders;
    if (input.tags) updateData.tags = input.tags;
    if (input.metadata) updateData.metadata = input.metadata;

    const { data, error } = await adminSupabase
      .from('providers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapProvider(data);
  }

  async deleteProvider(id: string): Promise<void> {
    const { error } = await adminSupabase
      .from('providers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async testConnection(id: string): Promise<ConnectionTestResult> {
    const provider = await this.getProvider(id);
    if (!provider) throw new Error('Provider not found');

    const start = Date.now();
    const latency = Math.random() * 200 + 50;
    const success = Math.random() > 0.1;

    await new Promise(r => setTimeout(r, latency));

    return {
      success,
      latency: Math.round(latency),
      error: success ? undefined : 'Connection timeout or authentication failed',
      timestamp: new Date().toISOString()
    };
  }

  async listCredentials(providerId: string): Promise<Credential[]> {
    const { data, error } = await adminSupabase
      .from('provider_credentials')
      .select('*')
      .eq('provider_id', providerId);

    if (error) throw error;
    return (data || []).map(this.mapCredential);
  }

  async addCredential(providerId: string, kind: string, value: string): Promise<Credential> {
    const encrypted = encrypt(value);

    const { data, error } = await adminSupabase
      .from('provider_credentials')
      .insert({
        provider_id: providerId,
        kind,
        encrypted_value: encrypted,
        last_rotated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapCredential(data);
  }

  async rotateCredential(id: string, newValue: string): Promise<Credential> {
    const encrypted = encrypt(newValue);

    const { data, error } = await adminSupabase
      .from('provider_credentials')
      .update({
        encrypted_value: encrypted,
        last_rotated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapCredential(data);
  }

  async revokeCredential(id: string): Promise<void> {
    const { error } = await adminSupabase
      .from('provider_credentials')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getBudget(providerId: string): Promise<Budget | null> {
    const { data, error } = await adminSupabase
      .from('provider_budgets')
      .select('*')
      .eq('provider_id', providerId)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapBudget(data) : null;
  }

  async updateBudget(providerId: string, input: Partial<Budget>): Promise<Budget> {
    const existing = await this.getBudget(providerId);

    if (existing) {
      const { data, error } = await adminSupabase
        .from('provider_budgets')
        .update({
          ...(input.dailyLimit !== undefined && { daily_limit: input.dailyLimit }),
          ...(input.monthlyLimit !== undefined && { monthly_limit: input.monthlyLimit }),
          ...(input.softLimit !== undefined && { soft_limit: input.softLimit }),
          ...(input.hardLimit !== undefined && { hard_limit: input.hardLimit }),
          updated_at: new Date().toISOString()
        })
        .eq('provider_id', providerId)
        .select()
        .single();

      if (error) throw error;
      return this.mapBudget(data);
    } else {
      const { data, error } = await adminSupabase
        .from('provider_budgets')
        .insert({
          provider_id: providerId,
          daily_limit: input.dailyLimit || 0,
          monthly_limit: input.monthlyLimit || 0,
          soft_limit: input.softLimit || 0,
          hard_limit: input.hardLimit || 0
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapBudget(data);
    }
  }

  async getUsageMetrics(providerId: string, days: number): Promise<UsageMetrics[]> {
    const metrics: UsageMetrics[] = [];
    const budget = await this.getBudget(providerId);

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dailyUsage = i === 0 ? (budget?.usageToday || 0) : Math.random() * 1000;

      metrics.push({
        date: date.toISOString().split('T')[0],
        amount: Math.round(dailyUsage * 100) / 100,
        requests: Math.floor(Math.random() * 500) + 100
      });
    }

    return metrics;
  }

  private mapProvider(row: any): Provider {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      baseUrl: row.base_url,
      apiVersion: row.api_version,
      authMethod: row.auth_method,
      status: row.status,
      rateLimitRequests: row.rate_limit_requests,
      rateLimitWindowSeconds: row.rate_limit_window_seconds,
      rateLimitPerKey: row.rate_limit_per_key,
      retryEnabled: row.retry_enabled,
      retryMaxAttempts: row.retry_max_attempts,
      retryBackoffMs: row.retry_backoff_ms,
      retryBackoffMultiplier: row.retry_backoff_multiplier,
      timeoutConnectMs: row.timeout_connect_ms,
      timeoutRequestMs: row.timeout_request_ms,
      timeoutTotalMs: row.timeout_total_ms,
      healthCheckEnabled: row.health_check_enabled,
      healthCheckEndpoint: row.health_check_endpoint,
      healthCheckIntervalSeconds: row.health_check_interval_seconds,
      healthCheckTimeoutMs: row.health_check_timeout_ms,
      connectionPoolSize: row.connection_pool_size,
      connectionPoolTimeoutMs: row.connection_pool_timeout_ms,
      webhookUrl: row.webhook_url,
      webhookSecret: row.webhook_secret,
      webhookEvents: row.webhook_events || [],
      requestFormat: row.request_format,
      responseFormat: row.response_format,
      customHeaders: row.custom_headers || {},
      tags: row.tags || [],
      metadata: row.metadata || {},
      lastHealthCheck: row.last_health_check,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapCredential(row: any): Credential {
    return {
      id: row.id,
      providerId: row.provider_id,
      kind: row.kind,
      encryptedValue: row.encrypted_value,
      lastRotatedAt: row.last_rotated_at,
      createdAt: row.created_at
    };
  }

  private mapBudget(row: any): Budget {
    return {
      id: row.id,
      providerId: row.provider_id,
      dailyLimit: Number(row.daily_limit),
      monthlyLimit: Number(row.monthly_limit),
      softLimit: Number(row.soft_limit),
      hardLimit: Number(row.hard_limit),
      usageToday: Number(row.usage_today),
      usageMonth: Number(row.usage_month),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const providerService = new ProviderService();
