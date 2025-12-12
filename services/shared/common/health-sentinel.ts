/**
 * AI Active Trader - Health Sentinel
 * Self-healing system with watchdogs, health monitors, and automatic recovery.
 * Monitors service health, NATS consumer lag, resource usage, and triggers restarts.
 */

import { createLogger } from './logger';
import { CircuitBreakerRegistry } from './circuit-breaker';
import { KillSwitch, KillSwitchReason } from './kill-switch';

const logger = createLogger('health-sentinel');

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'dead';
  lastCheck: Date;
  lastHealthy: Date;
  consecutiveFailures: number;
  latencyMs: number;
  metadata: Record<string, unknown>;
}

export interface ResourceMetrics {
  cpuPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryPercent: number;
  heapUsedMB: number;
  heapTotalMB: number;
  eventLoopDelayMs: number;
  activeHandles: number;
}

export interface ConsumerLagMetrics {
  streamName: string;
  consumerName: string;
  pendingMessages: number;
  ackPending: number;
  lastDelivered: Date | null;
  lagSeconds: number;
}

export interface HealthCheckConfig {
  name: string;
  check: () => Promise<boolean>;
  intervalMs: number;
  timeoutMs: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
  onUnhealthy?: (health: ServiceHealth) => Promise<void>;
  onRecovered?: (health: ServiceHealth) => Promise<void>;
}

export interface ResourceGovernorConfig {
  maxCpuPercent: number;
  maxMemoryPercent: number;
  maxEventLoopDelayMs: number;
  maxConsumerLagSeconds: number;
  checkIntervalMs: number;
  onThresholdExceeded?: (metric: string, value: number, threshold: number) => Promise<void>;
}

const DEFAULT_GOVERNOR_CONFIG: ResourceGovernorConfig = {
  maxCpuPercent: 85,
  maxMemoryPercent: 90,
  maxEventLoopDelayMs: 100,
  maxConsumerLagSeconds: 60,
  checkIntervalMs: 10000,
};

export class HealthSentinel {
  private static instance: HealthSentinel;
  
  private healthChecks: Map<string, HealthCheckConfig> = new Map();
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private resourceInterval: NodeJS.Timeout | null = null;
  private governorConfig: ResourceGovernorConfig;
  private consumerLagCheckers: Map<string, () => Promise<ConsumerLagMetrics>> = new Map();
  private restartCallbacks: Map<string, () => Promise<void>> = new Map();
  private isRunning = false;
  
  private constructor(config?: Partial<ResourceGovernorConfig>) {
    this.governorConfig = { ...DEFAULT_GOVERNOR_CONFIG, ...config };
  }

  static getInstance(config?: Partial<ResourceGovernorConfig>): HealthSentinel {
    if (!HealthSentinel.instance) {
      HealthSentinel.instance = new HealthSentinel(config);
    }
    return HealthSentinel.instance;
  }

  registerHealthCheck(config: HealthCheckConfig): void {
    this.healthChecks.set(config.name, config);
    
    this.serviceHealth.set(config.name, {
      name: config.name,
      status: 'healthy',
      lastCheck: new Date(),
      lastHealthy: new Date(),
      consecutiveFailures: 0,
      latencyMs: 0,
      metadata: {},
    });

    logger.info('Health check registered', { name: config.name, intervalMs: config.intervalMs });
  }

  registerRestartCallback(serviceName: string, callback: () => Promise<void>): void {
    this.restartCallbacks.set(serviceName, callback);
    logger.info('Restart callback registered', { serviceName });
  }

  registerConsumerLagChecker(
    streamName: string,
    consumerName: string,
    checker: () => Promise<ConsumerLagMetrics>
  ): void {
    const key = `${streamName}:${consumerName}`;
    this.consumerLagCheckers.set(key, checker);
    logger.info('Consumer lag checker registered', { streamName, consumerName });
  }

  start(): void {
    if (this.isRunning) {
      logger.warn('Health sentinel already running');
      return;
    }

    this.isRunning = true;

    for (const [name, config] of this.healthChecks) {
      const interval = setInterval(() => this.runHealthCheck(name), config.intervalMs);
      this.checkIntervals.set(name, interval);
    }

    this.resourceInterval = setInterval(
      () => this.checkResources(),
      this.governorConfig.checkIntervalMs
    );

    logger.info('Health sentinel started', {
      healthChecks: this.healthChecks.size,
      consumerLagCheckers: this.consumerLagCheckers.size,
    });
  }

  stop(): void {
    this.isRunning = false;

    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();

    if (this.resourceInterval) {
      clearInterval(this.resourceInterval);
      this.resourceInterval = null;
    }

    logger.info('Health sentinel stopped');
  }

  private async runHealthCheck(name: string): Promise<void> {
    const config = this.healthChecks.get(name);
    const health = this.serviceHealth.get(name);
    
    if (!config || !health) return;

    const startTime = Date.now();
    let isHealthy = false;

    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), config.timeoutMs);
      });

      isHealthy = await Promise.race([config.check(), timeoutPromise]);
    } catch (error) {
      isHealthy = false;
      logger.debug('Health check failed', { name, error: error instanceof Error ? error.message : String(error) });
    }

    const latencyMs = Date.now() - startTime;
    const previousStatus = health.status;

    if (isHealthy) {
      health.consecutiveFailures = 0;
      health.lastHealthy = new Date();
      
      if (health.status !== 'healthy') {
        health.status = 'healthy';
        logger.info('Service recovered', { name, previousStatus });
        
        if (config.onRecovered) {
          await config.onRecovered(health).catch(e => 
            logger.error('Recovery callback failed', e instanceof Error ? e : undefined)
          );
        }
      }
    } else {
      health.consecutiveFailures++;
      
      if (health.consecutiveFailures >= config.unhealthyThreshold) {
        const newStatus = health.consecutiveFailures >= config.unhealthyThreshold * 2 ? 'dead' : 'unhealthy';
        
        if (health.status !== newStatus) {
          health.status = newStatus;
          logger.warn('Service unhealthy', { 
            name, 
            status: newStatus, 
            consecutiveFailures: health.consecutiveFailures 
          });

          if (config.onUnhealthy) {
            await config.onUnhealthy(health).catch(e =>
              logger.error('Unhealthy callback failed', e instanceof Error ? e : undefined)
            );
          }

          if (newStatus === 'dead') {
            await this.triggerRestart(name);
          } else if (newStatus === 'unhealthy') {
            await this.triggerRestart(name);
          }
        }
      } else if (health.consecutiveFailures > 0) {
        health.status = 'degraded';
      }
    }

    health.lastCheck = new Date();
    health.latencyMs = latencyMs;
  }

  private async triggerRestart(serviceName: string): Promise<void> {
    const restartCallback = this.restartCallbacks.get(serviceName);
    
    if (!restartCallback) {
      logger.warn('No restart callback registered for service', { serviceName });
      return;
    }

    logger.info('Triggering service restart', { serviceName });

    try {
      await restartCallback();
      
      const health = this.serviceHealth.get(serviceName);
      if (health) {
        health.consecutiveFailures = 0;
        health.status = 'healthy';
        health.lastHealthy = new Date();
      }
      
      logger.info('Service restart completed', { serviceName });
    } catch (error) {
      logger.error('Service restart failed', error instanceof Error ? error : undefined, { serviceName });
      
      const killSwitch = KillSwitch.getInstance();
      killSwitch.trigger(
        KillSwitchReason.SYSTEM_ERROR,
        { serviceName, message: `Service ${serviceName} restart failed after repeated health check failures` },
        'health-sentinel'
      );
    }
  }

  private async checkResources(): Promise<void> {
    const metrics = this.getResourceMetrics();
    
    if (metrics.cpuPercent > this.governorConfig.maxCpuPercent) {
      await this.handleThresholdExceeded('cpu', metrics.cpuPercent, this.governorConfig.maxCpuPercent);
    }

    if (metrics.memoryPercent > this.governorConfig.maxMemoryPercent) {
      await this.handleThresholdExceeded('memory', metrics.memoryPercent, this.governorConfig.maxMemoryPercent);
    }

    if (metrics.eventLoopDelayMs > this.governorConfig.maxEventLoopDelayMs) {
      await this.handleThresholdExceeded('eventLoopDelay', metrics.eventLoopDelayMs, this.governorConfig.maxEventLoopDelayMs);
    }

    await this.checkConsumerLag();
  }

  private async checkConsumerLag(): Promise<void> {
    for (const [key, checker] of this.consumerLagCheckers) {
      try {
        const metrics = await checker();
        
        if (metrics.lagSeconds > this.governorConfig.maxConsumerLagSeconds) {
          await this.handleThresholdExceeded(
            `consumerLag:${key}`,
            metrics.lagSeconds,
            this.governorConfig.maxConsumerLagSeconds
          );
        }
      } catch (error) {
        logger.debug('Consumer lag check failed', { key, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  private async handleThresholdExceeded(
    metric: string,
    value: number,
    threshold: number
  ): Promise<void> {
    logger.warn('Resource threshold exceeded', { metric, value, threshold });

    if (this.governorConfig.onThresholdExceeded) {
      await this.governorConfig.onThresholdExceeded(metric, value, threshold).catch(e =>
        logger.error('Threshold exceeded callback failed', e instanceof Error ? e : undefined)
      );
    }

    if (metric === 'memory' && value > threshold * 1.1) {
      logger.warn('Critical memory usage, triggering garbage collection hint');
      if (global.gc) {
        global.gc();
      }
    }
  }

  getResourceMetrics(): ResourceMetrics {
    const memUsage = process.memoryUsage();
    
    let cpuPercent = 0;
    try {
      const cpuUsage = process.cpuUsage();
      const total = cpuUsage.user + cpuUsage.system;
      cpuPercent = Math.min(100, (total / 1000000) * 100 / 10);
    } catch {
      cpuPercent = 0;
    }

    return {
      cpuPercent,
      memoryUsedMB: memUsage.rss / 1024 / 1024,
      memoryTotalMB: 512,
      memoryPercent: (memUsage.rss / 1024 / 1024 / 512) * 100,
      heapUsedMB: memUsage.heapUsed / 1024 / 1024,
      heapTotalMB: memUsage.heapTotal / 1024 / 1024,
      eventLoopDelayMs: 0,
      activeHandles: (process as NodeJS.Process & { _getActiveHandles?: () => unknown[] })._getActiveHandles?.()?.length || 0,
    };
  }

  getServiceHealth(name: string): ServiceHealth | undefined {
    return this.serviceHealth.get(name);
  }

  getAllHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  getOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' | 'dead' {
    const healths = this.getAllHealth();
    
    if (healths.length === 0) return 'healthy';
    
    if (healths.some(h => h.status === 'dead')) return 'dead';
    if (healths.some(h => h.status === 'unhealthy')) return 'unhealthy';
    if (healths.some(h => h.status === 'degraded')) return 'degraded';
    
    return 'healthy';
  }

  getCircuitBreakerStatus(): Array<{ name: string; state: string; failures: number }> {
    const registry = CircuitBreakerRegistry.getInstance();
    const stats = registry.getAllStats();
    return Object.entries(stats).map(([name, stat]) => ({
      name,
      state: stat.state,
      failures: stat.failures,
    }));
  }

  async runAllChecksNow(): Promise<Map<string, ServiceHealth>> {
    for (const name of this.healthChecks.keys()) {
      await this.runHealthCheck(name);
    }
    return new Map(this.serviceHealth);
  }

  getStats(): {
    totalServices: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    deadCount: number;
    resourceMetrics: ResourceMetrics;
  } {
    const healths = this.getAllHealth();
    
    return {
      totalServices: healths.length,
      healthyCount: healths.filter(h => h.status === 'healthy').length,
      degradedCount: healths.filter(h => h.status === 'degraded').length,
      unhealthyCount: healths.filter(h => h.status === 'unhealthy').length,
      deadCount: healths.filter(h => h.status === 'dead').length,
      resourceMetrics: this.getResourceMetrics(),
    };
  }
}

export class ServiceWatchdog {
  private sentinel: HealthSentinel;
  private serviceName: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: Date = new Date();
  private maxHeartbeatAge: number;

  constructor(
    serviceName: string,
    options: {
      heartbeatIntervalMs?: number;
      maxHeartbeatAgeMs?: number;
      restartCallback?: () => Promise<void>;
    } = {}
  ) {
    this.serviceName = serviceName;
    this.sentinel = HealthSentinel.getInstance();
    this.maxHeartbeatAge = options.maxHeartbeatAgeMs || 30000;

    this.sentinel.registerHealthCheck({
      name: serviceName,
      check: async () => {
        const age = Date.now() - this.lastHeartbeat.getTime();
        return age < this.maxHeartbeatAge;
      },
      intervalMs: options.heartbeatIntervalMs || 10000,
      timeoutMs: 5000,
      unhealthyThreshold: 3,
      healthyThreshold: 1,
    });

    if (options.restartCallback) {
      this.sentinel.registerRestartCallback(serviceName, options.restartCallback);
    }
  }

  heartbeat(metadata?: Record<string, unknown>): void {
    this.lastHeartbeat = new Date();
    
    const health = this.sentinel.getServiceHealth(this.serviceName);
    if (health) {
      health.metadata = { ...health.metadata, ...metadata };
    }
  }

  startAutoHeartbeat(intervalMs = 5000): void {
    this.stopAutoHeartbeat();
    this.heartbeatInterval = setInterval(() => this.heartbeat(), intervalMs);
  }

  stopAutoHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getHealth(): ServiceHealth | undefined {
    return this.sentinel.getServiceHealth(this.serviceName);
  }
}

export function getHealthSentinel(config?: Partial<ResourceGovernorConfig>): HealthSentinel {
  return HealthSentinel.getInstance(config);
}

export function createServiceWatchdog(
  serviceName: string,
  options?: {
    heartbeatIntervalMs?: number;
    maxHeartbeatAgeMs?: number;
    restartCallback?: () => Promise<void>;
  }
): ServiceWatchdog {
  return new ServiceWatchdog(serviceName, options);
}
