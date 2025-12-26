export interface AdminUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export type ProviderType = 'data' | 'llm' | 'broker' | 'news' | 'sentiment' | 'analytics' | 'other';
export type ProviderStatus = 'active' | 'inactive' | 'error' | 'maintenance';
export type AuthMethod = 'header' | 'query' | 'body' | 'oauth2' | 'basic' | 'bearer';

export interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  baseUrl?: string;
  apiVersion?: string;
  authMethod?: AuthMethod;
  status: ProviderStatus;
  rateLimitRequests?: number;
  rateLimitWindowSeconds?: number;
  rateLimitPerKey?: boolean;
  retryEnabled?: boolean;
  retryMaxAttempts?: number;
  retryBackoffMs?: number;
  retryBackoffMultiplier?: number;
  timeoutConnectMs?: number;
  timeoutRequestMs?: number;
  timeoutTotalMs?: number;
  healthCheckEnabled?: boolean;
  healthCheckEndpoint?: string;
  healthCheckIntervalSeconds?: number;
  healthCheckTimeoutMs?: number;
  connectionPoolSize?: number;
  connectionPoolTimeoutMs?: number;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEvents?: string[];
  requestFormat?: string;
  responseFormat?: string;
  customHeaders?: Record<string, unknown>;
  tags: string[];
  metadata: Record<string, unknown>;
  lastHealthCheck?: string;
  createdAt: string;
  updatedAt: string;
}

export type CredentialKind = 'apiKey' | 'oauth' | 'token' | 'certificate';

export interface Credential {
  id: string;
  providerId: string;
  kind: CredentialKind;
  encryptedValue: string;
  lastRotatedAt: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  providerId: string;
  dailyLimit: number;
  monthlyLimit: number;
  softLimit: number;
  hardLimit: number;
  usageToday: number;
  usageMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface LlmModel {
  id: string;
  providerId: string;
  modelName: string;
  contextWindow: number;
  costInput: number;
  costOutput: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LlmRouteRule {
  id: string;
  name: string;
  matchConditions: Record<string, unknown>;
  preferredModels: string[];
  fallbackModels: string[];
  maxCostPerReq?: number;
  timeoutMs: number;
  enabled: boolean;
  priority: number;
  createdAt: string;
}

export interface OrchestratorConfig {
  id: string;
  mode: 'paper' | 'live';
  enabledAgents: string[];
  agentParams: Record<string, unknown>;
  schedules: Array<{ name: string; cron: string; enabled: boolean }>;
  killSwitch: boolean;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobRun {
  id: string;
  jobType: string;
  status: JobStatus;
  startedAt: string;
  finishedAt?: string;
  logsRef?: string;
  metrics: Record<string, unknown>;
  error?: string;
}

export interface RiskRule {
  id: string;
  scope: 'portfolio' | 'strategy' | 'order';
  ruleType: string;
  params: Record<string, unknown>;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  createdAt: string;
}

export interface AllocationPolicy {
  id: string;
  name: string;
  constraints: Record<string, unknown>;
  defaults: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface RebalancePolicy {
  id: string;
  name: string;
  cadence: string;
  thresholds: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface Symbol {
  id: string;
  ticker: string;
  exchange: string;
  assetType: string;
  isEligible: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface UniverseList {
  id: string;
  name: string;
  symbols: string[];
  rules: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FundamentalFactor {
  id: string;
  name: string;
  source: string;
  refreshCadence: string;
  formula: Record<string, unknown>;
  enabled: boolean;
  lastRefresh?: string;
  createdAt: string;
}

export interface Candidate {
  id: string;
  symbolId: string;
  score: number;
  rationale?: string;
  asOf: string;
  sourceRunId?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  externalId?: string;
  strategyId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPosition {
  id: string;
  strategyId?: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice?: number;
  unrealizedPnl: number;
  payload: Record<string, unknown>;
  updatedAt: string;
}

export interface StrategyAdminMeta {
  id: string;
  strategyId: string;
  flags: Record<string, unknown>;
  overrideStatus?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  diff: Record<string, unknown>;
  createdAt: string;
}

export interface LlmRoutingDecision {
  selectedModel: LlmModel;
  reason: string;
  matchedRule?: LlmRouteRule;
  estimatedCost: number;
  fallbacksAvailable: LlmModel[];
}

export interface UsageMetrics {
  date: string;
  amount: number;
  requests?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  timestamp: string;
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'body';
  required: boolean;
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

export interface ApiFunction {
  id: string;
  providerId: string;
  name: string;
  operationId?: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ApiParameter[];
  requestBody?: Record<string, unknown>;
  responses: Record<string, unknown>;
  security: Record<string, unknown>[];
  authRequired: boolean;
  rateLimit?: number;
  rateLimitWindowSeconds?: number;
  costPerCall: number;
  tokensPerCall?: number;
  isEnabled: boolean;
  isDeprecated: boolean;
  deprecatedMessage?: string;
  lastTestedAt?: string;
  lastTestSuccess?: boolean;
  lastTestLatencyMs?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSchema {
  id: string;
  providerId: string;
  name: string;
  schemaType: string;
  properties: Record<string, unknown>;
  requiredFields: string[];
  description?: string;
  example?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ApiDiscoveryResult {
  success: boolean;
  functionsDiscovered: number;
  schemasDiscovered: number;
  functions: ApiFunction[];
  schemas: ApiSchema[];
  error?: string;
}
