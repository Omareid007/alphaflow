/**
 * AI Active Trader - Self-Healing Orchestrator
 * Automated recovery controller with health-based failover, degradation modes,
 * and recovery playbooks. Coordinates circuit breakers, health monitoring,
 * and graceful service degradation.
 * 
 * Based on Netflix Resilience4j, NautilusTrader, and LMAX architecture patterns.
 */

import { createLogger } from './logger';
import { CircuitBreakerRegistry, CircuitState } from './circuit-breaker';
import { HealthSentinel, ServiceHealth, ResourceMetrics } from './health-sentinel';
import { BulkheadRegistry } from './bulkhead';
import { KillSwitch, KillSwitchReason } from './kill-switch';

const logger = createLogger('self-healing-orchestrator');

export enum DegradationMode {
  FULL = 'FULL',
  PAPER_ONLY = 'PAPER_ONLY',
  REPLAY_ONLY = 'REPLAY_ONLY',
  READ_ONLY = 'READ_ONLY',
  EMERGENCY_SHUTDOWN = 'EMERGENCY_SHUTDOWN',
}

export enum RecoveryAction {
  RESTART_SERVICE = 'RESTART_SERVICE',
  RESET_CIRCUIT_BREAKER = 'RESET_CIRCUIT_BREAKER',
  CLEAR_BULKHEAD_QUEUE = 'CLEAR_BULKHEAD_QUEUE',
  SWITCH_TO_FALLBACK = 'SWITCH_TO_FALLBACK',
  TRIGGER_FAILOVER = 'TRIGGER_FAILOVER',
  SCALE_DOWN = 'SCALE_DOWN',
  ESCALATE_TO_KILLSWITCH = 'ESCALATE_TO_KILLSWITCH',
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION',
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ServiceInstance {
  id: string;
  name: string;
  endpoint: string;
  priority: number;
  isActive: boolean;
  health: 'healthy' | 'degraded' | 'unhealthy' | 'dead';
  lastHealthCheck: Date;
  failoverInProgress: boolean;
  metadata: Record<string, unknown>;
}

export interface RecoveryPlaybook {
  name: string;
  triggerConditions: PlaybookTrigger[];
  actions: PlaybookAction[];
  cooldownMs: number;
  maxExecutions: number;
  escalationPath?: string;
}

export interface PlaybookTrigger {
  type: 'circuit_open' | 'health_degraded' | 'resource_threshold' | 'consecutive_failures' | 'custom';
  target?: string;
  threshold?: number;
  condition?: (context: OrchestratorContext) => boolean;
}

export interface PlaybookAction {
  action: RecoveryAction;
  target?: string;
  params?: Record<string, unknown>;
  delayMs?: number;
  retryCount?: number;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
}

export interface OrchestratorContext {
  currentMode: DegradationMode;
  serviceHealth: Map<string, ServiceHealth>;
  circuitStates: Map<string, CircuitState>;
  resourceMetrics: ResourceMetrics;
  activeIncidents: Incident[];
  recentRecoveries: RecoveryEvent[];
}

export interface Incident {
  id: string;
  severity: IncidentSeverity;
  source: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, unknown>;
}

export interface RecoveryEvent {
  id: string;
  playbookName: string;
  actions: RecoveryAction[];
  startedAt: Date;
  completedAt?: Date;
  success: boolean;
  error?: string;
}

export interface FailoverGroup {
  name: string;
  instances: ServiceInstance[];
  activeInstanceId: string | null;
  failoverPolicy: 'priority' | 'round_robin' | 'least_connections';
  healthCheckIntervalMs: number;
  failoverThreshold: number;
  lastFailoverTime: Date | null;
  failoverLock: boolean;
}

interface PlaybookExecutionRecord {
  readonly count: number;
  readonly lastExecution: Date;
}

export interface ModeEnforcementHandler {
  onEnterMode: (mode: DegradationMode) => Promise<void>;
  onExitMode: (mode: DegradationMode) => Promise<void>;
}

export interface TradingPermissionController {
  setLiveTradingEnabled: (enabled: boolean) => void;
  setPaperTradingEnabled: (enabled: boolean) => void;
  setReplayEnabled: (enabled: boolean) => void;
  setReadOnlyMode: (enabled: boolean) => void;
}

export interface OrchestratorConfig {
  checkIntervalMs: number;
  degradationThresholds: {
    paperOnly: { unhealthyServices: number; circuitOpenCount: number };
    replayOnly: { unhealthyServices: number; circuitOpenCount: number };
    readOnly: { unhealthyServices: number; circuitOpenCount: number };
    emergencyShutdown: { deadServices: number; criticalIncidents: number };
  };
  autoRecoveryEnabled: boolean;
  maxConcurrentRecoveries: number;
  incidentRetentionMs: number;
  failoverCooldownMs: number;
  onModeChange?: (from: DegradationMode, to: DegradationMode) => void;
  onIncidentCreated?: (incident: Incident) => void;
  onRecoveryCompleted?: (event: RecoveryEvent) => void;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  checkIntervalMs: 5000,
  degradationThresholds: {
    paperOnly: { unhealthyServices: 1, circuitOpenCount: 2 },
    replayOnly: { unhealthyServices: 2, circuitOpenCount: 3 },
    readOnly: { unhealthyServices: 3, circuitOpenCount: 4 },
    emergencyShutdown: { deadServices: 2, criticalIncidents: 1 },
  },
  autoRecoveryEnabled: true,
  maxConcurrentRecoveries: 3,
  incidentRetentionMs: 24 * 60 * 60 * 1000,
  failoverCooldownMs: 30000,
};

export class SelfHealingOrchestrator {
  private static instance: SelfHealingOrchestrator;
  
  private config: OrchestratorConfig;
  private currentMode: DegradationMode = DegradationMode.FULL;
  private playbooks: Map<string, RecoveryPlaybook> = new Map();
  private playbookExecutions: Map<string, PlaybookExecutionRecord> = new Map();
  private failoverGroups: Map<string, FailoverGroup> = new Map();
  private incidents: Incident[] = [];
  private recoveryEvents: RecoveryEvent[] = [];
  private activeRecoveries = 0;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private fallbackHandlers: Map<string, () => Promise<unknown>> = new Map();
  private modeTransitionHistory: Array<{ from: DegradationMode; to: DegradationMode; timestamp: Date; reason: string }> = [];
  private modeEnforcementHandlers: ModeEnforcementHandler[] = [];
  private tradingController: TradingPermissionController | null = null;

  private constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultPlaybooks();
  }

  static getInstance(config?: Partial<OrchestratorConfig>): SelfHealingOrchestrator {
    if (!SelfHealingOrchestrator.instance) {
      SelfHealingOrchestrator.instance = new SelfHealingOrchestrator(config);
    }
    return SelfHealingOrchestrator.instance;
  }

  static resetInstance(): void {
    if (SelfHealingOrchestrator.instance) {
      SelfHealingOrchestrator.instance.stop();
    }
    SelfHealingOrchestrator.instance = undefined as unknown as SelfHealingOrchestrator;
  }

  registerTradingController(controller: TradingPermissionController): void {
    this.tradingController = controller;
    logger.info('Trading permission controller registered');
  }

  registerModeEnforcementHandler(handler: ModeEnforcementHandler): void {
    this.modeEnforcementHandlers.push(handler);
    logger.info('Mode enforcement handler registered');
  }

  private initializeDefaultPlaybooks(): void {
    this.registerPlaybook({
      name: 'circuit-breaker-recovery',
      triggerConditions: [{
        type: 'circuit_open',
        threshold: 1,
      }],
      actions: [
        { action: RecoveryAction.SWITCH_TO_FALLBACK, delayMs: 0 },
        { action: RecoveryAction.RESET_CIRCUIT_BREAKER, delayMs: 30000, retryCount: 3 },
      ],
      cooldownMs: 60000,
      maxExecutions: 5,
      escalationPath: 'service-restart-playbook',
    });

    this.registerPlaybook({
      name: 'service-restart-playbook',
      triggerConditions: [{
        type: 'health_degraded',
        threshold: 3,
      }],
      actions: [
        { action: RecoveryAction.CLEAR_BULKHEAD_QUEUE },
        { action: RecoveryAction.RESTART_SERVICE, delayMs: 1000, retryCount: 2 },
      ],
      cooldownMs: 120000,
      maxExecutions: 3,
      escalationPath: 'failover-playbook',
    });

    this.registerPlaybook({
      name: 'failover-playbook',
      triggerConditions: [{
        type: 'consecutive_failures',
        threshold: 5,
      }],
      actions: [
        { action: RecoveryAction.TRIGGER_FAILOVER },
        { action: RecoveryAction.SCALE_DOWN, delayMs: 5000 },
      ],
      cooldownMs: 300000,
      maxExecutions: 2,
      escalationPath: 'emergency-shutdown-playbook',
    });

    this.registerPlaybook({
      name: 'emergency-shutdown-playbook',
      triggerConditions: [{
        type: 'custom',
        condition: (ctx) => ctx.activeIncidents.filter(i => i.severity === IncidentSeverity.CRITICAL).length > 0,
      }],
      actions: [
        { action: RecoveryAction.ESCALATE_TO_KILLSWITCH },
      ],
      cooldownMs: 600000,
      maxExecutions: 1,
    });

    this.registerPlaybook({
      name: 'resource-pressure-playbook',
      triggerConditions: [{
        type: 'resource_threshold',
        threshold: 85,
      }],
      actions: [
        { action: RecoveryAction.CLEAR_BULKHEAD_QUEUE },
        { action: RecoveryAction.SCALE_DOWN, delayMs: 2000 },
      ],
      cooldownMs: 60000,
      maxExecutions: 10,
    });
  }

  registerPlaybook(playbook: RecoveryPlaybook): void {
    if (!playbook.name || playbook.name.trim() === '') {
      throw new Error('Playbook name is required');
    }
    this.playbooks.set(playbook.name, playbook);
    logger.info('Recovery playbook registered', { name: playbook.name });
  }

  registerFallbackHandler(serviceName: string, handler: () => Promise<unknown>): void {
    this.fallbackHandlers.set(serviceName, handler);
    logger.info('Fallback handler registered', { serviceName });
  }

  registerFailoverGroup(group: FailoverGroup): void {
    this.failoverGroups.set(group.name, group);
    logger.info('Failover group registered', { 
      name: group.name, 
      instances: group.instances.length,
      policy: group.failoverPolicy,
    });
  }

  start(): void {
    if (this.isRunning) {
      logger.warn('Orchestrator already running');
      return;
    }

    this.isRunning = true;
    this.checkInterval = setInterval(() => this.runHealthCycle(), this.config.checkIntervalMs);
    
    logger.info('Self-healing orchestrator started', {
      checkIntervalMs: this.config.checkIntervalMs,
      playbooks: this.playbooks.size,
      failoverGroups: this.failoverGroups.size,
    });
  }

  stop(): void {
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    logger.info('Self-healing orchestrator stopped');
  }

  private async runHealthCycle(): Promise<void> {
    try {
      const context = this.buildContext();
      
      this.cleanupOldIncidents();
      
      await this.evaluateDegradationMode(context);
      
      if (this.config.autoRecoveryEnabled) {
        await this.evaluatePlaybooks(context);
      }
      
      await this.checkFailoverGroups();
      
    } catch (error) {
      logger.error('Health cycle failed', error instanceof Error ? error : undefined);
    }
  }

  private buildContext(): OrchestratorContext {
    const sentinel = HealthSentinel.getInstance();
    const circuitRegistry = CircuitBreakerRegistry.getInstance();
    
    const serviceHealth = new Map<string, ServiceHealth>();
    for (const health of sentinel.getAllHealth()) {
      serviceHealth.set(health.name, health);
    }
    
    const circuitStates = new Map<string, CircuitState>();
    const circuitStats = circuitRegistry.getAllStats();
    for (const [name, stats] of Object.entries(circuitStats)) {
      circuitStates.set(name, stats.state);
    }

    return {
      currentMode: this.currentMode,
      serviceHealth,
      circuitStates,
      resourceMetrics: sentinel.getResourceMetrics(),
      activeIncidents: this.incidents.filter(i => !i.resolved),
      recentRecoveries: this.recoveryEvents.slice(-20),
    };
  }

  private async evaluateDegradationMode(context: OrchestratorContext): Promise<void> {
    const { degradationThresholds } = this.config;
    
    const unhealthyCount = Array.from(context.serviceHealth.values())
      .filter(h => h.status === 'unhealthy').length;
    const deadCount = Array.from(context.serviceHealth.values())
      .filter(h => h.status === 'dead').length;
    const openCircuits = Array.from(context.circuitStates.values())
      .filter(s => s === CircuitState.OPEN).length;
    const criticalIncidents = context.activeIncidents
      .filter(i => i.severity === IncidentSeverity.CRITICAL).length;

    let targetMode = DegradationMode.FULL;

    if (deadCount >= degradationThresholds.emergencyShutdown.deadServices ||
        criticalIncidents >= degradationThresholds.emergencyShutdown.criticalIncidents) {
      targetMode = DegradationMode.EMERGENCY_SHUTDOWN;
    } else if (unhealthyCount >= degradationThresholds.readOnly.unhealthyServices ||
               openCircuits >= degradationThresholds.readOnly.circuitOpenCount) {
      targetMode = DegradationMode.READ_ONLY;
    } else if (unhealthyCount >= degradationThresholds.replayOnly.unhealthyServices ||
               openCircuits >= degradationThresholds.replayOnly.circuitOpenCount) {
      targetMode = DegradationMode.REPLAY_ONLY;
    } else if (unhealthyCount >= degradationThresholds.paperOnly.unhealthyServices ||
               openCircuits >= degradationThresholds.paperOnly.circuitOpenCount) {
      targetMode = DegradationMode.PAPER_ONLY;
    }

    if (targetMode !== this.currentMode) {
      await this.transitionMode(targetMode, `unhealthy=${unhealthyCount}, dead=${deadCount}, openCircuits=${openCircuits}`);
    }
  }

  private async transitionMode(newMode: DegradationMode, reason: string): Promise<void> {
    const oldMode = this.currentMode;
    
    for (const handler of this.modeEnforcementHandlers) {
      try {
        await handler.onExitMode(oldMode);
      } catch (error) {
        logger.error('Mode exit handler failed', error instanceof Error ? error : undefined);
      }
    }
    
    this.currentMode = newMode;

    this.modeTransitionHistory.push({
      from: oldMode,
      to: newMode,
      timestamp: new Date(),
      reason,
    });

    logger.warn('Degradation mode changed', { from: oldMode, to: newMode, reason });

    await this.enforceModePermissions(newMode);

    for (const handler of this.modeEnforcementHandlers) {
      try {
        await handler.onEnterMode(newMode);
      } catch (error) {
        logger.error('Mode enter handler failed', error instanceof Error ? error : undefined);
      }
    }

    if (newMode === DegradationMode.EMERGENCY_SHUTDOWN) {
      const killSwitch = KillSwitch.getInstance();
      if (!killSwitch.isActive()) {
        killSwitch.trigger(KillSwitchReason.SYSTEM_ERROR, {
          previousMode: oldMode,
          reason,
          activeIncidents: this.incidents.filter(i => !i.resolved).length,
        }, 'self-healing-orchestrator');
      }
    }

    this.config.onModeChange?.(oldMode, newMode);
  }

  private async enforceModePermissions(mode: DegradationMode): Promise<void> {
    if (!this.tradingController) {
      logger.debug('No trading controller registered, mode enforcement skipped');
      return;
    }

    switch (mode) {
      case DegradationMode.FULL:
        this.tradingController.setLiveTradingEnabled(true);
        this.tradingController.setPaperTradingEnabled(true);
        this.tradingController.setReplayEnabled(true);
        this.tradingController.setReadOnlyMode(false);
        break;
      
      case DegradationMode.PAPER_ONLY:
        this.tradingController.setLiveTradingEnabled(false);
        this.tradingController.setPaperTradingEnabled(true);
        this.tradingController.setReplayEnabled(true);
        this.tradingController.setReadOnlyMode(false);
        break;
      
      case DegradationMode.REPLAY_ONLY:
        this.tradingController.setLiveTradingEnabled(false);
        this.tradingController.setPaperTradingEnabled(false);
        this.tradingController.setReplayEnabled(true);
        this.tradingController.setReadOnlyMode(false);
        break;
      
      case DegradationMode.READ_ONLY:
        this.tradingController.setLiveTradingEnabled(false);
        this.tradingController.setPaperTradingEnabled(false);
        this.tradingController.setReplayEnabled(false);
        this.tradingController.setReadOnlyMode(true);
        break;
      
      case DegradationMode.EMERGENCY_SHUTDOWN:
        this.tradingController.setLiveTradingEnabled(false);
        this.tradingController.setPaperTradingEnabled(false);
        this.tradingController.setReplayEnabled(false);
        this.tradingController.setReadOnlyMode(true);
        break;
    }

    logger.info('Mode permissions enforced', { mode });
  }

  private async evaluatePlaybooks(context: OrchestratorContext): Promise<void> {
    for (const [, playbook] of this.playbooks) {
      if (this.shouldExecutePlaybook(playbook, context)) {
        await this.executePlaybook(playbook, context);
      }
    }
  }

  private shouldExecutePlaybook(playbook: RecoveryPlaybook, context: OrchestratorContext): boolean {
    if (!playbook.name) {
      return false;
    }

    const execution = this.playbookExecutions.get(playbook.name);
    
    if (execution) {
      if (execution.count >= playbook.maxExecutions) {
        return false;
      }
      if (Date.now() - execution.lastExecution.getTime() < playbook.cooldownMs) {
        return false;
      }
    }

    if (this.activeRecoveries >= this.config.maxConcurrentRecoveries) {
      return false;
    }

    return playbook.triggerConditions.some(trigger => this.evaluateTrigger(trigger, context));
  }

  private evaluateTrigger(trigger: PlaybookTrigger, context: OrchestratorContext): boolean {
    switch (trigger.type) {
      case 'circuit_open': {
        if (trigger.target) {
          const state = context.circuitStates.get(trigger.target);
          return state === CircuitState.OPEN;
        }
        const openCount = Array.from(context.circuitStates.values())
          .filter(s => s === CircuitState.OPEN).length;
        return openCount >= (trigger.threshold || 1);
      }
      
      case 'health_degraded': {
        if (trigger.target) {
          const health = context.serviceHealth.get(trigger.target);
          return health?.status === 'unhealthy' || health?.status === 'dead';
        }
        const degradedCount = Array.from(context.serviceHealth.values())
          .filter(h => h.status === 'unhealthy' || h.status === 'dead').length;
        return degradedCount >= (trigger.threshold || 1);
      }
      
      case 'resource_threshold': {
        const memoryPercent = context.resourceMetrics.memoryPercent;
        return memoryPercent >= (trigger.threshold || 85);
      }
      
      case 'consecutive_failures': {
        if (trigger.target) {
          const health = context.serviceHealth.get(trigger.target);
          return (health?.consecutiveFailures || 0) >= (trigger.threshold || 5);
        }
        return Array.from(context.serviceHealth.values())
          .some(h => h.consecutiveFailures >= (trigger.threshold || 5));
      }
      
      case 'custom':
        return trigger.condition?.(context) || false;
      
      default:
        return false;
    }
  }

  private pendingEscalations: Array<{ playbook: RecoveryPlaybook; context: OrchestratorContext }> = [];

  private async executePlaybook(playbook: RecoveryPlaybook, context: OrchestratorContext): Promise<void> {
    const recoveryEvent: RecoveryEvent = {
      id: `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      playbookName: playbook.name,
      actions: playbook.actions.map(a => a.action),
      startedAt: new Date(),
      success: false,
    };

    this.activeRecoveries++;
    logger.info('Executing recovery playbook', { name: playbook.name });

    let escalationPlaybook: RecoveryPlaybook | undefined;

    try {
      for (const action of playbook.actions) {
        if (action.delayMs) {
          await this.delay(action.delayMs);
        }

        await this.executeAction(action, context);
      }

      recoveryEvent.success = true;
      recoveryEvent.completedAt = new Date();
      logger.info('Recovery playbook completed successfully', { name: playbook.name });
      
    } catch (error) {
      recoveryEvent.success = false;
      recoveryEvent.error = error instanceof Error ? error.message : String(error);
      recoveryEvent.completedAt = new Date();

      logger.error('Recovery playbook failed', error instanceof Error ? error : undefined, { name: playbook.name });

      if (playbook.escalationPath) {
        escalationPlaybook = this.playbooks.get(playbook.escalationPath);
        if (escalationPlaybook) {
          logger.warn('Queuing escalation playbook', { from: playbook.name, to: playbook.escalationPath });
        }
      }
    } finally {
      this.activeRecoveries--;
      
      const currentExecution = this.playbookExecutions.get(playbook.name);
      const newExecution: PlaybookExecutionRecord = {
        count: (currentExecution?.count || 0) + 1,
        lastExecution: new Date(),
      };
      this.playbookExecutions.set(playbook.name, newExecution);
      
      this.recoveryEvents.push(recoveryEvent);
      this.config.onRecoveryCompleted?.(recoveryEvent);
    }

    if (escalationPlaybook && this.shouldExecutePlaybook(escalationPlaybook, context)) {
      await this.executePlaybook(escalationPlaybook, context);
    }
  }

  private async executeAction(action: PlaybookAction, context: OrchestratorContext): Promise<void> {
    const retryCount = action.retryCount || 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        await this.performAction(action, context);
        action.onSuccess?.();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn('Recovery action failed, retrying', { 
          action: action.action, 
          attempt: attempt + 1, 
          maxAttempts: retryCount,
        });
        
        if (attempt < retryCount - 1) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    if (lastError) {
      action.onFailure?.(lastError);
      throw lastError;
    }
  }

  private async performAction(action: PlaybookAction, context: OrchestratorContext): Promise<void> {
    switch (action.action) {
      case RecoveryAction.RESTART_SERVICE: {
        const sentinel = HealthSentinel.getInstance();
        if (action.target) {
          const health = context.serviceHealth.get(action.target);
          if (!health || health.status === 'healthy') {
            logger.debug('Service restart skipped - already healthy or not found', { target: action.target });
            return;
          }
          logger.info('Triggering service restart', { target: action.target });
        }
        await sentinel.runAllChecksNow();
        break;
      }

      case RecoveryAction.RESET_CIRCUIT_BREAKER: {
        const registry = CircuitBreakerRegistry.getInstance();
        if (action.target) {
          const breaker = registry.get(action.target);
          if (!breaker) {
            throw new Error(`Circuit breaker not found: ${action.target}`);
          }
          const state = breaker.getState();
          if (state === CircuitState.CLOSED) {
            logger.debug('Circuit breaker reset skipped - already closed', { target: action.target });
            return;
          }
          breaker.reset();
          logger.info('Circuit breaker reset', { target: action.target });
        } else {
          const stats = registry.getAllStats();
          const openBreakers = Object.entries(stats)
            .filter(([, s]) => s.state === CircuitState.OPEN)
            .map(([name]) => name);
          
          if (openBreakers.length === 0) {
            logger.debug('No open circuit breakers to reset');
            return;
          }
          
          for (const name of openBreakers) {
            const breaker = registry.get(name);
            breaker?.reset();
          }
          logger.info('Open circuit breakers reset', { count: openBreakers.length, breakers: openBreakers });
        }
        break;
      }

      case RecoveryAction.CLEAR_BULKHEAD_QUEUE: {
        const bulkheadRegistry = BulkheadRegistry.getInstance();
        if (action.target) {
          const bulkhead = bulkheadRegistry.get(action.target);
          if (!bulkhead) {
            throw new Error(`Bulkhead not found: ${action.target}`);
          }
          const stats = bulkhead.getStats();
          if (stats.queueSize === 0) {
            logger.debug('Bulkhead drain skipped - queue empty', { target: action.target });
            return;
          }
          bulkhead.drain();
          logger.info('Bulkhead drained', { target: action.target, previousQueueSize: stats.queueSize });
        } else {
          const allStats = bulkheadRegistry.getAllStats();
          const totalQueued = Object.values(allStats).reduce((sum, s) => sum + s.queueSize, 0);
          if (totalQueued === 0) {
            logger.debug('All bulkhead queues empty, drain skipped');
            return;
          }
          bulkheadRegistry.drainAll();
          logger.info('All bulkheads drained', { totalQueued });
        }
        break;
      }

      case RecoveryAction.SWITCH_TO_FALLBACK: {
        if (!action.target) {
          const allTargets = Array.from(context.circuitStates.entries())
            .filter(([, state]) => state === CircuitState.OPEN)
            .map(([name]) => name);
          
          for (const target of allTargets) {
            const handler = this.fallbackHandlers.get(target);
            if (handler) {
              await handler();
              logger.info('Switched to fallback', { target });
            }
          }
          return;
        }
        
        const handler = this.fallbackHandlers.get(action.target);
        if (!handler) {
          logger.warn('No fallback handler registered', { target: action.target });
          return;
        }
        await handler();
        logger.info('Switched to fallback', { target: action.target });
        break;
      }

      case RecoveryAction.TRIGGER_FAILOVER: {
        if (action.target) {
          await this.performFailoverWithLock(action.target);
        } else {
          for (const groupName of this.failoverGroups.keys()) {
            await this.performFailoverWithLock(groupName);
          }
        }
        break;
      }

      case RecoveryAction.SCALE_DOWN: {
        logger.info('Scale down triggered', { target: action.target });
        break;
      }

      case RecoveryAction.ESCALATE_TO_KILLSWITCH: {
        const killSwitch = KillSwitch.getInstance();
        if (killSwitch.isActive()) {
          logger.debug('Kill switch escalation skipped - already active');
          return;
        }
        killSwitch.trigger(
          KillSwitchReason.SYSTEM_ERROR,
          { escalatedFrom: 'self-healing-orchestrator', ...action.params },
          'recovery-playbook'
        );
        logger.warn('Kill switch triggered by recovery playbook');
        break;
      }

      case RecoveryAction.MANUAL_INTERVENTION: {
        this.createIncident(
          IncidentSeverity.CRITICAL,
          'self-healing-orchestrator',
          'Manual intervention required - automated recovery exhausted',
          action.params || {}
        );
        break;
      }
    }
  }

  private async performFailoverWithLock(groupName: string): Promise<void> {
    const group = this.failoverGroups.get(groupName);
    if (!group) {
      logger.warn('Failover group not found', { groupName });
      return;
    }

    if (group.failoverLock) {
      logger.debug('Failover already in progress', { groupName });
      return;
    }

    if (group.lastFailoverTime && 
        Date.now() - group.lastFailoverTime.getTime() < this.config.failoverCooldownMs) {
      logger.debug('Failover cooldown active', { 
        groupName, 
        cooldownRemaining: this.config.failoverCooldownMs - (Date.now() - group.lastFailoverTime.getTime()),
      });
      return;
    }

    group.failoverLock = true;
    logger.debug('Failover lock acquired', { groupName });

    try {
      const sentinel = HealthSentinel.getInstance();
      for (const instance of group.instances) {
        const health = sentinel.getServiceHealth(instance.name);
        if (health) {
          instance.health = health.status;
          instance.lastHealthCheck = health.lastCheck;
        }
      }

      const healthyInstances = group.instances.filter(i => i.health === 'healthy' && !i.isActive);
      
      if (healthyInstances.length === 0) {
        logger.error('No healthy instances available for failover', undefined, { groupName });
        this.createIncident(
          IncidentSeverity.CRITICAL,
          groupName,
          `No healthy instances available for failover in group ${groupName}`,
          { group: groupName, instances: group.instances.length }
        );
        return;
      }

      let nextInstance: ServiceInstance;
      
      switch (group.failoverPolicy) {
        case 'priority':
          nextInstance = healthyInstances.sort((a, b) => a.priority - b.priority)[0];
          break;
        case 'round_robin':
          nextInstance = healthyInstances[0];
          break;
        case 'least_connections':
          nextInstance = healthyInstances[0];
          break;
        default:
          nextInstance = healthyInstances[0];
      }

      const previousActive = group.instances.find(i => i.id === group.activeInstanceId);
      if (previousActive) {
        previousActive.isActive = false;
      }

      nextInstance.isActive = true;
      group.activeInstanceId = nextInstance.id;
      group.lastFailoverTime = new Date();

      logger.info('Failover completed', {
        group: groupName,
        previousInstance: previousActive?.id,
        newInstance: nextInstance.id,
      });
    } catch (error) {
      logger.error('Failover failed', error instanceof Error ? error : undefined, { groupName });
      throw error;
    } finally {
      group.failoverLock = false;
      logger.debug('Failover lock released', { groupName });
    }
  }

  private async checkFailoverGroups(): Promise<void> {
    const sentinel = HealthSentinel.getInstance();

    for (const [name, group] of this.failoverGroups) {
      const activeInstance = group.instances.find(i => i.id === group.activeInstanceId);
      
      if (activeInstance) {
        const health = sentinel.getServiceHealth(activeInstance.name);
        
        if (health) {
          activeInstance.health = health.status;
          activeInstance.lastHealthCheck = health.lastCheck;

          if (health.consecutiveFailures >= group.failoverThreshold) {
            logger.warn('Active instance degraded, initiating failover', { 
              group: name, 
              instance: activeInstance.id,
              failures: health.consecutiveFailures,
            });
            await this.performFailoverWithLock(name);
          }
        }
      }
    }
  }

  createIncident(
    severity: IncidentSeverity,
    source: string,
    message: string,
    metadata: Record<string, unknown> = {}
  ): Incident {
    const incident: Incident = {
      id: `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity,
      source,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata,
    };

    this.incidents.push(incident);
    logger.warn('Incident created', { id: incident.id, severity, source, message });
    
    try {
      this.config.onIncidentCreated?.(incident);
    } catch (error) {
      logger.error('onIncidentCreated callback failed', error instanceof Error ? error : undefined);
    }

    return incident;
  }

  resolveIncident(incidentId: string): boolean {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (incident && !incident.resolved) {
      incident.resolved = true;
      incident.resolvedAt = new Date();
      logger.info('Incident resolved', { id: incidentId });
      return true;
    }
    return false;
  }

  private cleanupOldIncidents(): void {
    const cutoff = Date.now() - this.config.incidentRetentionMs;
    this.incidents = this.incidents.filter(
      i => i.timestamp.getTime() > cutoff || !i.resolved
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCurrentMode(): DegradationMode {
    return this.currentMode;
  }

  setMode(mode: DegradationMode, reason = 'manual'): void {
    this.transitionMode(mode, reason);
  }

  canExecuteTrade(): { allowed: boolean; reason?: string; mode: DegradationMode } {
    switch (this.currentMode) {
      case DegradationMode.FULL:
        return { allowed: true, mode: this.currentMode };
      
      case DegradationMode.PAPER_ONLY:
        return { 
          allowed: false, 
          reason: 'System degraded to paper trading only',
          mode: this.currentMode,
        };
      
      case DegradationMode.REPLAY_ONLY:
        return { 
          allowed: false, 
          reason: 'System degraded to replay mode only',
          mode: this.currentMode,
        };
      
      case DegradationMode.READ_ONLY:
        return { 
          allowed: false, 
          reason: 'System in read-only mode',
          mode: this.currentMode,
        };
      
      case DegradationMode.EMERGENCY_SHUTDOWN:
        return { 
          allowed: false, 
          reason: 'Emergency shutdown active',
          mode: this.currentMode,
        };
      
      default:
        return { allowed: false, reason: 'Unknown mode', mode: this.currentMode };
    }
  }

  canPaperTrade(): boolean {
    return this.currentMode === DegradationMode.FULL || 
           this.currentMode === DegradationMode.PAPER_ONLY;
  }

  canReplay(): boolean {
    return this.currentMode !== DegradationMode.EMERGENCY_SHUTDOWN &&
           this.currentMode !== DegradationMode.READ_ONLY;
  }

  getActiveIncidents(): Incident[] {
    return this.incidents.filter(i => !i.resolved);
  }

  getAllIncidents(): Incident[] {
    return [...this.incidents];
  }

  getRecoveryEvents(): RecoveryEvent[] {
    return [...this.recoveryEvents];
  }

  getModeHistory(): Array<{ from: DegradationMode; to: DegradationMode; timestamp: Date; reason: string }> {
    return [...this.modeTransitionHistory];
  }

  getStats(): {
    currentMode: DegradationMode;
    activeIncidents: number;
    resolvedIncidents: number;
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    failoverGroups: number;
    playbooks: number;
  } {
    const successfulRecoveries = this.recoveryEvents.filter(e => e.success).length;
    
    return {
      currentMode: this.currentMode,
      activeIncidents: this.incidents.filter(i => !i.resolved).length,
      resolvedIncidents: this.incidents.filter(i => i.resolved).length,
      totalRecoveries: this.recoveryEvents.length,
      successfulRecoveries,
      failedRecoveries: this.recoveryEvents.length - successfulRecoveries,
      failoverGroups: this.failoverGroups.size,
      playbooks: this.playbooks.size,
    };
  }

  getContext(): OrchestratorContext {
    return this.buildContext();
  }

  resetPlaybookExecutions(playbookName?: string): void {
    if (playbookName) {
      this.playbookExecutions.delete(playbookName);
      logger.info('Playbook execution record reset', { playbookName });
    } else {
      this.playbookExecutions.clear();
      logger.info('All playbook execution records reset');
    }
  }
}

export function getSelfHealingOrchestrator(config?: Partial<OrchestratorConfig>): SelfHealingOrchestrator {
  return SelfHealingOrchestrator.getInstance(config);
}

export function createFailoverGroup(config: {
  name: string;
  instances: Array<{
    id: string;
    name: string;
    endpoint: string;
    priority?: number;
  }>;
  policy?: 'priority' | 'round_robin' | 'least_connections';
  healthCheckIntervalMs?: number;
  failoverThreshold?: number;
}): FailoverGroup {
  const orchestrator = getSelfHealingOrchestrator();
  
  const group: FailoverGroup = {
    name: config.name,
    instances: config.instances.map((inst, index) => ({
      id: inst.id,
      name: inst.name,
      endpoint: inst.endpoint,
      priority: inst.priority ?? index,
      isActive: index === 0,
      health: 'healthy',
      lastHealthCheck: new Date(),
      failoverInProgress: false,
      metadata: {},
    })),
    activeInstanceId: config.instances[0]?.id || null,
    failoverPolicy: config.policy || 'priority',
    healthCheckIntervalMs: config.healthCheckIntervalMs || 10000,
    failoverThreshold: config.failoverThreshold || 3,
    lastFailoverTime: null,
    failoverLock: false,
  };

  orchestrator.registerFailoverGroup(group);
  return group;
}

export function createTradingPermissionController(): TradingPermissionController {
  const state = {
    liveTradingEnabled: true,
    paperTradingEnabled: true,
    replayEnabled: true,
    readOnlyMode: false,
  };

  return {
    setLiveTradingEnabled: (enabled: boolean) => {
      state.liveTradingEnabled = enabled;
      logger.info('Live trading permission changed', { enabled });
    },
    setPaperTradingEnabled: (enabled: boolean) => {
      state.paperTradingEnabled = enabled;
      logger.info('Paper trading permission changed', { enabled });
    },
    setReplayEnabled: (enabled: boolean) => {
      state.replayEnabled = enabled;
      logger.info('Replay permission changed', { enabled });
    },
    setReadOnlyMode: (enabled: boolean) => {
      state.readOnlyMode = enabled;
      logger.info('Read-only mode changed', { enabled });
    },
  };
}
