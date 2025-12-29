/**
 * Structured Logging Utility for AlphaFlow Trading Platform
 *
 * This module provides a unified logging interface that:
 * - Uses Pino for high-performance JSON logging in production
 * - Uses pretty formatting in development
 * - Automatically redacts sensitive data (API keys, passwords, tokens)
 * - Supports request/cycle ID correlation for distributed tracing
 * - Maintains backward compatibility with existing log.info/warn/error calls
 *
 * @see https://github.com/pinojs/pino
 */

import pino, { Logger as PinoLogger } from 'pino';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  cycleId?: string;
  [key: string]: unknown;
}

// Sensitive fields to redact in logs
const REDACT_PATHS = [
  // API credentials
  'alpacaApiKey',
  'alpacaSecretKey',
  'ALPACA_API_KEY',
  'ALPACA_SECRET_KEY',
  'apiKey',
  'secretKey',
  'api_key',
  'secret_key',

  // Authentication
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'session',
  'jwt',

  // Nested patterns
  '*.apiKey',
  '*.secretKey',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',

  // Request headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',

  // Request body
  'body.password',
  'body.apiKey',
  'body.secretKey',
  'body.token',
];

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Get log level from environment
const getLogLevel = (): string => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  return isProduction ? 'info' : 'debug';
};

// Create pino logger with appropriate configuration
const createPinoLogger = (): PinoLogger => {
  const baseConfig: pino.LoggerOptions = {
    level: getLogLevel(),
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label: string) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: 'alphaflow',
      env: process.env.NODE_ENV || 'development',
    },
  };

  // Add pretty printing in development
  if (!isProduction) {
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname,service,env',
        },
      },
    });
  }

  return pino(baseConfig);
};

// Create the pino logger instance
const pinoLogger = createPinoLogger();

// Generate random ID for request/cycle tracking
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Main Logger class that wraps Pino with a familiar API
 *
 * Maintains backward compatibility with existing log calls:
 * - log.info('Context', 'Message', { meta })
 * - log.error('Context', 'Message', { error })
 */
class Logger {
  private currentRequestId: string | undefined;
  private currentCycleId: string | undefined;

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    pinoLogger.level = level;
  }

  /**
   * Set current request ID for correlation
   */
  setRequestId(requestId: string | undefined): void {
    this.currentRequestId = requestId;
  }

  /**
   * Set current cycle ID for correlation
   */
  setCycleId(cycleId: string | undefined): void {
    this.currentCycleId = cycleId;
  }

  /**
   * Generate a new request ID
   */
  generateRequestId(): string {
    return `req-${generateId()}`;
  }

  /**
   * Generate a new cycle ID
   */
  generateCycleId(): string {
    return `cyc-${generateId()}`;
  }

  /**
   * Build log metadata with correlation IDs
   */
  private buildMeta(context: string, meta?: LogContext): object {
    return {
      context,
      requestId: meta?.requestId || this.currentRequestId,
      cycleId: meta?.cycleId || this.currentCycleId,
      ...meta,
    };
  }

  /**
   * Log debug message
   */
  debug(context: string, message: string, meta?: LogContext): void {
    pinoLogger.debug(this.buildMeta(context, meta), message);
  }

  /**
   * Log info message
   */
  info(context: string, message: string, meta?: LogContext): void {
    pinoLogger.info(this.buildMeta(context, meta), message);
  }

  /**
   * Log warning message
   */
  warn(context: string, message: string, meta?: LogContext): void {
    pinoLogger.warn(this.buildMeta(context, meta), message);
  }

  /**
   * Log error message
   */
  error(context: string, message: string, meta?: LogContext): void {
    // Extract error object if present in meta
    const { error, err, ...restMeta } = (meta || {}) as LogContext & {
      error?: Error | unknown;
      err?: Error | unknown;
    };
    const errorObj = error || err;

    if (errorObj instanceof Error) {
      pinoLogger.error(
        { err: errorObj, ...this.buildMeta(context, restMeta) },
        message
      );
    } else if (errorObj) {
      pinoLogger.error(
        { error: errorObj, ...this.buildMeta(context, restMeta) },
        message
      );
    } else {
      pinoLogger.error(this.buildMeta(context, meta), message);
    }
  }

  // ============================================================================
  // Convenience methods for specific modules
  // ============================================================================

  /**
   * Log API-related message
   */
  api(message: string, meta?: LogContext): void {
    this.info('API', message, meta);
  }

  /**
   * Log orchestrator-related message
   */
  orchestrator(message: string, meta?: LogContext): void {
    this.info('Orchestrator', message, meta);
  }

  /**
   * Log Alpaca-related message
   */
  alpaca(message: string, meta?: LogContext): void {
    this.info('Alpaca', message, meta);
  }

  /**
   * Log AI-related message
   */
  ai(message: string, meta?: LogContext): void {
    this.info('AI', message, meta);
  }

  /**
   * Log connector-related message
   */
  connector(name: string, message: string, meta?: LogContext): void {
    this.info(name, message, meta);
  }

  /**
   * Log trade-related message
   */
  trade(action: string, meta?: LogContext): void {
    this.info('Trade', action, meta);
  }

  /**
   * Log order-related message
   */
  order(action: string, meta?: LogContext): void {
    this.info('Order', action, meta);
  }

  /**
   * Log position-related message
   */
  position(action: string, meta?: LogContext): void {
    this.info('Position', action, meta);
  }

  /**
   * Log strategy-related message
   */
  strategy(action: string, meta?: LogContext): void {
    this.info('Strategy', action, meta);
  }

  /**
   * Log backtest-related message
   */
  backtest(action: string, meta?: LogContext): void {
    this.info('Backtest', action, meta);
  }
}

// Export singleton logger instance
export const log = new Logger();

/**
 * Express middleware factory for request logging
 *
 * @returns Express middleware that logs requests with correlation IDs
 */
export function createRequestLogger() {
  return (
    req: { method: string; path: string; requestId?: string },
    res: { statusCode: number; on: (event: string, cb: () => void) => void },
    next: () => void
  ) => {
    const requestId = log.generateRequestId();
    (req as { requestId?: string }).requestId = requestId;

    const start = Date.now();

    res.on('finish', () => {
      // Skip non-API routes to reduce noise
      if (!req.path.startsWith('/api')) return;

      const duration = Date.now() - start;
      const level = res.statusCode >= 400 ? 'warn' : 'info';

      log[level]('API', `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`, {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
      });
    });

    next();
  };
}

// ============================================================================
// Module-specific child loggers for direct pino access
// ============================================================================

/**
 * Trading module logger (for high-volume trading operations)
 */
export const tradingLogger = pinoLogger.child({ module: 'trading' });

/**
 * Autonomous module logger
 */
export const autonomousLogger = pinoLogger.child({ module: 'autonomous' });

/**
 * AI module logger
 */
export const aiLogger = pinoLogger.child({ module: 'ai' });

/**
 * API routes logger
 */
export const apiLogger = pinoLogger.child({ module: 'api' });

/**
 * Connector/integration logger
 */
export const connectorLogger = pinoLogger.child({ module: 'connector' });

// Export the raw pino logger for advanced use cases
export { pinoLogger };

export type { LogLevel, LogContext };
