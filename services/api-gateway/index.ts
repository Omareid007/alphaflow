/**
 * AI Active Trader - API Gateway Service
 * Handles authentication, rate limiting, routing, and request aggregation
 */

import express, { Request, Response, NextFunction } from 'express';
import { createEventBus, EventBusClient } from '../shared/events';
import { createLogger, loadServiceConfig, createHealthChecker, initTelemetry } from '../shared/common';

const SERVICE_NAME = 'api-gateway';
const config = loadServiceConfig(SERVICE_NAME);
const logger = createLogger(SERVICE_NAME, config.logLevel);
const healthChecker = createHealthChecker(SERVICE_NAME, '1.0.0');

let eventBus: EventBusClient;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RouteConfig {
  path: string;
  methods: string[];
  target: string;
  rateLimit?: { requests: number; windowMs: number };
  requiresAuth?: boolean;
}

const ROUTES: RouteConfig[] = [
  { path: '/api/v1/market', methods: ['GET'], target: 'market-data', rateLimit: { requests: 100, windowMs: 60000 } },
  { path: '/api/v1/trades', methods: ['GET', 'POST'], target: 'trading-engine', requiresAuth: true },
  { path: '/api/v1/positions', methods: ['GET'], target: 'trading-engine', requiresAuth: true },
  { path: '/api/v1/decisions', methods: ['GET'], target: 'ai-decision', requiresAuth: true },
  { path: '/api/v1/analytics', methods: ['GET'], target: 'analytics', requiresAuth: true },
  { path: '/api/v1/strategies', methods: ['GET', 'POST', 'PUT', 'DELETE'], target: 'orchestrator', requiresAuth: true },
];

const rateLimitStore = new Map<string, RateLimitEntry>();

function getRateLimitKey(req: Request): string {
  const userId = (req as any).userId || 'anonymous';
  const ip = req.ip || 'unknown';
  return `${userId}:${ip}:${req.path}`;
}

function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
    return { allowed: true, remaining: limit - 1, resetAt: entry.resetAt };
  }

  entry.count++;
  const allowed = entry.count <= limit;
  return { allowed, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupRateLimits, 60000);

function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = (req as any).requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}

async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Simple token validation - in production use JWT with proper verification
    // For now, just check if token exists and has minimum length
    if (token.length < 10) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Derive user ID from token (placeholder for proper JWT decoding)
    (req as any).userId = 'user_' + token.substring(0, 8);
    next();
  } catch (error) {
    logger.error('Auth error', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Authentication error' });
  }
}

function rateLimitMiddleware(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = getRateLimitKey(req);
    const result = checkRateLimit(key, limit, windowMs);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
      return;
    }

    next();
  };
}

function findRoute(path: string, method: string): RouteConfig | undefined {
  return ROUTES.find(route => 
    path.startsWith(route.path) && 
    route.methods.includes(method.toUpperCase())
  );
}

async function proxyHandler(req: Request, res: Response): Promise<void> {
  const route = findRoute(req.path, req.method);

  if (!route) {
    res.status(404).json({ error: 'Route not found' });
    return;
  }

  const requestId = (req as any).requestId;

  // Publish routing event for observability
  try {
    await eventBus.publish('system.health.check', {
      service: route.target,
      status: 'healthy',
      uptime: 0,
      memory: { used: 0, total: 1 },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('Failed to publish routing event', { requestId, target: route.target });
  }

  // In full implementation, this would proxy to the actual service
  // For now, return a placeholder response indicating the route was found
  res.json({
    gateway: SERVICE_NAME,
    targetService: route.target,
    path: req.path,
    method: req.method,
    requestId,
    message: 'Route configured, service routing pending full microservices deployment',
    timestamp: new Date().toISOString(),
  });
}

async function initializeService(): Promise<void> {
  logger.info('Initializing API Gateway', { port: config.port });

  initTelemetry({
    serviceName: SERVICE_NAME,
    enabled: config.telemetry.enabled,
    endpoint: config.telemetry.endpoint,
  });

  eventBus = createEventBus(SERVICE_NAME);
  await eventBus.connect(config.nats.url);
  logger.info('Event bus connected', { inMemory: eventBus.isInMemoryMode() });

  healthChecker.registerCheck('eventbus', async () => ({
    status: eventBus.isConnected() ? 'pass' : 'warn',
    duration: 0,
    message: eventBus.isInMemoryMode() ? 'In-memory mode' : 'NATS connected',
    lastChecked: new Date().toISOString(),
  }));
}

function createApp(): express.Express {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(requestIdMiddleware);
  app.use(loggingMiddleware);

  // CORS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Health endpoints
  healthChecker.registerWithApp(app);

  // Gateway info
  app.get('/api/v1/gateway/info', (req, res) => {
    res.json({
      service: SERVICE_NAME,
      version: '1.0.0',
      routes: ROUTES.map(r => ({ path: r.path, methods: r.methods, target: r.target })),
      timestamp: new Date().toISOString(),
    });
  });

  // Apply rate limiting and auth per route
  app.use('/api/v1/*', async (req: Request, res: Response, next: NextFunction) => {
    const route = findRoute(req.path, req.method);
    
    if (!route) {
      next();
      return;
    }

    // Apply rate limiting if configured
    if (route.rateLimit) {
      const limiter = rateLimitMiddleware(route.rateLimit.requests, route.rateLimit.windowMs);
      limiter(req, res, () => {});
      if (res.headersSent) return;
    }

    // Apply auth if required
    if (route.requiresAuth) {
      await authMiddleware(req, res, () => {});
      if (res.headersSent) return;
    }

    next();
  });

  // Proxy all /api/v1 requests
  app.all('/api/v1/*', proxyHandler);

  // 404 for unmatched routes
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', err, { requestId: (req as any).requestId });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

async function main(): Promise<void> {
  try {
    await initializeService();

    const app = createApp();

    app.listen(config.port, '0.0.0.0', () => {
      logger.info('API Gateway listening', { port: config.port });
      console.log('[api-gateway] Running on port ' + config.port);
    });

    const shutdown = async () => {
      logger.info('Shutting down...');
      await eventBus.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start API Gateway', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

main();
