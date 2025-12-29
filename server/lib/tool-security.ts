import { log } from "../utils/logger";

const ALLOWED_DOMAINS: string[] = [
  "api.alpaca.markets",
  "data.alpaca.markets",
  "paper-api.alpaca.markets",
  "finnhub.io",
  "api.polygon.io",
  "api.twelvedata.com",
  "newsapi.org",
  "api.openai.com",
  "api.groq.com",
  "api.together.xyz",
  "openrouter.ai",
];

const BLOCKED_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/i,
];

const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /credential/i,
  /authorization/i,
  /bearer/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /client[_-]?secret/i,
];

const SECRET_VALUE_PATTERNS = [
  /^sk-[a-zA-Z0-9]+$/,
  /^pk_[a-zA-Z0-9]+$/,
  /^[A-Za-z0-9]{32,}$/,
  /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
];

export interface SSRFCheckResult {
  allowed: boolean;
  reason?: string;
  normalizedUrl?: string;
}

export function checkSSRF(url: string): SSRFCheckResult {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        allowed: false,
        reason: `Protocol not allowed: ${parsed.protocol}`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { allowed: false, reason: `Blocked IP/hostname: ${hostname}` };
      }
    }

    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      return { allowed: false, reason: `Domain not in allowlist: ${hostname}` };
    }

    return { allowed: true, normalizedUrl: parsed.toString() };
  } catch (err) {
    return {
      allowed: false,
      reason: `Invalid URL: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function addAllowedDomain(domain: string): void {
  if (!ALLOWED_DOMAINS.includes(domain.toLowerCase())) {
    ALLOWED_DOMAINS.push(domain.toLowerCase());
    log.info("ToolSecurity", `Added allowed domain: ${domain}`);
  }
}

export function removeAllowedDomain(domain: string): boolean {
  const index = ALLOWED_DOMAINS.indexOf(domain.toLowerCase());
  if (index !== -1) {
    ALLOWED_DOMAINS.splice(index, 1);
    log.info("ToolSecurity", `Removed allowed domain: ${domain}`);
    return true;
  }
  return false;
}

export function getAllowedDomains(): string[] {
  return [...ALLOWED_DOMAINS];
}

export function redactSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    for (const pattern of SECRET_VALUE_PATTERNS) {
      if (pattern.test(obj)) {
        const prefix = obj.substring(0, Math.min(4, obj.length));
        return `${prefix}...[REDACTED]`;
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SECRET_PATTERNS.some((pattern) => pattern.test(key))) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSecrets(value);
      }
    }
    return result;
  }

  return obj;
}

export function sanitizeHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(key))) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] =
        typeof value === "string" && value.length > 100
          ? `${value.substring(0, 50)}...[truncated]`
          : value;
    }
  }
  return sanitized;
}

export interface RateLimitConfig {
  maxCallsPerMinute: number;
  maxCallsPerHour: number;
  cooldownMs: number;
}

const toolRateLimits = new Map<
  string,
  { calls: number[]; lastReset: number }
>();

export function checkRateLimit(
  toolName: string,
  config: RateLimitConfig = {
    maxCallsPerMinute: 60,
    maxCallsPerHour: 1000,
    cooldownMs: 100,
  }
): { allowed: boolean; waitMs?: number; reason?: string } {
  const now = Date.now();
  let state = toolRateLimits.get(toolName);

  if (!state) {
    state = { calls: [], lastReset: now };
    toolRateLimits.set(toolName, state);
  }

  const oneMinuteAgo = now - 60000;
  const oneHourAgo = now - 3600000;
  state.calls = state.calls.filter((t) => t > oneHourAgo);

  const callsLastMinute = state.calls.filter((t) => t > oneMinuteAgo).length;
  const callsLastHour = state.calls.length;

  if (callsLastMinute >= config.maxCallsPerMinute) {
    return {
      allowed: false,
      waitMs:
        60000 -
        (now - Math.min(...state.calls.filter((t) => t > oneMinuteAgo))),
      reason: `Rate limit exceeded: ${callsLastMinute}/${config.maxCallsPerMinute} calls/minute`,
    };
  }

  if (callsLastHour >= config.maxCallsPerHour) {
    return {
      allowed: false,
      waitMs: 3600000 - (now - Math.min(...state.calls)),
      reason: `Rate limit exceeded: ${callsLastHour}/${config.maxCallsPerHour} calls/hour`,
    };
  }

  const lastCall = state.calls[state.calls.length - 1];
  if (lastCall && now - lastCall < config.cooldownMs) {
    return {
      allowed: false,
      waitMs: config.cooldownMs - (now - lastCall),
      reason: `Cooldown active: ${config.cooldownMs}ms between calls`,
    };
  }

  state.calls.push(now);
  return { allowed: true };
}

export interface ToolAuditEntry {
  toolName: string;
  params: unknown;
  result: unknown;
  error?: string;
  callerRole?: string;
  timestamp: Date;
  latencyMs: number;
  ssrfCheck?: SSRFCheckResult;
}

const auditLog: ToolAuditEntry[] = [];
const MAX_AUDIT_LOG_SIZE = 1000;

export function logToolAudit(entry: ToolAuditEntry): void {
  const sanitizedEntry = {
    ...entry,
    params: redactSecrets(entry.params),
    result: redactSecrets(entry.result),
  };

  auditLog.unshift(sanitizedEntry);

  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.pop();
  }

  if (entry.error) {
    log.warn("ToolAudit", `Tool error: ${entry.toolName}`, {
      callerRole: entry.callerRole,
      error: entry.error,
    });
  }
}

export function getRecentAuditEntries(limit = 100): ToolAuditEntry[] {
  return auditLog.slice(0, limit);
}

export function getToolTelemetry(toolName?: string): {
  totalCalls: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  callsByRole: Record<string, number>;
} {
  const entries = toolName
    ? auditLog.filter((e) => e.toolName === toolName)
    : auditLog;

  const successCount = entries.filter((e) => !e.error).length;
  const errorCount = entries.filter((e) => !!e.error).length;
  const avgLatencyMs =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + e.latencyMs, 0) / entries.length
      : 0;

  const callsByRole: Record<string, number> = {};
  for (const entry of entries) {
    const role = entry.callerRole || "unknown";
    callsByRole[role] = (callsByRole[role] || 0) + 1;
  }

  return {
    totalCalls: entries.length,
    successCount,
    errorCount,
    avgLatencyMs: Math.round(avgLatencyMs),
    callsByRole,
  };
}
