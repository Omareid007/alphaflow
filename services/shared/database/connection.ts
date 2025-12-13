/**
 * AI Active Trader - Database Connection
 * Shared database connection utilities for microservices
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient } from 'pg';
import { createLogger, Logger } from '../common/logger';

export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeout?: number;
  connectTimeout?: number;
}

export interface DatabaseConnection {
  db: ReturnType<typeof drizzle>;
  pool: Pool;
  close: () => Promise<void>;
  isConnected: () => boolean;
  healthCheck: () => Promise<boolean>;
}

export function createDatabaseConnection(
  serviceName: string,
  config: DatabaseConfig,
  logger?: Logger
): DatabaseConnection {
  const log = logger || createLogger(serviceName, 'info');
  
  if (!config.connectionString) {
    throw new Error('Database connection string is required');
  }

  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections || 10,
    idleTimeoutMillis: (config.idleTimeout || 20) * 1000,
    connectionTimeoutMillis: (config.connectTimeout || 10) * 1000,
  });

  const db = drizzle(pool);
  let connected = true;

  pool.on('error', (err) => {
    log.error('Pool error', err);
  });

  const close = async () => {
    log.info('Closing database connection');
    await pool.end();
    connected = false;
  };

  const isConnected = () => connected;

  const healthCheck = async (): Promise<boolean> => {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      log.error('Database health check failed', error instanceof Error ? error : undefined);
      return false;
    }
  };

  log.info('Database connection initialized', { maxConnections: config.maxConnections || 10 });

  return {
    db,
    pool,
    close,
    isConnected,
    healthCheck,
  };
}
