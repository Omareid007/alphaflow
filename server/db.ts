import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const poolConfig: pg.PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: false,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message);
});

pool.on('connect', () => {
  console.log('[DB Pool] New client connected');
});

let connectionCount = 0;
const originalConnect = pool.connect.bind(pool);
pool.connect = async function() {
  connectionCount++;
  return originalConnect();
};

export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    connectionCount,
  };
}

export const db = drizzle(pool, { schema });
