#!/usr/bin/env tsx
/**
 * AI Active Trader - Service Template Generator
 * Creates a new microservice from template with proper structure
 * 
 * Usage: npx tsx scripts/create-service.ts <service-name>
 * Example: npx tsx scripts/create-service.ts notification-service
 */

import * as fs from 'fs';
import * as path from 'path';

function getServiceTemplate(): string {
  return `/**
 * AI Active Trader - {{SERVICE_NAME_PASCAL}} Service
 * {{SERVICE_DESCRIPTION}}
 */

import express, { Request, Response } from 'express';
import { createEventBus, EventBusClient } from '../shared/events';
import { createLogger, loadServiceConfig, createHealthChecker, initTelemetry } from '../shared/common';

const SERVICE_NAME = '{{SERVICE_NAME}}';
const config = loadServiceConfig(SERVICE_NAME);
const logger = createLogger(SERVICE_NAME, config.logLevel);
const healthChecker = createHealthChecker(SERVICE_NAME, '1.0.0');

let eventBus: EventBusClient;

async function initializeService(): Promise<void> {
  logger.info('Initializing service', { port: config.port });

  // Initialize telemetry
  initTelemetry({
    serviceName: SERVICE_NAME,
    enabled: config.telemetry.enabled,
    endpoint: config.telemetry.endpoint,
  });

  // Connect to event bus
  eventBus = createEventBus(SERVICE_NAME);
  await eventBus.connect(config.nats.url);
  
  logger.info('Event bus connected', { inMemory: eventBus.isInMemoryMode() });

  // Register health checks
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
  
  // Register health endpoints
  healthChecker.registerWithApp(app);

  // Service-specific routes
  app.get('/api/v1/status', (req: Request, res: Response) => {
    res.json({
      service: SERVICE_NAME,
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  // TODO: Add service-specific routes here

  return app;
}

async function main(): Promise<void> {
  try {
    await initializeService();
    
    const app = createApp();
    
    app.listen(config.port, '0.0.0.0', () => {
      logger.info(SERVICE_NAME + ' listening on port ' + config.port);
    });

    // Graceful shutdown
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
`;
}

function getDockerfileTemplate(): string {
  return `FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/services/{{SERVICE_NAME}}/index.js"]
`;
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function createService(serviceName: string, description: string = ''): void {
  const servicesDir = path.join(process.cwd(), 'services');
  const serviceDir = path.join(servicesDir, serviceName);
  
  if (fs.existsSync(serviceDir)) {
    console.error('Error: Service directory already exists: ' + serviceDir);
    process.exit(1);
  }

  // Create service directory
  fs.mkdirSync(serviceDir, { recursive: true });
  
  // Generate index.ts from template
  const indexContent = getServiceTemplate()
    .replace(/\{\{SERVICE_NAME\}\}/g, serviceName)
    .replace(/\{\{SERVICE_NAME_PASCAL\}\}/g, toPascalCase(serviceName))
    .replace(/\{\{SERVICE_DESCRIPTION\}\}/g, description || toPascalCase(serviceName) + ' microservice');
  
  fs.writeFileSync(path.join(serviceDir, 'index.ts'), indexContent);
  
  // Generate Dockerfile
  const dockerfileContent = getDockerfileTemplate()
    .replace(/\{\{SERVICE_NAME\}\}/g, serviceName);
  
  fs.writeFileSync(path.join(process.cwd(), 'docker', 'Dockerfile.' + serviceName), dockerfileContent);
  
  console.log('Created service: ' + serviceName);
  console.log('  ' + serviceDir + '/index.ts');
  console.log('  docker/Dockerfile.' + serviceName);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Add service-specific routes in ' + serviceDir + '/index.ts');
  console.log('  2. Subscribe to events using eventBus.subscribe()');
  console.log('  3. Publish events using eventBus.publish()');
}

// CLI
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
  console.log('Usage: npx tsx scripts/create-service.ts <service-name> [description]');
  console.log('');
  console.log('Example:');
  console.log('  npx tsx scripts/create-service.ts notification-service "Handles notifications"');
  process.exit(0);
}

const serviceName = args[0];
const description = args.slice(1).join(' ');

if (!/^[a-z][a-z0-9-]*$/.test(serviceName)) {
  console.error('Error: Service name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens');
  process.exit(1);
}

createService(serviceName, description);
