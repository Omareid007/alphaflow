/**
 * AI Active Trader - Trading Engine Service
 * Handles order execution, position management, and risk enforcement
 */

import express, { Request, Response } from 'express';
import { createEventBus, EventBusClient } from '../shared/events';
import { createLogger, loadServiceConfig, createHealthChecker, initTelemetry } from '../shared/common';
import { OrderManager } from './order-manager';
import { PositionManager } from './position-manager';
import { RiskManager } from './risk-manager';
import { OrderRequest, OrderStatus } from './types';

const SERVICE_NAME = 'trading-engine';
const config = loadServiceConfig(SERVICE_NAME);
const logger = createLogger(SERVICE_NAME, config.logLevel);
const healthChecker = createHealthChecker(SERVICE_NAME, '1.0.0');

let eventBus: EventBusClient;
const orderManager = new OrderManager();
const positionManager = new PositionManager();
const riskManager = new RiskManager();

riskManager.setPositionManager(positionManager);

async function initializeService(): Promise<void> {
  logger.info('Initializing service', { port: config.port });

  initTelemetry({
    serviceName: SERVICE_NAME,
    enabled: config.telemetry.enabled,
    endpoint: config.telemetry.endpoint,
  });

  eventBus = createEventBus(SERVICE_NAME);
  await eventBus.connect(config.nats.url);
  
  orderManager.setEventBus(eventBus);
  positionManager.setEventBus(eventBus);
  
  logger.info('Event bus connected', { inMemory: eventBus.isInMemoryMode() });

  await eventBus.subscribe('ai.decision.generated', async (event) => {
    logger.info('Received AI decision', { 
      decisionId: event.payload.decisionId,
      symbol: event.payload.symbol,
      action: event.payload.action,
      confidence: event.payload.confidence,
    });

    if (event.payload.action === 'hold') {
      logger.info('AI decision is HOLD, skipping trade', { decisionId: event.payload.decisionId });
      return;
    }

    if (event.payload.confidence < 0.6) {
      logger.info('AI confidence too low, skipping trade', { 
        decisionId: event.payload.decisionId,
        confidence: event.payload.confidence,
      });
      return;
    }

    const orderRequest: OrderRequest = {
      symbol: event.payload.symbol,
      side: event.payload.action === 'buy' ? 'buy' : 'sell',
      quantity: 1,
      orderType: 'market',
      decisionId: event.payload.decisionId,
    };

    const riskCheck = riskManager.checkPreTradeRisk(orderRequest);
    if (!riskCheck.allowed) {
      logger.warn('Risk check failed for AI decision', { 
        decisionId: event.payload.decisionId,
        reason: riskCheck.reason,
      });
      return;
    }

    const result = await orderManager.submitOrder(orderRequest);
    logger.info('Order submitted from AI decision', { 
      decisionId: event.payload.decisionId,
      orderId: result.orderId,
      success: result.success,
    });

    if (result.success && result.status === OrderStatus.FILLED && result.filledPrice) {
      await positionManager.openPosition(
        orderRequest.symbol,
        orderRequest.side === 'buy' ? 'long' : 'short',
        orderRequest.quantity,
        result.filledPrice
      );

      const orderValue = orderRequest.quantity * result.filledPrice;
      const cashDelta = orderRequest.side === 'buy' ? -orderValue : orderValue;
      riskManager.updatePortfolioSnapshot({
        cashBalance: riskManager.getPortfolioSnapshot().cashBalance + cashDelta,
        positionsValue: positionManager.getTotalExposure(),
        totalEquity: riskManager.getPortfolioSnapshot().totalEquity + (orderRequest.side === 'sell' ? orderValue : 0),
      });
    }
  });

  await eventBus.subscribe('orchestrator.cycle.started', async (event) => {
    logger.info('Orchestrator cycle started', { 
      cycleId: event.payload.cycleId,
      cycleType: event.payload.cycleType,
      symbols: event.payload.symbols,
    });
  });

  healthChecker.registerCheck('eventbus', async () => ({
    status: eventBus.isConnected() ? 'pass' : 'fail',
    duration: 0,
    message: eventBus.isInMemoryMode() ? 'In-memory mode' : 'NATS connected',
    lastChecked: new Date().toISOString(),
  }));

  healthChecker.registerCheck('order-manager', async () => ({
    status: 'pass',
    duration: 0,
    message: `Active orders: ${orderManager.getActiveOrders().length}`,
    lastChecked: new Date().toISOString(),
  }));

  healthChecker.registerCheck('position-manager', async () => ({
    status: 'pass',
    duration: 0,
    message: `Open positions: ${positionManager.getPositionCount()}`,
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
      stats: {
        activeOrders: orderManager.getActiveOrders().length,
        totalOrders: orderManager.getAllOrders().length,
        openPositions: positionManager.getPositionCount(),
        totalExposure: positionManager.getTotalExposure(),
        unrealizedPnl: positionManager.getTotalUnrealizedPnl(),
      },
    });
  });

  app.post('/api/v1/orders', async (req: Request, res: Response) => {
    try {
      const { symbol, side, quantity, orderType, limitPrice, stopLoss, takeProfit, timeInForce } = req.body;

      if (!symbol || !side || !quantity || !orderType) {
        res.status(400).json({ 
          error: 'Missing required fields', 
          required: ['symbol', 'side', 'quantity', 'orderType'] 
        });
        return;
      }

      if (!['buy', 'sell'].includes(side)) {
        res.status(400).json({ error: 'Side must be "buy" or "sell"' });
        return;
      }

      if (!['market', 'limit'].includes(orderType)) {
        res.status(400).json({ error: 'OrderType must be "market" or "limit"' });
        return;
      }

      if (orderType === 'limit' && !limitPrice) {
        res.status(400).json({ error: 'Limit orders require a limitPrice' });
        return;
      }

      const orderRequest: OrderRequest = {
        symbol,
        side,
        quantity: Number(quantity),
        orderType,
        limitPrice: limitPrice ? Number(limitPrice) : undefined,
        stopLoss: stopLoss ? Number(stopLoss) : undefined,
        takeProfit: takeProfit ? Number(takeProfit) : undefined,
        timeInForce,
      };

      const riskCheck = riskManager.checkPreTradeRisk(orderRequest);
      if (!riskCheck.allowed) {
        res.status(422).json({ 
          error: 'Risk check failed', 
          reason: riskCheck.reason 
        });
        return;
      }

      const result = await orderManager.submitOrder(orderRequest);

      if (result.success && result.status === OrderStatus.FILLED && result.filledPrice) {
        await positionManager.openPosition(
          orderRequest.symbol,
          orderRequest.side === 'buy' ? 'long' : 'short',
          orderRequest.quantity,
          result.filledPrice
        );

        const orderValue = orderRequest.quantity * result.filledPrice;
        const cashDelta = orderRequest.side === 'buy' ? -orderValue : orderValue;
        riskManager.updatePortfolioSnapshot({
          cashBalance: riskManager.getPortfolioSnapshot().cashBalance + cashDelta,
          positionsValue: positionManager.getTotalExposure(),
          totalEquity: riskManager.getPortfolioSnapshot().totalEquity + (orderRequest.side === 'sell' ? orderValue : 0),
        });
      }

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      logger.error('Order submission error', error instanceof Error ? error : undefined);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/v1/orders/:orderId', async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const result = await orderManager.cancelOrder(orderId);
      
      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }

      res.json({ success: true, orderId, message: 'Order canceled' });
    } catch (error) {
      logger.error('Order cancellation error', error instanceof Error ? error : undefined);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/v1/orders', (req: Request, res: Response) => {
    const { status } = req.query;
    
    let orders;
    if (status === 'active') {
      orders = orderManager.getActiveOrders();
    } else {
      orders = orderManager.getAllOrders();
    }

    res.json({ 
      orders,
      count: orders.length,
    });
  });

  app.get('/api/v1/orders/:orderId', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const order = orderManager.getOrder(orderId);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json(order);
  });

  app.get('/api/v1/positions', (req: Request, res: Response) => {
    const { symbol } = req.query;
    
    let positions;
    if (symbol && typeof symbol === 'string') {
      positions = positionManager.getPositionsBySymbol(symbol);
    } else {
      positions = positionManager.getAllPositions();
    }

    res.json({ 
      positions,
      count: positions.length,
      totalExposure: positionManager.getTotalExposure(),
      unrealizedPnl: positionManager.getTotalUnrealizedPnl(),
    });
  });

  app.get('/api/v1/positions/:positionId', (req: Request, res: Response) => {
    const { positionId } = req.params;
    const position = positionManager.getPosition(positionId);

    if (!position) {
      res.status(404).json({ error: 'Position not found' });
      return;
    }

    res.json(position);
  });

  app.post('/api/v1/positions/:positionId/close', async (req: Request, res: Response) => {
    try {
      const { positionId } = req.params;
      const { exitPrice } = req.body;

      const result = await positionManager.closePosition(
        positionId, 
        exitPrice ? Number(exitPrice) : undefined
      );

      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }

      res.json({ 
        success: true, 
        positionId, 
        realizedPnl: result.realizedPnl,
        message: 'Position closed' 
      });
    } catch (error) {
      logger.error('Position close error', error instanceof Error ? error : undefined);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/v1/risk/limits', (req: Request, res: Response) => {
    res.json(riskManager.getRiskLimits());
  });

  app.put('/api/v1/risk/limits', (req: Request, res: Response) => {
    const { maxPositionSizePercent, maxTotalExposurePercent, maxPositionsCount, dailyLossLimitPercent } = req.body;
    
    riskManager.updateRiskLimits({
      maxPositionSizePercent,
      maxTotalExposurePercent,
      maxPositionsCount,
      dailyLossLimitPercent,
    });

    res.json(riskManager.getRiskLimits());
  });

  app.post('/api/v1/risk/check', (req: Request, res: Response) => {
    const { symbol, side, quantity, orderType, limitPrice } = req.body;

    if (!symbol || !side || !quantity || !orderType) {
      res.status(400).json({ 
        error: 'Missing required fields',
        required: ['symbol', 'side', 'quantity', 'orderType'],
      });
      return;
    }

    const result = riskManager.checkPreTradeRisk({
      symbol,
      side,
      quantity: Number(quantity),
      orderType,
      limitPrice: limitPrice ? Number(limitPrice) : undefined,
    });

    res.json(result);
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
