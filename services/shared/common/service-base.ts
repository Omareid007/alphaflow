/**
 * AI Active Trader - Service Base Class
 * Standardized bootstrapping for all microservices
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createEventBus, EventBusClient } from '../events';
import { createLogger, Logger } from './logger';
import { loadServiceConfig, ServiceConfig, validateConfig } from './config';
import { createHealthChecker, HealthChecker, HealthCheckFn } from './health';
import { initTelemetry, tracingMiddleware } from './telemetry';

export interface ServiceOptions {
  name: string;
  version?: string;
  skipEventBus?: boolean;
  skipTelemetry?: boolean;
}

export interface ServiceContext {
  serviceName: string;
  version: string;
  config: ServiceConfig;
  logger: Logger;
  healthChecker: HealthChecker;
  eventBus: EventBusClient | null;
  app: Express;
}

export abstract class ServiceBase {
  protected serviceName: string;
  protected version: string;
  protected config: ServiceConfig;
  protected logger: Logger;
  protected healthChecker: HealthChecker;
  protected eventBus: EventBusClient | null = null;
  protected app: Express;
  private shutdownCallbacks: (() => Promise<void>)[] = [];
  private isShuttingDown = false;

  constructor(options: ServiceOptions) {
    this.serviceName = options.name;
    this.version = options.version || '1.0.0';
    this.config = loadServiceConfig(this.serviceName);
    validateConfig(this.config);
    this.logger = createLogger(this.serviceName, this.config.logLevel);
    this.healthChecker = createHealthChecker(this.serviceName, this.version);
    this.app = express();

    this.setupBaseMiddleware();
    this.setupShutdownHandlers();
  }

  private setupBaseMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string || 
        `${this.serviceName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      (req as any).requestId = requestId;
      res.setHeader('X-Request-Id', requestId);
      res.setHeader('X-Service', this.serviceName);
      res.setHeader('X-Service-Version', this.version);
      next();
    });

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        if (!req.path.startsWith('/health')) {
          this.logger.debug('Request', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: Date.now() - start,
            requestId: (req as any).requestId,
          });
        }
      });
      next();
    });
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      this.logger.info(`Received ${signal}, starting graceful shutdown...`);

      const shutdownTimeout = setTimeout(() => {
        this.logger.error('Shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, 30000);

      try {
        for (const callback of this.shutdownCallbacks) {
          await callback();
        }

        if (this.eventBus) {
          await this.eventBus.disconnect();
        }

        clearTimeout(shutdownTimeout);
        this.logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', error instanceof Error ? error : undefined);
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', error);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
    });
  }

  protected onShutdown(callback: () => Promise<void>): void {
    this.shutdownCallbacks.push(callback);
  }

  protected registerHealthCheck(name: string, check: HealthCheckFn): void {
    this.healthChecker.registerCheck(name, check);
  }

  async initialize(options?: { skipEventBus?: boolean; skipTelemetry?: boolean }): Promise<void> {
    this.logger.info('Initializing service', { 
      serviceName: this.serviceName,
      version: this.version,
      port: this.config.port,
      environment: this.config.environment,
    });

    if (!options?.skipTelemetry && this.config.telemetry.enabled) {
      initTelemetry({
        serviceName: this.serviceName,
        enabled: true,
        endpoint: this.config.telemetry.endpoint,
      });
      this.app.use(tracingMiddleware);
      this.logger.info('Telemetry initialized');
    }

    if (!options?.skipEventBus) {
      this.eventBus = createEventBus(this.serviceName);
      await this.eventBus.connect(this.config.nats.url);
      this.logger.info('Event bus connected', { 
        inMemory: this.eventBus.isInMemoryMode(),
      });

      this.registerHealthCheck('eventbus', async () => ({
        status: this.eventBus!.isConnected() ? 'pass' : 'warn',
        duration: 0,
        message: this.eventBus!.isInMemoryMode() ? 'In-memory mode' : 'NATS connected',
        lastChecked: new Date().toISOString(),
      }));
    }

    await this.onInitialize();

    this.healthChecker.registerWithApp(this.app);

    this.app.get('/api/v1/info', (req: Request, res: Response) => {
      res.json({
        service: this.serviceName,
        version: this.version,
        environment: this.config.environment,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    await this.registerRoutes();

    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ 
        error: 'Not found', 
        path: req.path,
        service: this.serviceName,
      });
    });

    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error', err, { 
        requestId: (req as any).requestId,
        path: req.path,
      });
      res.status(500).json({ 
        error: 'Internal server error',
        requestId: (req as any).requestId,
      });
    });
  }

  async start(): Promise<void> {
    await this.initialize();

    return new Promise((resolve) => {
      this.app.listen(this.config.port, '0.0.0.0', () => {
        this.logger.info(`${this.serviceName} listening`, { 
          port: this.config.port,
          environment: this.config.environment,
        });
        console.log(`[${this.serviceName}] Running on port ${this.config.port}`);
        resolve();
      });
    });
  }

  getContext(): ServiceContext {
    return {
      serviceName: this.serviceName,
      version: this.version,
      config: this.config,
      logger: this.logger,
      healthChecker: this.healthChecker,
      eventBus: this.eventBus,
      app: this.app,
    };
  }

  protected abstract onInitialize(): Promise<void>;

  protected abstract registerRoutes(): Promise<void>;
}

export async function runService(ServiceClass: new (options: ServiceOptions) => ServiceBase, options: ServiceOptions): Promise<void> {
  const service = new ServiceClass(options);
  try {
    await service.start();
  } catch (error) {
    console.error(`[${options.name}] Failed to start:`, error);
    process.exit(1);
  }
}
