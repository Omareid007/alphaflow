/**
 * AI Active Trader - Tenant Manager
 * SaaS multi-tenancy with JWT-based authentication, namespace isolation,
 * rate limiting, usage metering, and API key management.
 */

import { createLogger } from '../shared/common';

const logger = createLogger('tenant-manager');

export interface Tenant {
  id: string;
  name: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface TenantLimits {
  requestsPerMinute: number;
  requestsPerDay: number;
  maxStrategies: number;
  maxPositions: number;
  maxApiKeys: number;
  dataRetentionDays: number;
  realtimeStreaming: boolean;
  customIntegrations: boolean;
}

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;
  prefix: string;
  permissions: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  status: 'active' | 'revoked';
}

export interface UsageRecord {
  tenantId: string;
  period: string;
  requestCount: number;
  aiTokensUsed: number;
  tradesExecuted: number;
  dataPointsFetched: number;
  storageUsedMB: number;
  lastUpdated: Date;
}

export interface TenantContext {
  tenantId: string;
  userId?: string;
  permissions: string[];
  limits: TenantLimits;
  apiKeyId?: string;
}

const PLAN_LIMITS: Record<Tenant['plan'], TenantLimits> = {
  free: {
    requestsPerMinute: 10,
    requestsPerDay: 500,
    maxStrategies: 1,
    maxPositions: 5,
    maxApiKeys: 1,
    dataRetentionDays: 7,
    realtimeStreaming: false,
    customIntegrations: false,
  },
  starter: {
    requestsPerMinute: 60,
    requestsPerDay: 5000,
    maxStrategies: 5,
    maxPositions: 20,
    maxApiKeys: 3,
    dataRetentionDays: 30,
    realtimeStreaming: true,
    customIntegrations: false,
  },
  pro: {
    requestsPerMinute: 300,
    requestsPerDay: 50000,
    maxStrategies: 25,
    maxPositions: 100,
    maxApiKeys: 10,
    dataRetentionDays: 365,
    realtimeStreaming: true,
    customIntegrations: true,
  },
  enterprise: {
    requestsPerMinute: 1000,
    requestsPerDay: 500000,
    maxStrategies: -1,
    maxPositions: -1,
    maxApiKeys: -1,
    dataRetentionDays: -1,
    realtimeStreaming: true,
    customIntegrations: true,
  },
};

export class TenantManager {
  private static instance: TenantManager;
  
  private tenants: Map<string, Tenant> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private apiKeysByPrefix: Map<string, ApiKey> = new Map();
  private usage: Map<string, UsageRecord> = new Map();
  private rateLimitBuckets: Map<string, { count: number; resetAt: number }> = new Map();
  private jwtSecret: string;

  private constructor() {
    this.jwtSecret = process.env.SESSION_SECRET || '';
    if (!this.jwtSecret) {
      logger.warn('SESSION_SECRET not configured - JWT authentication will fail');
    }
  }

  static getInstance(): TenantManager {
    if (!TenantManager.instance) {
      TenantManager.instance = new TenantManager();
    }
    return TenantManager.instance;
  }

  async createTenant(data: {
    id: string;
    name: string;
    plan?: Tenant['plan'];
    metadata?: Record<string, unknown>;
  }): Promise<Tenant> {
    if (this.tenants.has(data.id)) {
      throw new Error(`Tenant ${data.id} already exists`);
    }

    const tenant: Tenant = {
      id: data.id,
      name: data.name,
      plan: data.plan || 'free',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: data.metadata || {},
    };

    this.tenants.set(tenant.id, tenant);
    
    this.usage.set(this.getUsageKey(tenant.id), {
      tenantId: tenant.id,
      period: this.getCurrentPeriod(),
      requestCount: 0,
      aiTokensUsed: 0,
      tradesExecuted: 0,
      dataPointsFetched: 0,
      storageUsedMB: 0,
      lastUpdated: new Date(),
    });

    logger.info('Tenant created', { tenantId: tenant.id, plan: tenant.plan });
    return tenant;
  }

  getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  async updateTenant(tenantId: string, updates: Partial<Omit<Tenant, 'id' | 'createdAt'>>): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    Object.assign(tenant, updates, { updatedAt: new Date() });
    this.tenants.set(tenantId, tenant);
    
    logger.info('Tenant updated', { tenantId, updates: Object.keys(updates) });
    return tenant;
  }

  async suspendTenant(tenantId: string, reason: string): Promise<void> {
    await this.updateTenant(tenantId, { 
      status: 'suspended',
      metadata: { suspendReason: reason, suspendedAt: new Date() },
    });
    logger.warn('Tenant suspended', { tenantId, reason });
  }

  getTenantLimits(tenantId: string): TenantLimits {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return PLAN_LIMITS.free;
    }
    return PLAN_LIMITS[tenant.plan];
  }

  async createApiKey(tenantId: string, data: {
    name: string;
    permissions?: string[];
    expiresInDays?: number;
  }): Promise<{ apiKey: string; keyData: ApiKey }> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const limits = this.getTenantLimits(tenantId);
    const existingKeys = Array.from(this.apiKeys.values())
      .filter(k => k.tenantId === tenantId && k.status === 'active');
    
    if (limits.maxApiKeys > 0 && existingKeys.length >= limits.maxApiKeys) {
      throw new Error(`API key limit reached (${limits.maxApiKeys})`);
    }

    const prefix = `at_${this.generateRandomString(8)}`;
    const secret = this.generateRandomString(32);
    const fullKey = `${prefix}_${secret}`;
    const keyHash = await this.hashApiKey(fullKey);

    const apiKey: ApiKey = {
      id: `key_${Date.now()}_${this.generateRandomString(6)}`,
      tenantId,
      name: data.name,
      keyHash,
      prefix,
      permissions: data.permissions || ['read', 'write'],
      createdAt: new Date(),
      lastUsedAt: null,
      expiresAt: data.expiresInDays 
        ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
        : null,
      status: 'active',
    };

    this.apiKeys.set(apiKey.id, apiKey);
    this.apiKeysByPrefix.set(prefix, apiKey);

    logger.info('API key created', { tenantId, keyId: apiKey.id, prefix });
    return { apiKey: fullKey, keyData: apiKey };
  }

  async validateApiKey(apiKeyString: string): Promise<TenantContext | null> {
    const parts = apiKeyString.split('_');
    if (parts.length < 3 || parts[0] !== 'at') {
      return null;
    }

    const prefix = `${parts[0]}_${parts[1]}`;
    const apiKey = this.apiKeysByPrefix.get(prefix);
    
    if (!apiKey || apiKey.status !== 'active') {
      return null;
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    const keyHash = await this.hashApiKey(apiKeyString);
    if (keyHash !== apiKey.keyHash) {
      return null;
    }

    const tenant = this.tenants.get(apiKey.tenantId);
    if (!tenant || tenant.status !== 'active') {
      return null;
    }

    apiKey.lastUsedAt = new Date();

    return {
      tenantId: apiKey.tenantId,
      permissions: apiKey.permissions,
      limits: this.getTenantLimits(apiKey.tenantId),
      apiKeyId: apiKey.id,
    };
  }

  async revokeApiKey(keyId: string): Promise<void> {
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) {
      throw new Error(`API key ${keyId} not found`);
    }

    apiKey.status = 'revoked';
    this.apiKeysByPrefix.delete(apiKey.prefix);
    
    logger.info('API key revoked', { keyId, tenantId: apiKey.tenantId });
  }

  listApiKeys(tenantId: string): ApiKey[] {
    return Array.from(this.apiKeys.values())
      .filter(k => k.tenantId === tenantId)
      .map(k => ({ ...k, keyHash: '***' }));
  }

  async checkRateLimit(tenantId: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const limits = this.getTenantLimits(tenantId);
    const bucketKey = `${tenantId}:minute`;
    const now = Date.now();
    
    let bucket = this.rateLimitBuckets.get(bucketKey);
    
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + 60000 };
    }

    if (bucket.count >= limits.requestsPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(bucket.resetAt),
      };
    }

    bucket.count++;
    this.rateLimitBuckets.set(bucketKey, bucket);

    return {
      allowed: true,
      remaining: limits.requestsPerMinute - bucket.count,
      resetAt: new Date(bucket.resetAt),
    };
  }

  async recordUsage(tenantId: string, metrics: Partial<Omit<UsageRecord, 'tenantId' | 'period' | 'lastUpdated'>>): Promise<void> {
    const key = this.getUsageKey(tenantId);
    let usage = this.usage.get(key);
    
    if (!usage || usage.period !== this.getCurrentPeriod()) {
      usage = {
        tenantId,
        period: this.getCurrentPeriod(),
        requestCount: 0,
        aiTokensUsed: 0,
        tradesExecuted: 0,
        dataPointsFetched: 0,
        storageUsedMB: 0,
        lastUpdated: new Date(),
      };
    }

    if (metrics.requestCount) usage.requestCount += metrics.requestCount;
    if (metrics.aiTokensUsed) usage.aiTokensUsed += metrics.aiTokensUsed;
    if (metrics.tradesExecuted) usage.tradesExecuted += metrics.tradesExecuted;
    if (metrics.dataPointsFetched) usage.dataPointsFetched += metrics.dataPointsFetched;
    if (metrics.storageUsedMB) usage.storageUsedMB = metrics.storageUsedMB;
    
    usage.lastUpdated = new Date();
    this.usage.set(key, usage);
  }

  getUsage(tenantId: string, period?: string): UsageRecord | undefined {
    const key = this.getUsageKey(tenantId, period);
    return this.usage.get(key);
  }

  getNamespace(tenantId: string): string {
    return `tenant_${tenantId}`;
  }

  getDatabaseSchema(tenantId: string): string {
    return `t_${tenantId.replace(/-/g, '_')}`;
  }

  getStreamPrefix(tenantId: string): string {
    return `AT.${tenantId}`;
  }

  createJWT(tenantId: string, userId?: string, expiresInHours = 24): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: userId || tenantId,
      tid: tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresInHours * 3600,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.createSignature(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyJWT(token: string): TenantContext | null {
    if (!this.jwtSecret) {
      logger.error('Cannot verify JWT: SESSION_SECRET not configured');
      return null;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, signature] = parts;
      const expectedSignature = this.createSignature(`${encodedHeader}.${encodedPayload}`);
      
      if (signature !== expectedSignature) {
        logger.debug('JWT signature mismatch');
        return null;
      }

      const payload = JSON.parse(this.base64UrlDecode(encodedPayload));
      
      if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
        logger.debug('JWT expired or missing expiration');
        return null;
      }

      if (!payload.tid) {
        logger.debug('JWT missing tenant ID');
        return null;
      }

      const tenant = this.tenants.get(payload.tid);
      if (!tenant || tenant.status !== 'active') {
        return null;
      }

      return {
        tenantId: payload.tid,
        userId: payload.sub !== payload.tid ? payload.sub : undefined,
        permissions: ['read', 'write'],
        limits: this.getTenantLimits(payload.tid),
      };
    } catch (error) {
      logger.debug('JWT verification failed', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  listTenants(filters?: { plan?: Tenant['plan']; status?: Tenant['status'] }): Tenant[] {
    let tenants = Array.from(this.tenants.values());
    
    if (filters?.plan) {
      tenants = tenants.filter(t => t.plan === filters.plan);
    }
    if (filters?.status) {
      tenants = tenants.filter(t => t.status === filters.status);
    }
    
    return tenants;
  }

  getStats(): {
    totalTenants: number;
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
    totalApiKeys: number;
  } {
    const tenants = Array.from(this.tenants.values());
    
    return {
      totalTenants: tenants.length,
      byPlan: tenants.reduce((acc, t) => {
        acc[t.plan] = (acc[t.plan] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byStatus: tenants.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalApiKeys: this.apiKeys.size,
    };
  }

  private getUsageKey(tenantId: string, period?: string): string {
    return `${tenantId}:${period || this.getCurrentPeriod()}`;
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async hashApiKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key + this.jwtSecret);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str).toString('base64url');
  }

  private base64UrlDecode(str: string): string {
    return Buffer.from(str, 'base64url').toString();
  }

  private createSignature(data: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data + this.jwtSecret);
    let hash = 0;
    for (let i = 0; i < bytes.length; i++) {
      hash = ((hash << 5) - hash) + bytes[i];
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

export function getTenantManager(): TenantManager {
  return TenantManager.getInstance();
}

export function createTenantMiddleware() {
  return async (req: { headers: Record<string, string | undefined>; tenantContext?: TenantContext }, res: { status: (code: number) => { json: (data: unknown) => void } }, next: () => void) => {
    const manager = TenantManager.getInstance();
    
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    let context: TenantContext | null = null;

    if (apiKey) {
      context = await manager.validateApiKey(apiKey);
    } else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      context = manager.verifyJWT(token);
    }

    if (!context) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rateLimit = await manager.checkRateLimit(context.tenantId);
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
      });
    }

    await manager.recordUsage(context.tenantId, { requestCount: 1 });

    req.tenantContext = context;
    next();
  };
}
