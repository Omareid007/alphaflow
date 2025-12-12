/**
 * AI Active Trader - AI Decision Service
 * Handles LLM routing, data fusion, prompt engineering, and calibration
 */

import express, { Request, Response } from 'express';
import { createEventBus, EventBusClient } from '../shared/events';
import { createLogger, loadServiceConfig, createHealthChecker, initTelemetry } from '../shared/common';
import { analyzeSymbol, analyzeRequest } from './decision-engine';
import { llmRouter } from './llm-router';
import { AIDecision, AnalysisRequest } from './types';

const SERVICE_NAME = 'ai-decision';
const config = loadServiceConfig(SERVICE_NAME);
const logger = createLogger(SERVICE_NAME, config.logLevel);
const healthChecker = createHealthChecker(SERVICE_NAME, '1.0.0');

let eventBus: EventBusClient;

const recentDecisions: AIDecision[] = [];
const MAX_DECISIONS = 100;

function storeDecision(decision: AIDecision): void {
  recentDecisions.unshift(decision);
  if (recentDecisions.length > MAX_DECISIONS) {
    recentDecisions.pop();
  }
}

async function publishDecision(decision: AIDecision): Promise<void> {
  try {
    await eventBus.publish('ai.decision.generated', {
      decisionId: decision.decisionId,
      symbol: decision.symbol,
      action: decision.action,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      alternatives: [],
      dataQuality: decision.confidence,
      modelUsed: decision.modelUsed,
      generatedAt: decision.generatedAt,
    });
    logger.info('Decision published', { decisionId: decision.decisionId, symbol: decision.symbol });
  } catch (error) {
    logger.error('Failed to publish decision', error instanceof Error ? error : undefined, {
      decisionId: decision.decisionId,
    });
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

  await eventBus.subscribe('ai.analysis.requested', async (event) => {
    logger.info('Received analysis request', { 
      requestId: event.payload.requestId,
      symbol: event.payload.symbol,
      type: event.payload.analysisType,
    });

    try {
      const decision = await analyzeSymbol(event.payload.symbol);
      storeDecision(decision);
      await publishDecision(decision);
    } catch (error) {
      logger.error('Failed to process analysis request', error instanceof Error ? error : undefined, {
        requestId: event.payload.requestId,
        symbol: event.payload.symbol,
      });
    }
  });

  await eventBus.subscribe('orchestrator.analysis.requested', async (event: any) => {
    logger.info('Received orchestrator analysis request', { 
      symbol: event.payload?.symbol,
    });

    try {
      const symbol = event.payload?.symbol || event.payload?.symbols?.[0];
      if (symbol) {
        const decision = await analyzeSymbol(symbol);
        storeDecision(decision);
        await publishDecision(decision);
      }
    } catch (error) {
      logger.error('Failed to process orchestrator request', error instanceof Error ? error : undefined);
    }
  });

  healthChecker.registerCheck('eventbus', async () => ({
    status: eventBus.isConnected() ? 'pass' : 'fail',
    duration: 0,
    message: eventBus.isInMemoryMode() ? 'In-memory mode' : 'NATS connected',
    lastChecked: new Date().toISOString(),
  }));

  healthChecker.registerCheck('llm-providers', async () => {
    const available = llmRouter.getAvailableProviders();
    return {
      status: available.length > 0 ? 'pass' : 'warn',
      duration: 0,
      message: `${available.length} LLM provider(s) available`,
      lastChecked: new Date().toISOString(),
    };
  });
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
      decisionsGenerated: recentDecisions.length,
      llmProviders: llmRouter.getAvailableProviders().length,
    });
  });

  app.post('/api/v1/analyze', async (req: Request, res: Response) => {
    try {
      const { symbol, marketData, newsContext, strategyContext } = req.body as AnalysisRequest;

      if (!symbol || typeof symbol !== 'string') {
        res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Symbol is required and must be a string' 
        });
        return;
      }

      logger.info('API analysis request received', { symbol });

      const decision = await analyzeRequest({
        symbol,
        marketData,
        newsContext,
        strategyContext,
      });

      storeDecision(decision);
      await publishDecision(decision);

      res.json({
        success: true,
        decision,
      });
    } catch (error) {
      logger.error('Analysis failed', error instanceof Error ? error : undefined);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to analyze symbol' 
      });
    }
  });

  app.get('/api/v1/decisions', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, MAX_DECISIONS);
    const symbol = req.query.symbol as string | undefined;
    const action = req.query.action as string | undefined;

    let filtered = [...recentDecisions];

    if (symbol) {
      filtered = filtered.filter(d => d.symbol.toUpperCase() === symbol.toUpperCase());
    }

    if (action && ['buy', 'sell', 'hold'].includes(action)) {
      filtered = filtered.filter(d => d.action === action);
    }

    res.json({
      decisions: filtered.slice(0, limit),
      total: filtered.length,
      limit,
      filters: { symbol: symbol || null, action: action || null },
    });
  });

  app.get('/api/v1/decisions/:decisionId', async (req: Request, res: Response) => {
    const { decisionId } = req.params;
    const decision = recentDecisions.find(d => d.decisionId === decisionId);

    if (!decision) {
      res.status(404).json({ 
        error: 'Not Found', 
        message: 'Decision not found' 
      });
      return;
    }

    res.json({ decision });
  });

  app.get('/api/v1/models', async (req: Request, res: Response) => {
    const allProviders = llmRouter.getAllProviders();
    const bestProvider = llmRouter.selectBestProvider();

    res.json({
      providers: allProviders.map(p => ({
        name: p.name,
        available: p.available,
        defaultModel: p.defaultModel,
        costTier: p.costTier,
        speedTier: p.speedTier,
        qualityTier: p.qualityTier,
      })),
      activeProvider: bestProvider ? {
        name: bestProvider.name,
        model: bestProvider.defaultModel,
      } : null,
      availableCount: allProviders.filter(p => p.available).length,
      totalCount: allProviders.length,
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
