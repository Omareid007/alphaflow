/**
 * AI Active Trader - Structured Logger
 * Provides consistent JSON logging across all services
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  service: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private serviceName: string;
  private minLevel: LogLevel;
  private context: Partial<LogContext>;

  constructor(serviceName: string, minLevel: LogLevel = 'info') {
    this.serviceName = serviceName;
    this.minLevel = process.env.LOG_LEVEL as LogLevel || minLevel;
    this.context = {};
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
    };

    const mergedContext = { ...this.context, ...context };
    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry = this.formatEntry(level, message, context, error);
    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  child(context: Partial<LogContext>): Logger {
    const child = new Logger(this.serviceName, this.minLevel);
    child.context = { ...this.context, ...context };
    return child;
  }

  withTraceId(traceId: string): Logger {
    return this.child({ traceId });
  }

  withRequestId(requestId: string): Logger {
    return this.child({ requestId });
  }
}

export function createLogger(serviceName: string, minLevel?: LogLevel): Logger {
  return new Logger(serviceName, minLevel);
}
