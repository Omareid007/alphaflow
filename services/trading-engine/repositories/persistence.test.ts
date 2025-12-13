/**
 * AI Active Trader - Trading Engine Persistence Smoke Tests
 * Tests for order and position repository implementations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryOrderRepository,
  InMemoryPositionRepository,
  OrderEntity,
  PositionEntity,
} from './index';
import {
  DualWriteRepository,
  createDefaultDualWriteConfig,
  Repository,
} from '../../shared/repositories';

describe('Trading Engine Persistence', () => {
  describe('InMemoryOrderRepository', () => {
    let repo: InMemoryOrderRepository;

    beforeEach(() => {
      repo = new InMemoryOrderRepository();
    });

    it('should create and retrieve an order', async () => {
      const order = await repo.create({
        symbol: 'AAPL',
        side: 'buy',
        orderType: 'market',
        quantity: 10,
        limitPrice: null,
        stopPrice: null,
        filledQuantity: 0,
        filledPrice: null,
        status: 'pending',
        timeInForce: 'day',
        stopLoss: null,
        takeProfit: null,
        decisionId: null,
        strategyId: null,
        userId: null,
        broker: 'paper',
        fees: 0,
        slippage: null,
        errorMessage: null,
        submittedAt: new Date(),
        filledAt: null,
        canceledAt: null,
        externalId: null,
      });

      expect(order.id).toBeDefined();
      expect(order.symbol).toBe('AAPL');
      expect(order.quantity).toBe(10);

      const retrieved = await repo.findById(order.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(order.id);
    });

    it('should update order status', async () => {
      const order = await repo.create({
        symbol: 'MSFT',
        side: 'sell',
        orderType: 'limit',
        quantity: 5,
        limitPrice: 400,
        stopPrice: null,
        filledQuantity: 0,
        filledPrice: null,
        status: 'submitted',
        timeInForce: 'day',
        stopLoss: null,
        takeProfit: null,
        decisionId: null,
        strategyId: null,
        userId: null,
        broker: 'paper',
        fees: 0,
        slippage: null,
        errorMessage: null,
        submittedAt: new Date(),
        filledAt: null,
        canceledAt: null,
        externalId: null,
      });

      const updated = await repo.update(order.id, {
        status: 'filled',
        filledQuantity: 5,
        filledPrice: 401.5,
        filledAt: new Date(),
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe('filled');
      expect(updated?.filledQuantity).toBe(5);
      expect(updated?.filledPrice).toBe(401.5);
    });

    it('should delete an order', async () => {
      const order = await repo.create({
        symbol: 'TSLA',
        side: 'buy',
        orderType: 'market',
        quantity: 2,
        limitPrice: null,
        stopPrice: null,
        filledQuantity: 0,
        filledPrice: null,
        status: 'canceled',
        timeInForce: 'day',
        stopLoss: null,
        takeProfit: null,
        decisionId: null,
        strategyId: null,
        userId: null,
        broker: 'paper',
        fees: 0,
        slippage: null,
        errorMessage: null,
        submittedAt: new Date(),
        filledAt: null,
        canceledAt: new Date(),
        externalId: null,
      });

      const deleted = await repo.delete(order.id);
      expect(deleted).toBe(true);

      const retrieved = await repo.findById(order.id);
      expect(retrieved).toBeNull();
    });

    it('should list all orders with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.create({
          symbol: `SYM${i}`,
          side: 'buy',
          orderType: 'market',
          quantity: i + 1,
          limitPrice: null,
          stopPrice: null,
          filledQuantity: 0,
          filledPrice: null,
          status: 'pending',
          timeInForce: 'day',
          stopLoss: null,
          takeProfit: null,
          decisionId: null,
          strategyId: null,
          userId: null,
          broker: 'paper',
          fees: 0,
          slippage: null,
          errorMessage: null,
          submittedAt: new Date(),
          filledAt: null,
          canceledAt: null,
          externalId: null,
        });
      }

      const all = await repo.findAll();
      expect(all.length).toBe(5);

      const limited = await repo.findAll({ limit: 2 });
      expect(limited.length).toBe(2);

      const paginated = await repo.findAll({ limit: 2, offset: 2 });
      expect(paginated.length).toBe(2);
    });
  });

  describe('InMemoryPositionRepository', () => {
    let repo: InMemoryPositionRepository;

    beforeEach(() => {
      repo = new InMemoryPositionRepository();
    });

    it('should create and retrieve a position', async () => {
      const position = await repo.create({
        symbol: 'AAPL',
        side: 'long',
        quantity: 100,
        entryPrice: 185.50,
        currentPrice: 186.00,
        unrealizedPnl: 50,
        unrealizedPnlPercent: 0.27,
        realizedPnl: 0,
        totalFees: 1.50,
        stopLoss: 180,
        takeProfit: 195,
        trailingStop: null,
        strategyId: null,
        userId: null,
        broker: 'paper',
        status: 'open',
        entryOrderId: null,
        exitOrderId: null,
        closedAt: null,
      });

      expect(position.id).toBeDefined();
      expect(position.symbol).toBe('AAPL');
      expect(position.quantity).toBe(100);

      const retrieved = await repo.findById(position.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.entryPrice).toBe(185.50);
    });

    it('should update position with price changes', async () => {
      const position = await repo.create({
        symbol: 'GOOGL',
        side: 'long',
        quantity: 50,
        entryPrice: 140.00,
        currentPrice: 140.00,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        realizedPnl: 0,
        totalFees: 0,
        stopLoss: null,
        takeProfit: null,
        trailingStop: null,
        strategyId: null,
        userId: null,
        broker: 'paper',
        status: 'open',
        entryOrderId: null,
        exitOrderId: null,
        closedAt: null,
      });

      const newPrice = 145.00;
      const unrealizedPnl = (newPrice - position.entryPrice) * position.quantity;

      const updated = await repo.update(position.id, {
        currentPrice: newPrice,
        unrealizedPnl,
        unrealizedPnlPercent: (unrealizedPnl / (position.entryPrice * position.quantity)) * 100,
      });

      expect(updated?.currentPrice).toBe(145.00);
      expect(updated?.unrealizedPnl).toBe(250); // (145 - 140) * 50
    });

    it('should close a position', async () => {
      const position = await repo.create({
        symbol: 'TSLA',
        side: 'short',
        quantity: 10,
        entryPrice: 250.00,
        currentPrice: 245.00,
        unrealizedPnl: 50,
        unrealizedPnlPercent: 2,
        realizedPnl: 0,
        totalFees: 0,
        stopLoss: null,
        takeProfit: null,
        trailingStop: null,
        strategyId: null,
        userId: null,
        broker: 'paper',
        status: 'open',
        entryOrderId: null,
        exitOrderId: null,
        closedAt: null,
      });

      const closedAt = new Date();
      const updated = await repo.update(position.id, {
        status: 'closed',
        closedAt,
        realizedPnl: 50,
        currentPrice: 245.00,
      });

      expect(updated?.status).toBe('closed');
      expect(updated?.realizedPnl).toBe(50);
      expect(updated?.closedAt).toEqual(closedAt);
    });

    it('should find open position by symbol and side', () => {
      const repo = new InMemoryPositionRepository();

      const position: PositionEntity = {
        id: 'test-1',
        symbol: 'SPY',
        side: 'long',
        quantity: 100,
        entryPrice: 475,
        currentPrice: 476,
        unrealizedPnl: 100,
        unrealizedPnlPercent: 0.21,
        realizedPnl: 0,
        totalFees: 0,
        stopLoss: null,
        takeProfit: null,
        trailingStop: null,
        strategyId: null,
        userId: null,
        broker: 'paper',
        status: 'open',
        entryOrderId: null,
        exitOrderId: null,
        openedAt: new Date(),
        closedAt: null,
        lastUpdatedAt: new Date(),
      };

      (repo as any).positions.set('test-1', position);

      const found = repo.findOpenBySymbolAndSide('SPY', 'long');
      expect(found).toBeDefined();
      expect(found?.id).toBe('test-1');

      const notFound = repo.findOpenBySymbolAndSide('SPY', 'short');
      expect(notFound).toBeNull();
    });
  });

  describe('DualWriteRepository with Trading Repositories', () => {
    let legacyOrderRepo: InMemoryOrderRepository;
    let microserviceOrderRepo: InMemoryOrderRepository;
    let dualOrderRepo: DualWriteRepository<OrderEntity>;

    beforeEach(() => {
      legacyOrderRepo = new InMemoryOrderRepository();
      microserviceOrderRepo = new InMemoryOrderRepository();
      dualOrderRepo = new DualWriteRepository(
        legacyOrderRepo as Repository<OrderEntity>,
        microserviceOrderRepo as Repository<OrderEntity>,
        createDefaultDualWriteConfig({ enableDualWrite: true }),
        'Order'
      );
    });

    it('should dual-write orders to both repositories', async () => {
      const order = await dualOrderRepo.create({
        symbol: 'NVDA',
        side: 'buy',
        orderType: 'market',
        quantity: 25,
        limitPrice: null,
        stopPrice: null,
        filledQuantity: 0,
        filledPrice: null,
        status: 'pending',
        timeInForce: 'day',
        stopLoss: null,
        takeProfit: null,
        decisionId: 'dec-123',
        strategyId: 'strat-456',
        userId: null,
        broker: 'paper',
        fees: 0,
        slippage: null,
        errorMessage: null,
        submittedAt: new Date(),
        filledAt: null,
        canceledAt: null,
        externalId: null,
      });

      expect(order.symbol).toBe('NVDA');

      const legacyOrders = await legacyOrderRepo.findAll();
      const microserviceOrders = await microserviceOrderRepo.findAll();

      expect(legacyOrders.length).toBe(1);
      expect(microserviceOrders.length).toBe(1);

      expect(legacyOrders[0].symbol).toBe('NVDA');
      expect(microserviceOrders[0].symbol).toBe('NVDA');

      const metrics = dualOrderRepo.getMetrics();
      expect(metrics.legacyWrites).toBe(1);
      expect(metrics.microserviceWrites).toBe(1);
    });

    it('should read from primary source (legacy by default)', async () => {
      await legacyOrderRepo.create({
        symbol: 'AMD',
        side: 'buy',
        orderType: 'limit',
        quantity: 100,
        limitPrice: 150,
        stopPrice: null,
        filledQuantity: 0,
        filledPrice: null,
        status: 'submitted',
        timeInForce: 'gtc',
        stopLoss: null,
        takeProfit: null,
        decisionId: null,
        strategyId: null,
        userId: null,
        broker: 'paper',
        fees: 0,
        slippage: null,
        errorMessage: null,
        submittedAt: new Date(),
        filledAt: null,
        canceledAt: null,
        externalId: null,
      });

      const orders = await dualOrderRepo.findAll();
      expect(orders.length).toBe(1);
      expect(orders[0].symbol).toBe('AMD');

      const metrics = dualOrderRepo.getMetrics();
      expect(metrics.legacyReads).toBe(1);
    });

    it('should switch to microservice as primary source', async () => {
      dualOrderRepo.updateConfig({ primarySource: 'microservice', enableDualWrite: false });

      await microserviceOrderRepo.create({
        symbol: 'INTC',
        side: 'sell',
        orderType: 'market',
        quantity: 200,
        limitPrice: null,
        stopPrice: null,
        filledQuantity: 200,
        filledPrice: 48.50,
        status: 'filled',
        timeInForce: 'day',
        stopLoss: null,
        takeProfit: null,
        decisionId: null,
        strategyId: null,
        userId: null,
        broker: 'paper',
        fees: 1.00,
        slippage: 0.05,
        errorMessage: null,
        submittedAt: new Date(),
        filledAt: new Date(),
        canceledAt: null,
        externalId: 'ext-789',
      });

      const orders = await dualOrderRepo.findAll();
      expect(orders.length).toBe(1);
      expect(orders[0].symbol).toBe('INTC');

      const metrics = dualOrderRepo.getMetrics();
      expect(metrics.microserviceReads).toBe(1);
    });
  });

  describe('Position DualWrite Integration', () => {
    let legacyRepo: InMemoryPositionRepository;
    let microserviceRepo: InMemoryPositionRepository;
    let dualRepo: DualWriteRepository<PositionEntity>;

    beforeEach(() => {
      legacyRepo = new InMemoryPositionRepository();
      microserviceRepo = new InMemoryPositionRepository();
      dualRepo = new DualWriteRepository(
        legacyRepo as Repository<PositionEntity>,
        microserviceRepo as Repository<PositionEntity>,
        createDefaultDualWriteConfig({ enableDualWrite: true }),
        'Position'
      );
    });

    it('should create position in both repositories', async () => {
      const position = await dualRepo.create({
        symbol: 'QQQ',
        side: 'long',
        quantity: 50,
        entryPrice: 400.00,
        currentPrice: 402.50,
        unrealizedPnl: 125,
        unrealizedPnlPercent: 0.625,
        realizedPnl: 0,
        totalFees: 0.50,
        stopLoss: 395,
        takeProfit: 420,
        trailingStop: null,
        strategyId: 'momentum-1',
        userId: 'user-1',
        broker: 'paper',
        status: 'open',
        entryOrderId: 'ord-1',
        exitOrderId: null,
        closedAt: null,
      } as any);

      expect(position.symbol).toBe('QQQ');

      const legacyPositions = await legacyRepo.findAll();
      const microservicePositions = await microserviceRepo.findAll();

      expect(legacyPositions.length).toBe(1);
      expect(microservicePositions.length).toBe(1);

      const metrics = dualRepo.getMetrics();
      expect(metrics.legacyWrites).toBe(1);
      expect(metrics.microserviceWrites).toBe(1);
    });

    it('should update position in both repositories when dual-write enabled', async () => {
      const position = await dualRepo.create({
        symbol: 'IWM',
        side: 'long',
        quantity: 100,
        entryPrice: 200.00,
        currentPrice: 200.00,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        realizedPnl: 0,
        totalFees: 0,
        stopLoss: null,
        takeProfit: null,
        trailingStop: null,
        strategyId: null,
        userId: null,
        broker: 'paper',
        status: 'open',
        entryOrderId: null,
        exitOrderId: null,
        closedAt: null,
      } as any);

      dualRepo.resetMetrics();

      const updated = await dualRepo.update(position.id, {
        currentPrice: 205.00,
        unrealizedPnl: 500,
      });

      expect(updated?.currentPrice).toBe(205.00);

      const metrics = dualRepo.getMetrics();
      expect(metrics.legacyWrites).toBe(1);
      expect(metrics.microserviceWrites).toBe(1);
    });
  });
});
