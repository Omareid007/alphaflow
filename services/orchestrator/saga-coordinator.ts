/**
 * AI Active Trader - Saga Coordinator
 * Manages distributed transaction sagas for trade execution
 */

import { EventBusClient } from '../shared/events';
import { SagaState, SagaStep, SagaStatus } from './types';

export interface SagaDefinition {
  type: string;
  steps: Array<{
    name: string;
    compensationName?: string;
  }>;
}

function generateSagaId(): string {
  return `saga_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class SagaCoordinator {
  private activeSagas: Map<string, SagaState> = new Map();
  private completedSagas: SagaState[] = [];
  private eventBus: EventBusClient | null = null;
  private logger: { info: Function; warn: Function; error: Function };
  private maxCompletedHistory = 100;
  private sagaTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private defaultTimeoutMs = 300000;

  constructor(logger?: { info: Function; warn: Function; error: Function }) {
    this.logger = logger || console;
  }

  setEventBus(eventBus: EventBusClient): void {
    this.eventBus = eventBus;
  }

  async startSaga(
    type: string,
    steps: string[],
    initialData: Record<string, unknown> = {}
  ): Promise<SagaState> {
    const sagaId = generateSagaId();
    const correlationId = generateCorrelationId();

    const sagaSteps: SagaStep[] = steps.map((name, index) => ({
      stepId: `${sagaId}_step_${index}`,
      name,
      status: index === 0 ? 'running' : 'pending',
      startedAt: index === 0 ? new Date() : undefined,
    }));

    const saga: SagaState = {
      sagaId,
      type,
      currentStep: 0,
      totalSteps: steps.length,
      status: 'running',
      steps: sagaSteps,
      startedAt: new Date(),
      correlationId,
      initialData,
    };

    this.activeSagas.set(sagaId, saga);
    this.setupTimeout(sagaId);

    this.logger.info('Saga started', {
      sagaId,
      type,
      steps: steps.length,
      correlationId,
    });

    if (this.eventBus) {
      await this.eventBus.publishSagaEvent(
        'orchestrator.saga.started',
        {
          sagaId,
          sagaType: type,
          initialData,
          startedAt: saga.startedAt.toISOString(),
        },
        {
          correlationId,
          causationId: null,
          sagaType: type,
          step: 1,
          totalSteps: steps.length,
          startedAt: saga.startedAt.toISOString(),
          timeout: this.defaultTimeoutMs,
        }
      );
    }

    return saga;
  }

  async advanceSaga(
    sagaId: string,
    stepResult?: Record<string, unknown>
  ): Promise<SagaState | null> {
    const saga = this.activeSagas.get(sagaId);
    if (!saga) {
      this.logger.warn('Saga not found for advancement', { sagaId });
      return null;
    }

    if (saga.status !== 'running') {
      this.logger.warn('Cannot advance non-running saga', { sagaId, status: saga.status });
      return null;
    }

    const currentStep = saga.steps[saga.currentStep];
    currentStep.status = 'completed';
    currentStep.completedAt = new Date();
    if (stepResult) {
      currentStep.data = stepResult;
    }

    saga.currentStep++;

    if (saga.currentStep >= saga.totalSteps) {
      await this.completeSaga(sagaId, 'success');
    } else {
      const nextStep = saga.steps[saga.currentStep];
      nextStep.status = 'running';
      nextStep.startedAt = new Date();

      this.logger.info('Saga advanced', {
        sagaId,
        currentStep: saga.currentStep,
        totalSteps: saga.totalSteps,
        stepName: nextStep.name,
      });
    }

    return saga;
  }

  async compensateSaga(
    sagaId: string,
    error: string
  ): Promise<SagaState | null> {
    const saga = this.activeSagas.get(sagaId);
    if (!saga) {
      this.logger.warn('Saga not found for compensation', { sagaId });
      return null;
    }

    this.clearTimeout(sagaId);
    saga.status = 'compensating';
    saga.error = error;

    const currentStep = saga.steps[saga.currentStep];
    if (currentStep) {
      currentStep.status = 'failed';
      currentStep.error = error;
      currentStep.completedAt = new Date();
    }

    this.logger.warn('Saga compensation started', {
      sagaId,
      failedStep: saga.currentStep,
      error,
    });

    for (let i = saga.currentStep - 1; i >= 0; i--) {
      const step = saga.steps[i];
      if (step.status === 'completed') {
        this.logger.info('Compensating step', {
          sagaId,
          stepId: step.stepId,
          stepName: step.name,
        });
      }
    }

    await this.completeSaga(sagaId, 'compensated', error);
    return saga;
  }

  async failSaga(sagaId: string, error: string): Promise<SagaState | null> {
    const saga = this.activeSagas.get(sagaId);
    if (!saga) {
      this.logger.warn('Saga not found for failure', { sagaId });
      return null;
    }

    this.clearTimeout(sagaId);
    saga.status = 'failed';
    saga.error = error;

    const currentStep = saga.steps[saga.currentStep];
    if (currentStep) {
      currentStep.status = 'failed';
      currentStep.error = error;
      currentStep.completedAt = new Date();
    }

    saga.completedAt = new Date();

    this.logger.error('Saga failed', { sagaId, error });

    if (this.eventBus) {
      const duration = saga.completedAt.getTime() - saga.startedAt.getTime();
      await this.eventBus.publishSagaEvent(
        'orchestrator.saga.completed',
        {
          sagaId,
          sagaType: saga.type,
          result: 'failed',
          duration,
          completedAt: saga.completedAt.toISOString(),
        },
        {
          correlationId: saga.correlationId,
          causationId: saga.sagaId,
          sagaType: saga.type,
          step: saga.currentStep + 1,
          totalSteps: saga.totalSteps,
          startedAt: saga.startedAt.toISOString(),
          timeout: this.defaultTimeoutMs,
        }
      );
    }

    this.archiveSaga(saga);
    this.activeSagas.delete(sagaId);

    return saga;
  }

  private async completeSaga(
    sagaId: string,
    result: 'success' | 'compensated',
    error?: string
  ): Promise<void> {
    const saga = this.activeSagas.get(sagaId);
    if (!saga) return;

    this.clearTimeout(sagaId);
    saga.status = result === 'success' ? 'completed' : 'failed';
    saga.completedAt = new Date();
    if (error) {
      saga.error = error;
    }

    const duration = saga.completedAt.getTime() - saga.startedAt.getTime();

    this.logger.info('Saga completed', {
      sagaId,
      type: saga.type,
      result,
      duration,
      stepsCompleted: saga.currentStep,
    });

    if (this.eventBus) {
      await this.eventBus.publishSagaEvent(
        'orchestrator.saga.completed',
        {
          sagaId,
          sagaType: saga.type,
          result,
          duration,
          completedAt: saga.completedAt.toISOString(),
        },
        {
          correlationId: saga.correlationId,
          causationId: saga.sagaId,
          sagaType: saga.type,
          step: saga.totalSteps,
          totalSteps: saga.totalSteps,
          startedAt: saga.startedAt.toISOString(),
          timeout: this.defaultTimeoutMs,
        }
      );
    }

    this.archiveSaga(saga);
    this.activeSagas.delete(sagaId);
  }

  getSagaStatus(sagaId: string): SagaState | null {
    return this.activeSagas.get(sagaId) || null;
  }

  getActiveSagas(): SagaState[] {
    return Array.from(this.activeSagas.values());
  }

  getActiveSagasByType(type: string): SagaState[] {
    return this.getActiveSagas().filter((saga) => saga.type === type);
  }

  getSagaByCorrelation(correlationId: string): SagaState | null {
    for (const saga of this.activeSagas.values()) {
      if (saga.correlationId === correlationId) {
        return saga;
      }
    }
    return null;
  }

  getCompletedSagas(): SagaState[] {
    return [...this.completedSagas];
  }

  private archiveSaga(saga: SagaState): void {
    this.completedSagas.unshift(saga);
    if (this.completedSagas.length > this.maxCompletedHistory) {
      this.completedSagas.pop();
    }
  }

  private setupTimeout(sagaId: string): void {
    const timeout = setTimeout(async () => {
      const saga = this.activeSagas.get(sagaId);
      if (saga && saga.status === 'running') {
        this.logger.warn('Saga timed out', { sagaId, timeout: this.defaultTimeoutMs });
        await this.compensateSaga(sagaId, 'Saga timeout exceeded');
      }
    }, this.defaultTimeoutMs);

    this.sagaTimeouts.set(sagaId, timeout);
  }

  private clearTimeout(sagaId: string): void {
    const timeout = this.sagaTimeouts.get(sagaId);
    if (timeout) {
      clearTimeout(timeout);
      this.sagaTimeouts.delete(sagaId);
    }
  }

  cleanup(): void {
    for (const timeout of this.sagaTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.sagaTimeouts.clear();
  }
}

export function createSagaCoordinator(
  logger?: { info: Function; warn: Function; error: Function }
): SagaCoordinator {
  return new SagaCoordinator(logger);
}
