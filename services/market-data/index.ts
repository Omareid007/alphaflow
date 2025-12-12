/**
 * AI Active Trader - Market Data Service
 * Handles market data ingestion from Alpaca, Finnhub, Polygon, and other sources
 */

import express, { Request, Response } from 'express';
import { createEventBus, EventBusClient } from '../shared/events';
import { createLogger, loadServiceConfig, createHealthChecker, initTelemetry } from '../shared/common';
import { FinnhubConnector } from './connectors/finnhub';

const SERVICE_NAME = 'market-data';
const config = loadServiceConfig(SERVICE_NAME);
const logger = createLogger(SERVICE_NAME, config.logLevel);
const healthChecker = createHealthChecker(SERVICE_NAME, '1.0.0');

let eventBus: EventBusClient;
let finnhubConnector: FinnhubConnector;

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

  finnhubConnector = new FinnhubConnector(eventBus);

  await setupEventSubscriptions();

  healthChecker.registerCheck('eventbus', async () => ({
    status: eventBus.isConnected() ? 'pass' : 'fail',
    duration: 0,
    message: eventBus.isInMemoryMode() ? 'In-memory mode' : 'NATS connected',
    lastChecked: new Date().toISOString(),
  }));

  healthChecker.registerCheck('finnhub', async () => {
    const status = finnhubConnector.getConnectionStatus();
    return {
      status: status.hasApiKey ? 'pass' : 'warn',
      duration: 0,
      message: status.hasApiKey ? 'Finnhub API key configured' : 'No Finnhub API key',
      lastChecked: new Date().toISOString(),
    };
  });
}

async function setupEventSubscriptions(): Promise<void> {
  logger.info('Setting up event subscriptions');
}

function createApp(): express.Express {
  const app = express();
  
  app.use(express.json());
  healthChecker.registerWithApp(app);

  app.get('/api/v1/status', (req: Request, res: Response) => {
    const finnhubStatus = finnhubConnector.getConnectionStatus();
    res.json({
      service: SERVICE_NAME,
      status: 'running',
      timestamp: new Date().toISOString(),
      connectors: {
        finnhub: finnhubStatus,
      },
    });
  });

  app.get('/api/v1/quotes/:symbol', async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || symbol.length > 10) {
      res.status(400).json({ error: 'Invalid symbol parameter' });
      return;
    }

    try {
      const quote = await finnhubConnector.getQuote(symbol);
      res.json({
        success: true,
        data: quote,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to fetch quote', error instanceof Error ? error : undefined, { symbol });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch quote',
      });
    }
  });

  app.get('/api/v1/bars/:symbol', async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const { resolution = 'D', from, to } = req.query;

    if (!symbol || symbol.length > 10) {
      res.status(400).json({ error: 'Invalid symbol parameter' });
      return;
    }

    try {
      const bars = await finnhubConnector.getCandles(
        symbol,
        String(resolution),
        from ? Number(from) : undefined,
        to ? Number(to) : undefined
      );
      res.json({
        success: true,
        data: bars,
        count: bars.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to fetch bars', error instanceof Error ? error : undefined, { symbol });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch bars',
      });
    }
  });

  app.get('/api/v1/news/:symbol', async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || symbol.length > 20) {
      res.status(400).json({ error: 'Invalid symbol parameter' });
      return;
    }

    try {
      const news = await finnhubConnector.getNews(symbol === 'general' ? undefined : symbol);
      res.json({
        success: true,
        data: news,
        count: news.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to fetch news', error instanceof Error ? error : undefined, { symbol });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch news',
      });
    }
  });

  app.get('/api/v1/profile/:symbol', async (req: Request, res: Response) => {
    const { symbol } = req.params;

    if (!symbol || symbol.length > 10) {
      res.status(400).json({ error: 'Invalid symbol parameter' });
      return;
    }

    try {
      const profile = await finnhubConnector.getCompanyProfile(symbol);
      res.json({
        success: true,
        data: profile,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to fetch profile', error instanceof Error ? error : undefined, { symbol });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
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
