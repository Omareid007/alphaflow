/**
 * AI Active Trader - Health Check Utilities
 * Provides standardized health endpoints for all services
 */

import { Request, Response, Router, Express } from 'express';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, HealthCheckResult>;
}

export interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  message?: string;
  lastChecked: string;
}

export type HealthCheckFn = () => Promise<HealthCheckResult>;

const startTime = Date.now();

export class HealthChecker {
  private serviceName: string;
  private version: string;
  private checks: Map<string, HealthCheckFn> = new Map();

  constructor(serviceName: string, version: string = '1.0.0') {
    this.serviceName = serviceName;
    this.version = version;
  }

  registerCheck(name: string, check: HealthCheckFn): void {
    this.checks.set(name, check);
  }

  async getStatus(): Promise<HealthStatus> {
    const checkResults: Record<string, HealthCheckResult> = {};
    let overallStatus: HealthStatus['status'] = 'healthy';

    for (const [name, check] of this.checks) {
      const start = Date.now();
      try {
        const result = await check();
        checkResults[name] = {
          ...result,
          duration: Date.now() - start,
          lastChecked: new Date().toISOString(),
        };

        if (result.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warn' && overallStatus !== 'unhealthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checkResults[name] = {
          status: 'fail',
          duration: Date.now() - start,
          message: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date().toISOString(),
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      service: this.serviceName,
      version: this.version,
      uptime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      checks: checkResults,
    };
  }

  createRouter(): Router {
    const router = Router();

    router.get('/health', async (req: Request, res: Response) => {
      const status = await this.getStatus();
      const httpStatus = status.status === 'healthy' ? 200 : 
                        status.status === 'degraded' ? 200 : 503;
      res.status(httpStatus).json(status);
    });

    router.get('/health/live', (req: Request, res: Response) => {
      res.json({ status: 'alive', timestamp: new Date().toISOString() });
    });

    router.get('/health/ready', async (req: Request, res: Response) => {
      const status = await this.getStatus();
      if (status.status === 'unhealthy') {
        res.status(503).json({ status: 'not ready', checks: status.checks });
      } else {
        res.json({ status: 'ready', checks: status.checks });
      }
    });

    return router;
  }

  registerWithApp(app: Express): void {
    app.use(this.createRouter());
  }
}

export function createDatabaseCheck(checkFn: () => Promise<boolean>): HealthCheckFn {
  return async () => {
    try {
      const healthy = await checkFn();
      return {
        status: healthy ? 'pass' : 'fail',
        duration: 0,
        message: healthy ? 'Database connection OK' : 'Database connection failed',
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'fail',
        duration: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      };
    }
  };
}

export function createNatsCheck(checkFn: () => boolean): HealthCheckFn {
  return async () => {
    const connected = checkFn();
    return {
      status: connected ? 'pass' : 'warn',
      duration: 0,
      message: connected ? 'NATS connected' : 'NATS not connected (using in-memory)',
      lastChecked: new Date().toISOString(),
    };
  };
}

export function createHealthChecker(serviceName: string, version?: string): HealthChecker {
  return new HealthChecker(serviceName, version);
}
