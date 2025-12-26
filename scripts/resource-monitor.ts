#!/usr/bin/env tsx
/**
 * Resource Monitoring Tool
 * Monitors memory, CPU, and connection usage
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Pool } from 'pg';

const execAsync = promisify(exec);

interface ResourceMetrics {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  database: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
  };
}

class ResourceMonitor {
  private pool: Pool;
  private metrics: ResourceMetrics[] = [];
  private interval: NodeJS.Timeout | null = null;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async collectMetrics(): Promise<ResourceMetrics> {
    const memUsage = process.memoryUsage();

    // Get CPU usage from process
    const cpuUsage = process.cpuUsage();

    // Get database connection stats
    let dbStats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
    };

    try {
      const result = await this.pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE state = 'active') as active,
          COUNT(*) FILTER (WHERE state = 'idle') as idle
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      dbStats = {
        totalConnections: parseInt(result.rows[0].total),
        activeConnections: parseInt(result.rows[0].active),
        idleConnections: parseInt(result.rows[0].idle),
      };
    } catch (error) {
      // Ignore errors
    }

    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      database: dbStats,
    };
  }

  startMonitoring(intervalMs: number = 1000) {
    this.interval = setInterval(async () => {
      const metrics = await this.collectMetrics();
      this.metrics.push(metrics);
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async report() {
    console.log('\n\n');
    console.log('='.repeat(80));
    console.log('📊 RESOURCE USAGE REPORT');
    console.log('='.repeat(80));

    if (this.metrics.length === 0) {
      console.log('\n⚠️  No metrics collected');
      return;
    }

    // Memory analysis
    console.log('\n💾 MEMORY USAGE:');
    console.log('─'.repeat(80));

    const memMetrics = this.metrics.map(m => m.memory);
    const avgHeapUsed = memMetrics.reduce((sum, m) => sum + m.heapUsed, 0) / memMetrics.length;
    const maxHeapUsed = Math.max(...memMetrics.map(m => m.heapUsed));
    const minHeapUsed = Math.min(...memMetrics.map(m => m.heapUsed));

    const avgRss = memMetrics.reduce((sum, m) => sum + m.rss, 0) / memMetrics.length;
    const maxRss = Math.max(...memMetrics.map(m => m.rss));

    console.log(`  Heap Used (Avg):     ${(avgHeapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Heap Used (Max):     ${(maxHeapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Heap Used (Min):     ${(minHeapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  RSS (Avg):           ${(avgRss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  RSS (Max):           ${(maxRss / 1024 / 1024).toFixed(2)} MB`);

    // Check for memory leak (growing trend)
    if (this.metrics.length > 10) {
      const firstHalf = memMetrics.slice(0, Math.floor(memMetrics.length / 2));
      const secondHalf = memMetrics.slice(Math.floor(memMetrics.length / 2));

      const avgFirstHalf = firstHalf.reduce((sum, m) => sum + m.heapUsed, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((sum, m) => sum + m.heapUsed, 0) / secondHalf.length;

      const growthPercent = ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100;

      console.log(`\n  Memory Growth:       ${growthPercent > 0 ? '+' : ''}${growthPercent.toFixed(2)}%`);

      if (growthPercent > 10) {
        console.log('  ⚠️  WARNING: Potential memory leak detected!');
      } else if (growthPercent > 5) {
        console.log('  ⚠️  Moderate memory growth observed');
      } else {
        console.log('  ✅ Memory usage stable');
      }
    }

    // Database connections
    console.log('\n🔌 DATABASE CONNECTIONS:');
    console.log('─'.repeat(80));

    const dbMetrics = this.metrics.map(m => m.database);
    const avgTotal = dbMetrics.reduce((sum, m) => sum + m.totalConnections, 0) / dbMetrics.length;
    const maxTotal = Math.max(...dbMetrics.map(m => m.totalConnections));
    const avgActive = dbMetrics.reduce((sum, m) => sum + m.activeConnections, 0) / dbMetrics.length;
    const maxActive = Math.max(...dbMetrics.map(m => m.activeConnections));

    console.log(`  Total (Avg):         ${avgTotal.toFixed(1)}`);
    console.log(`  Total (Max):         ${maxTotal}`);
    console.log(`  Active (Avg):        ${avgActive.toFixed(1)}`);
    console.log(`  Active (Max):        ${maxActive}`);

    if (maxTotal > 50) {
      console.log('  ⚠️  WARNING: High connection count - risk of connection pool exhaustion');
    } else if (maxTotal > 20) {
      console.log('  ⚠️  Moderate connection count - monitor for growth');
    } else {
      console.log('  ✅ Connection count healthy');
    }

    // System info
    console.log('\n🖥️  SYSTEM INFORMATION:');
    console.log('─'.repeat(80));

    try {
      const { stdout: cpuInfo } = await execAsync('top -b -n 1 | grep "node\\|Cpu" | head -5');
      console.log('  CPU Usage:');
      cpuInfo.split('\n').forEach(line => {
        if (line.trim()) {
          console.log(`    ${line.trim()}`);
        }
      });
    } catch (error) {
      console.log('  Unable to fetch CPU info');
    }

    try {
      const { stdout: memInfo } = await execAsync('free -m 2>/dev/null || echo "Not available"');
      if (!memInfo.includes('Not available')) {
        console.log('\n  System Memory:');
        memInfo.split('\n').slice(0, 3).forEach(line => {
          if (line.trim()) {
            console.log(`    ${line.trim()}`);
          }
        });
      }
    } catch (error) {
      // Ignore
    }
  }

  async cleanup() {
    this.stopMonitoring();
    await this.pool.end();
  }
}

export { ResourceMonitor };

// Run standalone if executed directly
if (require.main === module) {
  async function main() {
    const monitor = new ResourceMonitor();

    console.log('🔍 Starting resource monitoring for 30 seconds...\n');

    monitor.startMonitoring(1000);

    // Monitor for 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));

    monitor.stopMonitoring();
    await monitor.report();
    await monitor.cleanup();
  }

  main().catch(console.error);
}
