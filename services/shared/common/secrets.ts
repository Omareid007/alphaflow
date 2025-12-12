/**
 * AI Active Trader - Secrets Management
 * Abstraction layer for secret storage (env vars, Vault, etc.)
 */

export interface SecretProvider {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
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
}

/**
 * Vault secret provider (stub for future implementation)
 */
export class VaultSecretProvider implements SecretProvider {
  private vaultUrl: string;
  private token: string;
  private mountPath: string;

  constructor(config: { vaultUrl: string; token: string; mountPath?: string }) {
    this.vaultUrl = config.vaultUrl;
    this.token = config.token;
    this.mountPath = config.mountPath || 'secret';
    console.warn('[Secrets] VaultSecretProvider is a stub - using env vars as fallback');
  }

  async get(key: string): Promise<string | undefined> {
    console.warn(`[Secrets] Vault get(${key}) - stub implementation using env`);
    return process.env[key];
  }

  async set(key: string, value: string): Promise<void> {
    console.warn(`[Secrets] Vault set(${key}) - stub implementation`);
  }

  async delete(key: string): Promise<void> {
    console.warn(`[Secrets] Vault delete(${key}) - stub implementation`);
  }

  async list(): Promise<string[]> {
    console.warn('[Secrets] Vault list() - stub implementation');
    return [];
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
    const vaultUrl = process.env.VAULT_URL;
    const vaultToken = process.env.VAULT_TOKEN;

    if (vaultUrl && vaultToken) {
      return new VaultSecretProvider({ vaultUrl, token: vaultToken });
    }

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

  async set(key: string, value: string): Promise<void> {
    await this.provider.set(key, value);
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtl });
  }

  async delete(key: string): Promise<void> {
    await this.provider.delete(key);
    this.cache.delete(key);
  }

  clearCache(): void {
    this.cache.clear();
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
