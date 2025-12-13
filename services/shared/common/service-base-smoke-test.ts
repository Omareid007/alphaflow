/**
 * AI Active Trader - Service Base Smoke Test
 * Tests the ServiceBase class functionality
 */

import { ServiceBase, ServiceOptions, runService } from './service-base';
import { Request, Response } from 'express';

class TestService extends ServiceBase {
  private testData: string[] = [];

  constructor(options: ServiceOptions) {
    super(options);
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('TestService initializing');
    
    this.registerHealthCheck('test-component', async () => ({
      status: 'pass',
      duration: 0,
      message: 'Test component healthy',
      lastChecked: new Date().toISOString(),
    }));

    this.onShutdown(async () => {
      this.logger.info('TestService cleanup');
    });
  }

  protected async registerRoutes(): Promise<void> {
    this.app.get('/api/v1/test', (req: Request, res: Response) => {
      res.json({ 
        data: this.testData,
        requestId: (req as any).requestId,
      });
    });

    this.app.post('/api/v1/test', (req: Request, res: Response) => {
      const { item } = req.body;
      if (item) {
        this.testData.push(item);
        res.status(201).json({ success: true, item });
      } else {
        res.status(400).json({ error: 'Missing item' });
      }
    });
  }
}

async function runTests(): Promise<void> {
  console.log('=== Service Base Smoke Tests ===\n');
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => boolean | Promise<boolean>) => {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.then(r => {
          if (r) {
            console.log(`✓ ${name}`);
            passed++;
          } else {
            console.log(`✗ ${name}`);
            failed++;
          }
        }).catch(e => {
          console.log(`✗ ${name}: ${e.message}`);
          failed++;
        });
      }
      if (result) {
        console.log(`✓ ${name}`);
        passed++;
      } else {
        console.log(`✗ ${name}`);
        failed++;
      }
    } catch (e: any) {
      console.log(`✗ ${name}: ${e.message}`);
      failed++;
    }
  };

  const service = new TestService({ 
    name: 'test-service', 
    version: '1.0.0-test',
  });

  test('ServiceBase constructor initializes correctly', () => {
    const ctx = service.getContext();
    return ctx.serviceName === 'test-service' && ctx.version === '1.0.0-test';
  });

  test('ServiceBase has logger', () => {
    const ctx = service.getContext();
    return ctx.logger !== null && typeof ctx.logger.info === 'function';
  });

  test('ServiceBase has health checker', () => {
    const ctx = service.getContext();
    return ctx.healthChecker !== null && typeof ctx.healthChecker.getStatus === 'function';
  });

  test('ServiceBase has express app', () => {
    const ctx = service.getContext();
    return ctx.app !== null && typeof ctx.app.use === 'function';
  });

  test('ServiceBase config loads correctly', () => {
    const ctx = service.getContext();
    return ctx.config !== null && ctx.config.serviceName === 'test-service';
  });

  await service.initialize({ skipEventBus: true, skipTelemetry: true });

  test('ServiceBase initialize sets up routes', () => {
    const ctx = service.getContext();
    const stack = ctx.app._router.stack;
    return stack.some((layer: any) => layer.route?.path === '/api/v1/test');
  });

  test('ServiceBase initialize sets up health endpoint via router', () => {
    const ctx = service.getContext();
    const stack = ctx.app._router.stack;
    return stack.some((layer: any) => 
      layer.name === 'router' || layer.route?.path?.includes('health')
    );
  });

  test('ServiceBase initialize sets up info endpoint', () => {
    const ctx = service.getContext();
    const stack = ctx.app._router.stack;
    return stack.some((layer: any) => layer.route?.path === '/api/v1/info');
  });

  await test('Health status includes custom check', async () => {
    const ctx = service.getContext();
    const status = await ctx.healthChecker.getStatus();
    return 'test-component' in status.checks;
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
