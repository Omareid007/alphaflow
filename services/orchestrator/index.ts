/**
 * AI Active Trader - Orchestrator Service
 * Handles trading cycles, saga coordination, and strategy scheduling
 */

import express, { Request, Response } from 'express';
import { createEventBus, EventBusClient } from '../shared/events';
import { createLogger, loadServiceConfig, createHealthChecker, initTelemetry } from '../shared/common';

const SERVICE_NAME = 'orchestrator';
const config = loadServiceConfig(SERVICE_NAME);
const logger = createLogger(SERVICE_NAME, config.logLevel);
const healthChecker = createHealthChecker(SERVICE_NAME, '1.0.0');

let eventBus: EventBusClient;

interface CycleState {
  cycleId: string | null;
  status: 'idle' | 'running' | 'completing';
  startedAt: Date | null;
  symbols: string[];
}

const state: CycleState = {
  cycleId: null,
  status: 'idle',
  startedAt: null,
  symbols: [],
};

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

  // Subscribe to AI decisions for trade execution
  await eventBus.subscribe('ai.decision.generated', async (event) => {
    logger.info('Received AI decision for orchestration', { 
      decisionId: event.payload.decisionId,
      symbol: event.payload.symbol,
      action: event.payload.action,
      confidence: event.payload.confidence,
    });
    // TODO: Evaluate decision and initiate trade saga if appropriate
  });

  healthChecker.registerCheck('eventbus', async () => ({
    status: eventBus.isConnected() ? 'pass' : 'fail',
    duration: 0,
    message: eventBus.isInMemoryMode() ? 'In-memory mode' : 'NATS connected',
    lastChecked: new Date().toISOString(),
  }));

  healthChecker.registerCheck('cycle', async () => ({
    status: 'pass',
    duration: 0,
    message: state.status === 'running' 
      ? 'Cycle ' + state.cycleId + ' running' 
      : 'Idle',
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
      cycleState: state,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/v1/cycles/start', async (req: Request, res: Response) => {
    if (state.status === 'running') {
      res.status(409).json({ error: 'Cycle already running', cycleId: state.cycleId });
      return;
    }
    
    const { symbols = ['AAPL', 'GOOGL', 'MSFT'], cycleType = 'analysis' } = req.body;
    const cycleId = 'cycle_' + Date.now();
    
    state.cycleId = cycleId;
    state.status = 'running';
    state.startedAt = new Date();
    state.symbols = symbols;
    
    // Publish cycle started event
    await eventBus.publish('orchestrator.cycle.started', {
      cycleId,
      cycleType,
      symbols,
      startedAt: new Date().toISOString(),
    });
    
    logger.info('Started trading cycle', { cycleId, symbols });
    res.json({ cycleId, status: 'started', symbols });
  });

  app.post('/api/v1/cycles/stop', async (req: Request, res: Response) => {
    if (state.status !== 'running') {
      res.status(400).json({ error: 'No cycle running' });
      return;
    }
    
    const cycleId = state.cycleId;
    const duration = state.startedAt ? Date.now() - state.startedAt.getTime() : 0;
    
    state.status = 'idle';
    state.cycleId = null;
    state.startedAt = null;
    
    await eventBus.publish('orchestrator.cycle.completed', {
      cycleId: cycleId!,
      cycleType: 'analysis',
      duration,
      decisionsCount: 0,
      tradesCount: 0,
      completedAt: new Date().toISOString(),
    });
    
    logger.info('Stopped trading cycle', { cycleId, duration });
    res.json({ cycleId, status: 'stopped', duration });
  });

  app.get('/api/v1/strategies', async (req: Request, res: Response) => {
    res.status(501).json({ message: 'Strategy list pending Phase 2 implementation' });
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
      if (state.status === 'running') {
        logger.warn('Shutdown while cycle running', { cycleId: state.cycleId });
      }
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
