/**
 * AI Active Trader - Analytics Service
 * Handles P&L calculations, metrics, equity curves, and risk analysis
 */

import express, { Request, Response } from 'express';
import { createEventBus, EventBusClient } from '../shared/events';
import { createLogger, loadServiceConfig, createHealthChecker, initTelemetry } from '../shared/common';
import { analyticsEngine } from './engine';
import { StoredTrade, StoredPosition } from './types';

const SERVICE_NAME = 'analytics';
const config = loadServiceConfig(SERVICE_NAME);
const logger = createLogger(SERVICE_NAME, config.logLevel);
const healthChecker = createHealthChecker(SERVICE_NAME, '1.0.0');

let eventBus: EventBusClient;

async function publishPnLCalculated(): Promise<void> {
  const pnl = analyticsEngine.calculatePnL();
  
  try {
    await eventBus.publish('analytics.pnl.calculated', {
      portfolioId: 'default',
      realizedPnl: pnl.realizedPnl,
      unrealizedPnl: pnl.unrealizedPnl,
      totalPnl: pnl.totalPnl,
      dailyReturn: pnl.dailyPnl,
      calculatedAt: pnl.calculatedAt,
    });
    logger.debug('Published P&L calculated event', { totalPnl: pnl.totalPnl });
  } catch (error) {
    logger.error('Failed to publish P&L event', error instanceof Error ? error : undefined);
  }
}

async function publishMetricsSnapshot(): Promise<void> {
  const state = analyticsEngine.getState();
  const positionsValue = Array.from(state.openPositions.values()).reduce(
    (sum, p) => sum + p.quantity * p.currentPrice,
    0
  );

  try {
    await eventBus.publish('analytics.snapshot.created', {
      snapshotId: `snap_${Date.now()}`,
      portfolioValue: state.cashBalance + positionsValue,
      cashBalance: state.cashBalance,
      positionCount: state.openPositions.size,
      buyingPower: state.cashBalance,
      createdAt: new Date().toISOString(),
    });
    logger.debug('Published metrics snapshot event');
  } catch (error) {
    logger.error('Failed to publish snapshot event', error instanceof Error ? error : undefined);
  }
}

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

  await eventBus.subscribe('trade.order.filled', async (event) => {
    logger.info('Recording filled order for analytics', { 
      orderId: event.payload.orderId,
      symbol: event.payload.symbol,
    });

    const trade: StoredTrade = {
      tradeId: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      orderId: event.payload.orderId,
      symbol: event.payload.symbol,
      side: event.payload.side,
      quantity: event.payload.filledQuantity,
      price: event.payload.averagePrice,
      commission: event.payload.commission,
      pnl: null,
      filledAt: event.payload.filledAt,
    };

    analyticsEngine.recordTrade(trade);
    await publishPnLCalculated();
  });

  await eventBus.subscribe('trade.position.opened', async (event) => {
    logger.info('Recording opened position', { 
      positionId: event.payload.positionId,
      symbol: event.payload.symbol,
    });

    const position: StoredPosition = {
      positionId: event.payload.positionId,
      symbol: event.payload.symbol,
      side: event.payload.side,
      quantity: event.payload.quantity,
      entryPrice: event.payload.entryPrice,
      currentPrice: event.payload.entryPrice,
      openedAt: event.payload.openedAt,
      updatedAt: event.payload.openedAt,
    };

    analyticsEngine.openPosition(position);
    await publishMetricsSnapshot();
  });

  await eventBus.subscribe('trade.position.closed', async (event) => {
    logger.info('Recording closed position', { 
      positionId: event.payload.positionId,
      realizedPnl: event.payload.realizedPnl,
    });

    analyticsEngine.closePosition(
      event.payload.positionId,
      event.payload.exitPrice,
      event.payload.realizedPnl,
      event.payload.closedAt
    );

    await publishPnLCalculated();
    await publishMetricsSnapshot();
  });

  await eventBus.subscribe('trade.position.updated', async (event) => {
    logger.debug('Updating position price', { 
      positionId: event.payload.positionId,
      currentPrice: event.payload.currentPrice,
    });

    analyticsEngine.updatePosition(
      event.payload.positionId,
      event.payload.currentPrice
    );
  });

  healthChecker.registerCheck('eventbus', async () => ({
    status: eventBus.isConnected() ? 'pass' : 'fail',
    duration: 0,
    message: eventBus.isInMemoryMode() ? 'In-memory mode' : 'NATS connected',
    lastChecked: new Date().toISOString(),
  }));

  healthChecker.registerCheck('analytics-engine', async () => ({
    status: 'pass',
    duration: 0,
    message: `Tracking ${analyticsEngine.getState().openPositions.size} positions`,
    lastChecked: new Date().toISOString(),
  }));
}

function createApp(): express.Express {
  const app = express();
  
  app.use(express.json());
  healthChecker.registerWithApp(app);

  app.get('/api/v1/status', (req: Request, res: Response) => {
    const state = analyticsEngine.getState();
    res.json({
      service: SERVICE_NAME,
      status: 'running',
      timestamp: new Date().toISOString(),
      stats: {
        openPositions: state.openPositions.size,
        closedPositions: state.closedPositions.length,
        totalTrades: state.trades.length,
        equityPoints: state.equityCurve.length,
      },
    });
  });

  app.get('/api/v1/pnl', async (req: Request, res: Response) => {
    try {
      const pnl = analyticsEngine.calculatePnL();
      res.json({
        success: true,
        data: pnl,
      });
    } catch (error) {
      logger.error('Failed to calculate P&L', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate P&L',
      });
    }
  });

  app.get('/api/v1/equity-curve', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const equityCurve = analyticsEngine.calculateEquityCurve(limit);
      res.json({
        success: true,
        data: equityCurve,
        count: equityCurve.length,
      });
    } catch (error) {
      logger.error('Failed to get equity curve', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: 'Failed to get equity curve',
      });
    }
  });

  app.get('/api/v1/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = analyticsEngine.calculateMetrics();
      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Failed to calculate metrics', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate metrics',
      });
    }
  });

  app.get('/api/v1/positions', async (req: Request, res: Response) => {
    try {
      const positions = analyticsEngine.getPositionSummaries();
      res.json({
        success: true,
        data: positions,
        count: positions.length,
      });
    } catch (error) {
      logger.error('Failed to get positions', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: 'Failed to get positions',
      });
    }
  });

  app.get('/api/v1/risk', async (req: Request, res: Response) => {
    try {
      const pnl = analyticsEngine.calculatePnL();
      const metrics = analyticsEngine.calculateMetrics();
      const positions = analyticsEngine.getPositionSummaries();
      const state = analyticsEngine.getState();

      const totalExposure = positions.reduce(
        (sum, p) => sum + Math.abs(p.quantity * p.currentPrice),
        0
      );
      const totalEquity = state.cashBalance + positions.reduce(
        (sum, p) => sum + p.quantity * p.currentPrice,
        0
      );
      const exposurePercent = totalEquity > 0 ? (totalExposure / totalEquity) * 100 : 0;

      const riskData = {
        totalExposure,
        exposurePercent,
        cashBalance: state.cashBalance,
        openPositionCount: positions.length,
        largestPosition: positions.length > 0
          ? Math.max(...positions.map((p) => Math.abs(p.quantity * p.currentPrice)))
          : 0,
        drawdown: pnl.totalPnl < 0 ? Math.abs(pnl.totalPnl) : 0,
        winRate: pnl.winRate,
        profitFactor: metrics.profitFactor,
        calculatedAt: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: riskData,
      });
    } catch (error) {
      logger.error('Failed to calculate risk', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate risk',
      });
    }
  });

  app.post('/api/v1/reset', async (req: Request, res: Response) => {
    try {
      const initialBalance = req.body.initialBalance || 100000;
      analyticsEngine.reset(initialBalance);
      logger.info('Analytics engine reset', { initialBalance });
      res.json({
        success: true,
        message: 'Analytics engine reset successfully',
        initialBalance,
      });
    } catch (error) {
      logger.error('Failed to reset engine', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: 'Failed to reset analytics engine',
      });
    }
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
