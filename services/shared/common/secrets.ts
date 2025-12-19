/**
 * AI Active Trader - Secrets Management
 * Abstraction layer for secret storage (env vars, Vault, etc.)
 */

export interface SecretProvider {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
  isReady(): Promise<boolean>;
}

/**
 * Environment variable based secret provider
 * Default implementation for development and simple deployments
 */
export class EnvSecretProvider implements SecretProvider {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}_${key}` : key;
  }

  async get(key: string): Promise<string | undefined> {
    return process.env[this.getFullKey(key)];
  }

  async set(key: string, value: string): Promise<void> {
    process.env[this.getFullKey(key)] = value;
  }

  async delete(key: string): Promise<void> {
    delete process.env[this.getFullKey(key)];
  }

  async list(): Promise<string[]> {
    const keys = Object.keys(process.env);
    if (!this.prefix) return keys;
    return keys
      .filter(k => k.startsWith(this.prefix))
      .map(k => k.substring(this.prefix.length + 1));
  }

  async isReady(): Promise<boolean> {
    return true;
  }
}

export interface VaultConfig {
  vaultUrl: string;
  token?: string;
  mountPath?: string;
  kubernetesRole?: string;
  serviceAccountPath?: string;
  namespace?: string;
  renewInterval?: number;
}

interface VaultKVResponse {
  data: {
    data: Record<string, string>;
    metadata?: {
      version: number;
      created_time: string;
    };
  };
}

interface VaultLoginResponse {
  auth: {
    client_token: string;
    lease_duration: number;
    renewable: boolean;
  };
}

/**
 * HashiCorp Vault secret provider with Kubernetes auth support
 * Supports both direct token auth and Kubernetes ServiceAccount auth
 */
export class VaultSecretProvider implements SecretProvider {
  private vaultUrl: string;
  private token: string | null = null;
  private mountPath: string;
  private kubernetesRole: string | null;
  private serviceAccountPath: string;
  private namespace: string;
  private renewInterval: number;
  private tokenExpiresAt: number = 0;
  private renewTimer: ReturnType<typeof setTimeout> | null = null;
  private secretCache: Map<string, { data: Record<string, string>; fetchedAt: number }> = new Map();
  private cacheTtl: number = 60000;

  constructor(config: VaultConfig) {
    this.vaultUrl = config.vaultUrl.replace(/\/$/, '');
    this.token = config.token || null;
    this.mountPath = config.mountPath || 'secret';
    this.kubernetesRole = config.kubernetesRole || null;
    this.serviceAccountPath = config.serviceAccountPath || '/var/run/secrets/kubernetes.io/serviceaccount/token';
    this.namespace = config.namespace || 'ai-trader';
    this.renewInterval = config.renewInterval || 1800000;
  }

  private async authenticateKubernetes(): Promise<string> {
    const fs = await import('fs');
    let jwt: string;

    try {
      jwt = fs.readFileSync(this.serviceAccountPath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read ServiceAccount token from ${this.serviceAccountPath}: ${error}`);
    }

    const response = await fetch(`${this.vaultUrl}/v1/auth/kubernetes/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: this.kubernetesRole,
        jwt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vault Kubernetes auth failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as VaultLoginResponse;
    this.tokenExpiresAt = Date.now() + (data.auth.lease_duration * 1000);

    if (data.auth.renewable) {
      this.scheduleTokenRenewal(data.auth.lease_duration * 1000);
    }

    return data.auth.client_token;
  }

  private scheduleTokenRenewal(leaseDuration: number): void {
    if (this.renewTimer) {
      clearTimeout(this.renewTimer);
    }

    const renewIn = Math.max(leaseDuration * 0.7, 60000);
    this.renewTimer = setTimeout(async () => {
      try {
        await this.renewToken();
      } catch (error) {
        console.error('[Vault] Token renewal failed, re-authenticating:', error);
        try {
          this.token = await this.authenticateKubernetes();
        } catch (authError) {
          console.error('[Vault] Re-authentication failed:', authError);
        }
      }
    }, renewIn);
  }

  private async renewToken(): Promise<void> {
    if (!this.token) return;

    const response = await fetch(`${this.vaultUrl}/v1/auth/token/renew-self`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Token': this.token,
      },
    });

    if (!response.ok) {
      throw new Error(`Token renewal failed: ${response.status}`);
    }

    const data = (await response.json()) as VaultLoginResponse;
    this.tokenExpiresAt = Date.now() + (data.auth.lease_duration * 1000);
    this.scheduleTokenRenewal(data.auth.lease_duration * 1000);
  }

  private async getToken(): Promise<string> {
    if (this.token && this.tokenExpiresAt > Date.now()) {
      return this.token;
    }

    if (this.kubernetesRole) {
      this.token = await this.authenticateKubernetes();
      return this.token;
    }

    if (this.token) {
      return this.token;
    }

    throw new Error('No valid Vault authentication method available');
  }

  async get(key: string): Promise<string | undefined> {
    const [secretPath, secretKey] = this.parseKey(key);
    const cacheKey = secretPath;
    const cached = this.secretCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtl) {
      return cached.data[secretKey];
    }

    const token = await this.getToken();
    const response = await fetch(`${this.vaultUrl}/v1/${this.mountPath}/data/${secretPath}`, {
      headers: { 'X-Vault-Token': token },
    });

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vault read failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as VaultKVResponse;
    this.secretCache.set(cacheKey, {
      data: data.data.data,
      fetchedAt: Date.now(),
    });

    return data.data.data[secretKey];
  }

  async set(key: string, value: string): Promise<void> {
    const [secretPath, secretKey] = this.parseKey(key);
    let existingData: Record<string, string> = {};

    try {
      const token = await this.getToken();
      const readResponse = await fetch(`${this.vaultUrl}/v1/${this.mountPath}/data/${secretPath}`, {
        headers: { 'X-Vault-Token': token },
      });

      if (readResponse.ok) {
        const existing = (await readResponse.json()) as VaultKVResponse;
        existingData = existing.data.data;
      }
    } catch (e) {
    }

    existingData[secretKey] = value;

    const token = await this.getToken();
    const response = await fetch(`${this.vaultUrl}/v1/${this.mountPath}/data/${secretPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Token': token,
      },
      body: JSON.stringify({ data: existingData }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vault write failed: ${response.status} - ${errorText}`);
    }

    this.secretCache.delete(secretPath);
  }

  async delete(key: string): Promise<void> {
    const [secretPath] = this.parseKey(key);
    const token = await this.getToken();

    const response = await fetch(`${this.vaultUrl}/v1/${this.mountPath}/data/${secretPath}`, {
      method: 'DELETE',
      headers: { 'X-Vault-Token': token },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`Vault delete failed: ${response.status} - ${errorText}`);
    }

    this.secretCache.delete(secretPath);
  }

  async list(): Promise<string[]> {
    const token = await this.getToken();
    const response = await fetch(`${this.vaultUrl}/v1/${this.mountPath}/metadata/${this.namespace}?list=true`, {
      headers: { 'X-Vault-Token': token },
    });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vault list failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { data: { keys: string[] } };
    return data.data.keys || [];
  }

  async isReady(): Promise<boolean> {
    try {
      await this.getToken();
      const response = await fetch(`${this.vaultUrl}/v1/sys/health`, {
        headers: this.token ? { 'X-Vault-Token': this.token } : {},
      });
      return response.ok || response.status === 429;
    } catch {
      return false;
    }
  }

  private parseKey(key: string): [string, string] {
    const parts = key.split('/');
    if (parts.length === 1) {
      return [this.namespace, key];
    }
    const secretKey = parts.pop()!;
    return [parts.join('/'), secretKey];
  }

  destroy(): void {
    if (this.renewTimer) {
      clearTimeout(this.renewTimer);
      this.renewTimer = null;
    }
    this.secretCache.clear();
  }
}

/**
 * File-based secret provider for Vault Agent sidecar injected secrets
 * Reads secrets from files mounted by Vault Agent Injector
 */
export class VaultAgentSecretProvider implements SecretProvider {
  private basePath: string;
  private cache: Map<string, { value: string; mtime: number }> = new Map();

  constructor(basePath: string = '/vault/secrets') {
    this.basePath = basePath;
  }

  async get(key: string): Promise<string | undefined> {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(this.basePath, key);

    try {
      const stats = fs.statSync(filePath);
      const cached = this.cache.get(key);

      if (cached && cached.mtime === stats.mtimeMs) {
        return cached.value;
      }

      const value = fs.readFileSync(filePath, 'utf8').trim();
      this.cache.set(key, { value, mtime: stats.mtimeMs });
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  async set(_key: string, _value: string): Promise<void> {
    throw new Error('VaultAgentSecretProvider is read-only');
  }

  async delete(_key: string): Promise<void> {
    throw new Error('VaultAgentSecretProvider is read-only');
  }

  async list(): Promise<string[]> {
    const fs = await import('fs');

    try {
      return fs.readdirSync(this.basePath);
    } catch {
      return [];
    }
  }

  async isReady(): Promise<boolean> {
    const fs = await import('fs');
    try {
      fs.accessSync(this.basePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Secret manager that handles provider selection and caching
 */
export class SecretManager {
  private provider: SecretProvider;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTtl: number;

  constructor(provider?: SecretProvider, cacheTtl: number = 300000) {
    this.provider = provider || this.createDefaultProvider();
    this.cacheTtl = cacheTtl;
  }

  private createDefaultProvider(): SecretProvider {
    const vaultSecretsPath = process.env.VAULT_SECRETS_PATH || '/vault/secrets';
    const fs = require('fs');

    try {
      fs.accessSync(vaultSecretsPath);
      console.log('[Secrets] Using VaultAgentSecretProvider from:', vaultSecretsPath);
      return new VaultAgentSecretProvider(vaultSecretsPath);
    } catch {
    }

    const vaultUrl = process.env.VAULT_ADDR || process.env.VAULT_URL;
    const vaultToken = process.env.VAULT_TOKEN;
    const kubernetesRole = process.env.VAULT_ROLE || 'ai-trader';

    if (vaultUrl) {
      console.log('[Secrets] Using VaultSecretProvider with URL:', vaultUrl);
      return new VaultSecretProvider({
        vaultUrl,
        token: vaultToken,
        kubernetesRole: vaultToken ? undefined : kubernetesRole,
        namespace: process.env.VAULT_NAMESPACE || 'ai-trader',
      });
    }

    console.log('[Secrets] Using EnvSecretProvider');
    return new EnvSecretProvider();
  }

  async get(key: string): Promise<string | undefined> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = await this.provider.get(key);
    if (value) {
      this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtl });
    }
    return value;
  }

  async getRequired(key: string): Promise<string> {
    const value = await this.get(key);
    if (!value) {
      throw new Error(`Required secret not found: ${key}`);
    }
    return value;
  }

  async getWithFallback(key: string, fallback: string): Promise<string> {
    const value = await this.get(key);
    return value || fallback;
  }

  async set(key: string, value: string): Promise<void> {
    await this.provider.set(key, value);
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtl });
  }

  async delete(key: string): Promise<void> {
    await this.provider.delete(key);
    this.cache.delete(key);
  }

  async isReady(): Promise<boolean> {
    return this.provider.isReady();
  }

  clearCache(): void {
    this.cache.clear();
  }

  getProvider(): SecretProvider {
    return this.provider;
  }
}

let defaultSecretManager: SecretManager | null = null;

export function getSecretManager(): SecretManager {
  if (!defaultSecretManager) {
    defaultSecretManager = new SecretManager();
  }
  return defaultSecretManager;
}

export function createSecretManager(provider?: SecretProvider): SecretManager {
  return new SecretManager(provider);
}

export function resetSecretManager(): void {
  if (defaultSecretManager) {
    const provider = defaultSecretManager.getProvider();
    if (provider instanceof VaultSecretProvider) {
      provider.destroy();
    }
  }
  defaultSecretManager = null;
}
