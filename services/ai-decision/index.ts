/**
 * AI Active Trader - AI Decision Service
 * Handles LLM routing, data fusion, prompt engineering, and calibration
 */

import express, { Request, Response } from 'express';
import { createEventBus, EventBusClient } from '../shared/events';
import { createLogger, loadServiceConfig, createHealthChecker, initTelemetry } from '../shared/common';

const SERVICE_NAME = 'ai-decision';
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

  // Subscribe to analysis requests
  await eventBus.subscribe('ai.analysis.requested', async (event) => {
    logger.info('Received analysis request', { 
      requestId: event.payload.requestId,
      symbol: event.payload.symbol,
      type: event.payload.analysisType,
    });
    // TODO: Process analysis request and publish decision
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

  app.post('/api/v1/analyze', async (req: Request, res: Response) => {
    res.status(501).json({ message: 'Analysis pending Phase 2 implementation' });
  });

  app.get('/api/v1/decisions', async (req: Request, res: Response) => {
    res.status(501).json({ message: 'Decision history pending Phase 2 implementation' });
  });

  app.get('/api/v1/models', async (req: Request, res: Response) => {
    res.json({
      models: [
        { id: 'gpt-4', provider: 'openai', status: 'available' },
        { id: 'claude-3', provider: 'anthropic', status: 'available' },
        { id: 'llama-3', provider: 'groq', status: 'available' },
      ],
      activeModel: 'gpt-4',
    });
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
