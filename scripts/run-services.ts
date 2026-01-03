#!/usr/bin/env npx tsx
/**
 * AI Active Trader - Unified Service Runner
 * Starts all microservices for development
 */

import { spawn, ChildProcess } from "child_process";
import { resolve } from "path";

interface ServiceConfig {
  name: string;
  path: string;
  port: number;
  color: string;
}

const SERVICES: ServiceConfig[] = [
  {
    name: "api-gateway",
    path: "services/api-gateway/index.ts",
    port: 5000,
    color: "\x1b[36m",
  },
  {
    name: "trading-engine",
    path: "services/trading-engine/index.ts",
    port: 3001,
    color: "\x1b[32m",
  },
  {
    name: "ai-decision",
    path: "services/ai-decision/index.ts",
    port: 3002,
    color: "\x1b[33m",
  },
  {
    name: "market-data",
    path: "services/market-data/index.ts",
    port: 3003,
    color: "\x1b[34m",
  },
  {
    name: "analytics",
    path: "services/analytics/index.ts",
    port: 3004,
    color: "\x1b[35m",
  },
  {
    name: "orchestrator",
    path: "services/orchestrator/index.ts",
    port: 3005,
    color: "\x1b[31m",
  },
];

const RESET = "\x1b[0m";
const processes: ChildProcess[] = [];

function log(service: string, color: string, message: string): void {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
  console.log(`${color}[${timestamp}] [${service}]${RESET} ${message}`);
}

async function startService(config: ServiceConfig): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    log(config.name, config.color, `Starting on port ${config.port}...`);

    const child = spawn("npx", ["tsx", config.path], {
      env: {
        ...process.env,
        PORT: String(config.port),
        SERVICE_NAME: config.name,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      lines.forEach((line: string) => {
        if (line.trim()) {
          log(config.name, config.color, line);
        }
      });
    });

    child.stderr?.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      lines.forEach((line: string) => {
        if (line.trim()) {
          log(config.name, config.color, `[ERROR] ${line}`);
        }
      });
    });

    child.on("error", (error) => {
      log(config.name, config.color, `Failed to start: ${error.message}`);
      reject(error);
    });

    child.on("exit", (code) => {
      log(config.name, config.color, `Exited with code ${code}`);
    });

    setTimeout(() => resolve(child), 1000);
  });
}

async function main(): Promise<void> {
  console.log("\n" + "═".repeat(60));
  console.log("  AI Active Trader - Microservices Runner");
  console.log("═".repeat(60) + "\n");

  console.log("Starting services:\n");
  for (const service of SERVICES) {
    console.log(`  • ${service.name} (port ${service.port})`);
  }
  console.log("\n");

  const args = process.argv.slice(2);
  const selectedServices =
    args.length > 0 ? SERVICES.filter((s) => args.includes(s.name)) : SERVICES;

  if (selectedServices.length === 0) {
    console.error("No matching services found. Available services:");
    SERVICES.forEach((s) => console.log(`  - ${s.name}`));
    process.exit(1);
  }

  for (const service of selectedServices) {
    try {
      const child = await startService(service);
      processes.push(child);
    } catch (error) {
      console.error(`Failed to start ${service.name}:`, error);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log(
    `  ${processes.length}/${selectedServices.length} services started`
  );
  console.log("  Press Ctrl+C to stop all services");
  console.log("═".repeat(60) + "\n");

  const shutdown = () => {
    console.log("\n\nShutting down all services...");
    processes.forEach((p) => p.kill("SIGTERM"));
    setTimeout(() => process.exit(0), 2000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(console.error);
