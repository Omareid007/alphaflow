/**
 * Log Capture Server Wrapper
 * Captures all console output and writes to log files
 */

import { spawn } from "child_process";
import { createWriteStream, WriteStream } from "fs";
import { join } from "path";

class LogCapture {
  private logStream: WriteStream;
  private errorStream: WriteStream;
  private combinedStream: WriteStream;

  constructor() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logsDir = join(process.cwd(), "logs");

    this.logStream = createWriteStream(
      join(logsDir, `server-${timestamp}.log`),
      { flags: "a" }
    );
    this.errorStream = createWriteStream(
      join(logsDir, `error-${timestamp}.log`),
      { flags: "a" }
    );
    this.combinedStream = createWriteStream(
      join(logsDir, `combined-${timestamp}.log`),
      { flags: "a" }
    );

    console.log(`📝 Logs will be written to: logs/`);
  }

  write(data: string, isError: boolean = false) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${data}`;

    // Write to combined log
    this.combinedStream.write(line);

    // Write to specific log
    if (isError) {
      this.errorStream.write(line);
    } else {
      this.logStream.write(line);
    }

    // Also output to console
    if (isError) {
      process.stderr.write(data);
    } else {
      process.stdout.write(data);
    }
  }

  close() {
    this.logStream.end();
    this.errorStream.end();
    this.combinedStream.end();
  }
}

// Create logs directory
import { mkdirSync } from "fs";
try {
  mkdirSync(join(process.cwd(), "logs"), { recursive: true });
} catch (e) {
  // Directory might already exist
}

const capture = new LogCapture();

// Start the server
console.log("🚀 Starting server with log capture...\n");

const serverProcess = spawn("npm", ["run", "server:prod"], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: "production" },
});

serverProcess.stdout.on("data", (data) => {
  capture.write(data.toString(), false);
});

serverProcess.stderr.on("data", (data) => {
  capture.write(data.toString(), true);
});

serverProcess.on("close", (code) => {
  console.log(`\n🛑 Server process exited with code ${code}`);
  capture.close();
  process.exit(code || 0);
});

// Handle termination
process.on("SIGINT", () => {
  console.log("\n⚠️  Shutting down server...");
  serverProcess.kill("SIGINT");
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Shutting down server...");
  serverProcess.kill("SIGTERM");
});
