type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  cycleId?: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /credential/i,
  /authorization/i,
];

function redactSecrets(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(key))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSecrets(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function formatTimestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

class Logger {
  private minLevel: LogLevel = "info";
  private currentRequestId: string | undefined;
  private currentCycleId: string | undefined;

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  setRequestId(requestId: string | undefined): void {
    this.currentRequestId = requestId;
  }

  setCycleId(cycleId: string | undefined): void {
    this.currentCycleId = cycleId;
  }

  generateRequestId(): string {
    return `req-${generateId()}`;
  }

  generateCycleId(): string {
    return `cyc-${generateId()}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private formatMessage(
    level: LogLevel,
    context: string,
    message: string,
    meta?: LogContext
  ): string {
    const time = formatTimestamp();
    const levelStr = level.toUpperCase().padEnd(5);
    const ids: string[] = [];

    const requestId = meta?.requestId || this.currentRequestId;
    const cycleId = meta?.cycleId || this.currentCycleId;

    if (requestId) ids.push(requestId);
    if (cycleId) ids.push(cycleId);

    const idStr = ids.length > 0 ? ` [${ids.join("|")}]` : "";

    return `[${time}] [${levelStr}] [${context}]${idStr} ${message}`;
  }

  private log(
    level: LogLevel,
    context: string,
    message: string,
    meta?: LogContext
  ): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, context, message, meta);
    const safeMeta = meta ? redactSecrets(meta) : undefined;

    switch (level) {
      case "debug":
        console.debug(formatted, safeMeta || "");
        break;
      case "info":
        console.log(formatted, safeMeta ? JSON.stringify(safeMeta) : "");
        break;
      case "warn":
        console.warn(formatted, safeMeta || "");
        break;
      case "error":
        console.error(formatted, safeMeta || "");
        break;
    }
  }

  debug(context: string, message: string, meta?: LogContext): void {
    this.log("debug", context, message, meta);
  }

  info(context: string, message: string, meta?: LogContext): void {
    this.log("info", context, message, meta);
  }

  warn(context: string, message: string, meta?: LogContext): void {
    this.log("warn", context, message, meta);
  }

  error(context: string, message: string, meta?: LogContext): void {
    this.log("error", context, message, meta);
  }

  api(message: string, meta?: LogContext): void {
    this.info("API", message, meta);
  }

  orchestrator(message: string, meta?: LogContext): void {
    this.info("Orchestrator", message, meta);
  }

  alpaca(message: string, meta?: LogContext): void {
    this.info("Alpaca", message, meta);
  }

  ai(message: string, meta?: LogContext): void {
    this.info("AI", message, meta);
  }

  connector(name: string, message: string, meta?: LogContext): void {
    this.info(name, message, meta);
  }

  trade(action: string, meta?: LogContext): void {
    this.info("Trade", action, meta);
  }
}

export const log = new Logger();

export function createRequestLogger() {
  return (
    req: { method: string; path: string; requestId?: string },
    res: { statusCode: number; on: (event: string, cb: () => void) => void },
    next: () => void
  ) => {
    const requestId = log.generateRequestId();
    (req as { requestId?: string }).requestId = requestId;

    const start = Date.now();

    res.on("finish", () => {
      if (!req.path.startsWith("/api")) return;

      const duration = Date.now() - start;
      const level = res.statusCode >= 400 ? "warn" : "info";

      log[level](
        "API",
        `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`,
        {
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
        }
      );
    });

    next();
  };
}

export type { LogLevel, LogContext };
