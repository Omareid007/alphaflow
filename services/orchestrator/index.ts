/**
 * AI Active Trader - Orchestrator Service
 * Handles trading cycles, saga coordination, and strategy scheduling
 */

import express, { Request, Response } from 'express';
import { createEventBus, EventBusClient } from '../shared/events';
import { createLogger, loadServiceConfig, createHealthChecker, initTelemetry } from '../shared/common';
import { createCycleManager, CycleManager } from './cycle-manager';
import { createSagaCoordinator, SagaCoordinator } from './saga-coordinator';
import { OrchestratorMode, StrategyInfo, DecisionForExecution, TradeExecutionSagaData } from './types';

const SERVICE_NAME = 'orchestrator';
const config = loadServiceConfig(SERVICE_NAME);
const logger = createLogger(SERVICE_NAME, config.logLevel);
const healthChecker = createHealthChecker(SERVICE_NAME, '1.0.0');

let eventBus: EventBusClient;
let cycleManager: CycleManager;
let sagaCoordinator: SagaCoordinator;

let orchestratorMode: OrchestratorMode = OrchestratorMode.MANUAL;
const confidenceThreshold = 0.7;

const availableStrategies: StrategyInfo[] = [
  {
    id: 'momentum',
    name: 'Momentum Strategy',
    description: 'Trades based on price momentum and trend strength indicators',
    enabled: true,
    supportedAssets: ['stocks', 'crypto'],
    riskLevel: 'high',
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion',
    description: 'Identifies oversold/overbought conditions for reversal trades',
    enabled: true,
    supportedAssets: ['stocks'],
    riskLevel: 'medium',
  },
  {
    id: 'moving-average-crossover',
    name: 'Moving Average Crossover',
    description: 'Trades on golden cross and death cross patterns',
    enabled: true,
    supportedAssets: ['stocks', 'crypto'],
    riskLevel: 'low',
  },
  {
    id: 'breakout',
    name: 'Breakout Strategy',
    description: 'Identifies and trades breakouts from consolidation ranges',
    enabled: false,
    supportedAssets: ['stocks'],
    riskLevel: 'high',
  },
];

const pendingDecisionSagas: Map<string, string> = new Map();

async function handleAIDecision(event: any): Promise<void> {
  const decision: DecisionForExecution = {
    decisionId: event.payload.decisionId,
    symbol: event.payload.symbol,
    action: event.payload.action,
    confidence: event.payload.confidence,
    reasoning: event.payload.reasoning || [],
  };

  logger.info('Processing AI decision', {
    decisionId: decision.decisionId,
    symbol: decision.symbol,
    action: decision.action,
    confidence: decision.confidence,
    mode: orchestratorMode,
  });

  cycleManager.incrementDecisions();

  if (decision.action === 'hold') {
    logger.info('Hold decision, no trade saga initiated', { decisionId: decision.decisionId });
    return;
  }

  if (decision.confidence < confidenceThreshold) {
    logger.info('Decision confidence below threshold', {
      decisionId: decision.decisionId,
      confidence: decision.confidence,
      threshold: confidenceThreshold,
    });
    return;
  }

  if (orchestratorMode === OrchestratorMode.MANUAL) {
    logger.info('Manual mode, decision stored for manual execution', { decisionId: decision.decisionId });
    return;
  }

  const sagaData: TradeExecutionSagaData = {
    decisionId: decision.decisionId,
    symbol: decision.symbol,
    action: decision.action,
  };

  const saga = await sagaCoordinator.startSaga(
    'trade-execution',
    ['validate-risk', 'submit-order', 'confirm-fill', 'update-position'],
    { ...sagaData }
  );

  pendingDecisionSagas.set(decision.decisionId, saga.sagaId);

  logger.info('Trade execution saga started', {
    sagaId: saga.sagaId,
    decisionId: decision.decisionId,
    symbol: decision.symbol,
    action: decision.action,
  });
}

async function handleOrderFilled(event: any): Promise<void> {
  const { orderId, symbol, side, filledQuantity, averagePrice } = event.payload;

  logger.info('Order filled event received', {
    orderId,
    symbol,
    side,
    filledQuantity,
    averagePrice,
  });

  for (const [decisionId, sagaId] of pendingDecisionSagas.entries()) {
    const saga = sagaCoordinator.getSagaStatus(sagaId);
    if (saga && saga.initialData.symbol === symbol) {
      await sagaCoordinator.advanceSaga(sagaId, {
        orderId,
        filledQuantity,
        averagePrice,
      });

      cycleManager.incrementTrades();
      pendingDecisionSagas.delete(decisionId);

      logger.info('Saga advanced on order fill', { sagaId, orderId });
      break;
    }
  }
}

async function handleOrderFailed(event: any): Promise<void> {
  const { orderId, symbol, reason } = event.payload;

  logger.warn('Order failed event received', { orderId, symbol, reason });

  for (const [decisionId, sagaId] of pendingDecisionSagas.entries()) {
    const saga = sagaCoordinator.getSagaStatus(sagaId);
    if (saga && saga.initialData.symbol === symbol) {
      await sagaCoordinator.compensateSaga(sagaId, `Order failed: ${reason}`);
      pendingDecisionSagas.delete(decisionId);

      logger.info('Saga compensated on order failure', { sagaId, orderId, reason });
      break;
    }
  }
}

async function initializeService(): Promise<void> {
  logger.info('Initializing service', { port: config.port });

  initTelemetry({
    serviceName: SERVICE_NAME,
    enabled: config.telemetry.enabled,
    endpoint: config.telemetry.endpoint,
  });

  cycleManager = createCycleManager({}, logger);
  sagaCoordinator = createSagaCoordinator(logger);

  eventBus = createEventBus(SERVICE_NAME);
  await eventBus.connect(config.nats.url);

  cycleManager.setEventBus(eventBus);
  sagaCoordinator.setEventBus(eventBus);

  logger.info('Event bus connected', { inMemory: eventBus.isInMemoryMode() });

  await eventBus.subscribe('ai.decision.generated', handleAIDecision);

  await eventBus.subscribe('trade.order.filled', handleOrderFilled);

  await eventBus.subscribe('trade.order.rejected', handleOrderFailed);

  await eventBus.subscribe('trade.order.canceled', async (event) => {
    logger.info('Order canceled', { orderId: event.payload.orderId });
  });

  healthChecker.registerCheck('eventbus', async () => ({
    status: eventBus.isConnected() ? 'pass' : 'fail',
    duration: 0,
    message: eventBus.isInMemoryMode() ? 'In-memory mode' : 'NATS connected',
    lastChecked: new Date().toISOString(),
  }));

  healthChecker.registerCheck('cycle', async () => {
    const status = cycleManager.getCycleStatus();
    return {
      status: 'pass',
      duration: 0,
      message: status.isRunning
        ? `Cycle ${status.cycle?.cycleId} running (${Math.round((status.uptime || 0) / 1000)}s)`
        : 'Idle',
      lastChecked: new Date().toISOString(),
    };
  });

  healthChecker.registerCheck('sagas', async () => {
    const activeSagas = sagaCoordinator.getActiveSagas();
    return {
      status: 'pass',
      duration: 0,
      message: `${activeSagas.length} active saga(s)`,
      lastChecked: new Date().toISOString(),
    };
  });
}

function createApp(): express.Express {
  const app = express();

  app.use(express.json());
  healthChecker.registerWithApp(app);

  app.get('/api/v1/status', (req: Request, res: Response) => {
    const cycleStatus = cycleManager.getCycleStatus();
    const activeSagas = sagaCoordinator.getActiveSagas();

    res.json({
      service: SERVICE_NAME,
      status: 'running',
      mode: orchestratorMode,
      cycle: cycleStatus,
      activeSagasCount: activeSagas.length,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/v1/cycles/start', async (req: Request, res: Response) => {
    try {
      const { symbols, cycleType } = req.body;
      const cycle = await cycleManager.startCycle(symbols, cycleType);

      res.json({
        success: true,
        cycleId: cycle.cycleId,
        status: cycle.status,
        symbols: cycle.symbols,
        startedAt: cycle.startedAt.toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start cycle';
      res.status(409).json({ success: false, error: message });
    }
  });

  app.post('/api/v1/cycles/stop', async (req: Request, res: Response) => {
    const cycle = await cycleManager.stopCycle();

    if (!cycle) {
      res.status(400).json({ success: false, error: 'No running cycle to stop' });
      return;
    }

    res.json({
      success: true,
      cycleId: cycle.cycleId,
      status: cycle.status,
      completedAt: cycle.completedAt?.toISOString(),
      decisionsCount: cycle.decisionsCount,
      tradesCount: cycle.tradesCount,
    });
  });

  app.post('/api/v1/cycles/pause', async (req: Request, res: Response) => {
    const cycle = cycleManager.pauseCycle();

    if (!cycle) {
      res.status(400).json({ success: false, error: 'No running cycle to pause' });
      return;
    }

    res.json({
      success: true,
      cycleId: cycle.cycleId,
      status: cycle.status,
    });
  });

  app.post('/api/v1/cycles/resume', async (req: Request, res: Response) => {
    const cycle = cycleManager.resumeCycle();

    if (!cycle) {
      res.status(400).json({ success: false, error: 'No paused cycle to resume' });
      return;
    }

    res.json({
      success: true,
      cycleId: cycle.cycleId,
      status: cycle.status,
    });
  });

  app.get('/api/v1/cycles/status', (req: Request, res: Response) => {
    const status = cycleManager.getCycleStatus();

    res.json({
      isRunning: status.isRunning,
      cycle: status.cycle
        ? {
            cycleId: status.cycle.cycleId,
            status: status.cycle.status,
            symbols: status.cycle.symbols,
            startedAt: status.cycle.startedAt.toISOString(),
            decisionsCount: status.cycle.decisionsCount,
            tradesCount: status.cycle.tradesCount,
            uptimeMs: status.uptime,
          }
        : null,
    });
  });

  app.get('/api/v1/cycles/history', (req: Request, res: Response) => {
    const history = cycleManager.getCycleHistory();

    res.json({
      count: history.length,
      cycles: history.map((c) => ({
        cycleId: c.cycleId,
        status: c.status,
        symbols: c.symbols,
        startedAt: c.startedAt.toISOString(),
        completedAt: c.completedAt?.toISOString(),
        decisionsCount: c.decisionsCount,
        tradesCount: c.tradesCount,
      })),
    });
  });

  app.get('/api/v1/sagas', (req: Request, res: Response) => {
    const { type, status } = req.query;
    let sagas = sagaCoordinator.getActiveSagas();

    if (type && typeof type === 'string') {
      sagas = sagas.filter((s) => s.type === type);
    }

    if (status && typeof status === 'string') {
      sagas = sagas.filter((s) => s.status === status);
    }

    res.json({
      count: sagas.length,
      sagas: sagas.map((s) => ({
        sagaId: s.sagaId,
        type: s.type,
        status: s.status,
        currentStep: s.currentStep,
        totalSteps: s.totalSteps,
        startedAt: s.startedAt.toISOString(),
        correlationId: s.correlationId,
      })),
    });
  });

  app.get('/api/v1/sagas/:sagaId', (req: Request, res: Response) => {
    const saga = sagaCoordinator.getSagaStatus(req.params.sagaId);

    if (!saga) {
      res.status(404).json({ error: 'Saga not found' });
      return;
    }

    res.json({
      sagaId: saga.sagaId,
      type: saga.type,
      status: saga.status,
      currentStep: saga.currentStep,
      totalSteps: saga.totalSteps,
      steps: saga.steps.map((step) => ({
        stepId: step.stepId,
        name: step.name,
        status: step.status,
        startedAt: step.startedAt?.toISOString(),
        completedAt: step.completedAt?.toISOString(),
        error: step.error,
      })),
      startedAt: saga.startedAt.toISOString(),
      completedAt: saga.completedAt?.toISOString(),
      error: saga.error,
      correlationId: saga.correlationId,
    });
  });

  app.get('/api/v1/strategies', (req: Request, res: Response) => {
    const { enabled } = req.query;
    let strategies = [...availableStrategies];

    if (enabled === 'true') {
      strategies = strategies.filter((s) => s.enabled);
    } else if (enabled === 'false') {
      strategies = strategies.filter((s) => !s.enabled);
    }

    res.json({
      count: strategies.length,
      strategies,
    });
  });

  app.get('/api/v1/strategies/:strategyId', (req: Request, res: Response) => {
    const strategy = availableStrategies.find((s) => s.id === req.params.strategyId);

    if (!strategy) {
      res.status(404).json({ error: 'Strategy not found' });
      return;
    }

    res.json(strategy);
  });

  app.get('/api/v1/mode', (req: Request, res: Response) => {
    res.json({
      mode: orchestratorMode,
      confidenceThreshold,
    });
  });

  app.post('/api/v1/mode', (req: Request, res: Response) => {
    const { mode } = req.body;

    if (!Object.values(OrchestratorMode).includes(mode)) {
      res.status(400).json({
        error: 'Invalid mode',
        validModes: Object.values(OrchestratorMode),
      });
      return;
    }

    const previousMode = orchestratorMode;
    orchestratorMode = mode;

    logger.info('Orchestrator mode changed', { previousMode, newMode: mode });

    res.json({
      success: true,
      previousMode,
      mode: orchestratorMode,
    });
  });

  return app;
}

async function main(): Promise<void> {
  try {
    await initializeService();

    const app = createApp();

    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`${SERVICE_NAME} listening on port ${config.port}`);
    });

    const shutdown = async () => {
      logger.info('Shutting down...');

      const cycleStatus = cycleManager.getCycleStatus();
      if (cycleStatus.isRunning) {
        logger.warn('Shutdown while cycle running', { cycleId: cycleStatus.cycle?.cycleId });
        await cycleManager.stopCycle();
      }

      sagaCoordinator.cleanup();
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
