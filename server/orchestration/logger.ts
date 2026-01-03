import { eventBus, type SystemEvent, type TradingEvent } from "./events";
import { pinoLogger } from "../utils/logger";

// Create a child logger for orchestration
const orchestrationLogger = pinoLogger.child({ module: "orchestration" });

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

class TradingLogger {
  private logs: LogEntry[] = [];
  private readonly maxLogSize = 2000;
  private logLevel: LogLevel = "info";
  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    critical: 4,
  };

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }

  private log(
    level: LogLevel,
    category: string,
    message: string,
    metadata?: Record<string, unknown>,
    correlationId?: string
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      metadata,
      correlationId,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    // Log to Pino structured logger (Pino handles timestamp formatting)
    const logMeta = { category, correlationId, ...metadata };

    switch (level) {
      case "debug":
        orchestrationLogger.debug(logMeta, message);
        break;
      case "info":
        orchestrationLogger.info(logMeta, message);
        break;
      case "warn":
        orchestrationLogger.warn(logMeta, message);
        eventBus.emit<SystemEvent>(
          "system:warning",
          {
            level: "warning",
            message,
            details: metadata,
          },
          category,
          correlationId
        );
        break;
      case "error":
      case "critical":
        orchestrationLogger.error(logMeta, message);
        eventBus.emit<SystemEvent>(
          "system:error",
          {
            level: level === "critical" ? "critical" : "error",
            message,
            details: metadata,
          },
          category,
          correlationId
        );
        break;
    }
  }

  debug(
    category: string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log("debug", category, message, metadata);
  }

  info(
    category: string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log("info", category, message, metadata);
  }

  warn(
    category: string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log("warn", category, message, metadata);
  }

  error(
    category: string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log("error", category, message, metadata);
  }

  critical(
    category: string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log("critical", category, message, metadata);
  }

  trade(action: string, details: Record<string, unknown>): void {
    this.info("TRADE", action, details);
  }

  strategy(
    strategyName: string,
    action: string,
    details?: Record<string, unknown>
  ): void {
    this.info("STRATEGY", `[${strategyName}] ${action}`, details);
  }

  market(
    symbol: string,
    action: string,
    details?: Record<string, unknown>
  ): void {
    this.info("MARKET", `[${symbol}] ${action}`, details);
  }

  ai(action: string, details?: Record<string, unknown>): void {
    this.info("AI", action, details);
  }

  connector(
    connectorName: string,
    action: string,
    details?: Record<string, unknown>
  ): void {
    this.info("CONNECTOR", `[${connectorName}] ${action}`, details);
  }

  getLogs(filter?: {
    level?: LogLevel;
    category?: string;
    since?: Date;
    limit?: number;
  }): LogEntry[] {
    let entries = [...this.logs];

    if (filter?.level) {
      const minPriority = this.levelPriority[filter.level];
      entries = entries.filter(
        (e) => this.levelPriority[e.level] >= minPriority
      );
    }

    if (filter?.category) {
      entries = entries.filter((e) => e.category === filter.category);
    }

    if (filter?.since) {
      entries = entries.filter((e) => e.timestamp >= filter.since!);
    }

    if (filter?.limit) {
      entries = entries.slice(-filter.limit);
    }

    return entries;
  }

  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  getErrorLogs(limit: number = 50): LogEntry[] {
    return this.logs
      .filter((e) => e.level === "error" || e.level === "critical")
      .slice(-limit);
  }

  clearLogs(): void {
    this.logs = [];
  }

  getStats(): {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByCategory: Record<string, number>;
  } {
    const logsByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
    };

    const logsByCategory: Record<string, number> = {};

    for (const log of this.logs) {
      logsByLevel[log.level]++;
      logsByCategory[log.category] = (logsByCategory[log.category] || 0) + 1;
    }

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      logsByCategory,
    };
  }
}

export const logger = new TradingLogger();

eventBus.subscribe(
  "system:heartbeat",
  (event: TradingEvent<{ status: string }>) => {
    logger.debug("SYSTEM", `Heartbeat from ${event.source}`, {
      status: event.data.status,
    });
  }
);
