/**
 * AI Active Trader - Analytics Service
 * Handles P&L calculations, metrics, equity curves, and risk analysis
 */

import express, { Request, Response } from 'express';
import { createEventBus, EventBusClient } from '../shared/events';
import { createLogger, loadServiceConfig, createHealthChecker, initTelemetry } from '../shared/common';

const SERVICE_NAME = 'analytics';
const config = loadServiceConfig(SERVICE_NAME);
const logger = createLogger(SERVICE_NAME, config.logLevel);
const healthChecker = createHealthChecker(SERVICE_NAME, '1.0.0');

let eventBus: EventBusClient;

async function initializeService(): Promise<void> {
  logger.info('Initializing service', { port: config.port });

  initTelemetry({
    serviceName: SERVICE_NAME,
    enabled: config.telemetry.enabled,
    endpoint: config.telemetry.endpoint,
  });

  eventBus = createEventBus(SERVICE_NAME);
  await eventBus.connect(config.nats.url);
  
  logger.info('Event bus connected', { inMemory: eventBus.isInMemoryMode() });

  // Subscribe to trade events for P&L tracking
  await eventBus.subscribe('trade.order.filled', async (event) => {
    logger.info('Recording filled order for analytics', { 
      orderId: event.payload.orderId,
      symbol: event.payload.symbol,
    });
    // TODO: Update P&L and metrics
  });

  await eventBus.subscribe('trade.position.closed', async (event) => {
    logger.info('Recording closed position', { 
      positionId: event.payload.positionId,
      realizedPnl: event.payload.realizedPnl,
    });
    // TODO: Update realized P&L
  });

  healthChecker.registerCheck('eventbus', async () => ({
    status: eventBus.isConnected() ? 'pass' : 'fail',
    duration: 0,
    message: eventBus.isInMemoryMode() ? 'In-memory mode' : 'NATS connected',
    lastChecked: new Date().toISOString(),
  }));
}

function createApp(): express.Express {
  const app = express();
  
  app.use(express.json());
  healthChecker.registerWithApp(app);

  app.get('/api/v1/status', (req: Request, res: Response) => {
    res.json({
      service: SERVICE_NAME,
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/v1/pnl', async (req: Request, res: Response) => {
    res.status(501).json({ message: 'P&L calculation pending Phase 2 implementation' });
  });

  app.get('/api/v1/equity-curve', async (req: Request, res: Response) => {
    res.status(501).json({ message: 'Equity curve pending Phase 2 implementation' });
  });

  app.get('/api/v1/metrics', async (req: Request, res: Response) => {
    res.status(501).json({ message: 'Metrics pending Phase 2 implementation' });
  });

  app.get('/api/v1/risk', async (req: Request, res: Response) => {
    res.status(501).json({ message: 'Risk analysis pending Phase 2 implementation' });
  });

  return app;
}

async function main(): Promise<void> {
  try {
    await initializeService();
    
    const app = createApp();
    
    app.listen(config.port, '0.0.0.0', () => {
      logger.info(SERVICE_NAME + ' listening on port ' + config.port);
    });

    const shutdown = async () => {
      logger.info('Shutting down...');
      await eventBus.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start service', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

main();
