/**
 * AI Active Trader - Dual-Write Repository Pattern
 * Enables gradual migration from monolith to microservices by writing to both
 * databases and reading from the configured primary source.
 */

import { Logger, createLogger } from '../common/logger';

export type DataSource = 'legacy' | 'microservice';

export interface DualWriteConfig {
  primarySource: DataSource;
  enableDualWrite: boolean;
  enableComparisonLogging: boolean;
  comparisonSampleRate: number;
  failOnMismatch: boolean;
}

export interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(options?: { limit?: number; offset?: number }): Promise<T[]>;
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: ID, entity: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
}

export interface DualWriteMetrics {
  legacyWrites: number;
  microserviceWrites: number;
  legacyReads: number;
  microserviceReads: number;
  writeMismatches: number;
  readMismatches: number;
  legacyErrors: number;
  microserviceErrors: number;
}

export class DualWriteRepository<T extends { id?: ID }, ID = string> implements Repository<T, ID> {
  private readonly logger: Logger;
  private readonly metrics: DualWriteMetrics = {
    legacyWrites: 0,
    microserviceWrites: 0,
    legacyReads: 0,
    microserviceReads: 0,
    writeMismatches: 0,
    readMismatches: 0,
    legacyErrors: 0,
    microserviceErrors: 0,
  };

  constructor(
    private readonly legacyRepo: Repository<T, ID>,
    private readonly microserviceRepo: Repository<T, ID>,
    private config: DualWriteConfig,
    private readonly entityName: string = 'Entity'
  ) {
    this.logger = createLogger(`DualWrite:${entityName}`);
  }

  updateConfig(config: Partial<DualWriteConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Configuration updated', { config: this.config });
  }

  getConfig(): DualWriteConfig {
    return { ...this.config };
  }

  getMetrics(): DualWriteMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    Object.keys(this.metrics).forEach(key => {
      (this.metrics as any)[key] = 0;
    });
  }

  async findById(id: ID): Promise<T | null> {
    const primaryRepo = this.getPrimaryRepo();
    const secondaryRepo = this.getSecondaryRepo();

    try {
      const result = await primaryRepo.findById(id);
      this.incrementReadMetric(this.config.primarySource);

      if (this.shouldCompare()) {
        await this.compareReadResults(id, result, secondaryRepo).catch(err => {
          this.logger.warn('Comparison failed', { id, error: err instanceof Error ? err.message : String(err) });
        });
      }

      return result;
    } catch (error) {
      this.incrementErrorMetric(this.config.primarySource);
      this.logger.error('Primary read failed, attempting fallback', error instanceof Error ? error : undefined, { id });
      
      try {
        const fallbackResult = await secondaryRepo.findById(id);
        this.incrementReadMetric(this.getSecondarySource());
        return fallbackResult;
      } catch (fallbackError) {
        this.incrementErrorMetric(this.getSecondarySource());
        throw fallbackError;
      }
    }
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<T[]> {
    const primaryRepo = this.getPrimaryRepo();

    try {
      const result = await primaryRepo.findAll(options);
      this.incrementReadMetric(this.config.primarySource);
      return result;
    } catch (error) {
      this.incrementErrorMetric(this.config.primarySource);
      this.logger.error('Primary findAll failed, attempting fallback', error instanceof Error ? error : undefined, { options });
      
      const secondaryRepo = this.getSecondaryRepo();
      try {
        const fallbackResult = await secondaryRepo.findAll(options);
        this.incrementReadMetric(this.getSecondarySource());
        return fallbackResult;
      } catch (fallbackError) {
        this.incrementErrorMetric(this.getSecondarySource());
        throw fallbackError;
      }
    }
  }

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    if (!this.config.enableDualWrite) {
      const primaryRepo = this.getPrimaryRepo();
      const result = await primaryRepo.create(entity);
      this.incrementWriteMetric(this.config.primarySource);
      return result;
    }

    const [legacyResult, microserviceResult] = await Promise.allSettled([
      this.legacyRepo.create(entity),
      this.microserviceRepo.create(entity),
    ]);

    this.handleDualWriteResults('create', legacyResult, microserviceResult, entity);

    const legacySuccess = legacyResult.status === 'fulfilled';
    const microserviceSuccess = microserviceResult.status === 'fulfilled';

    if (legacySuccess) this.metrics.legacyWrites++;
    else this.metrics.legacyErrors++;
    
    if (microserviceSuccess) this.metrics.microserviceWrites++;
    else this.metrics.microserviceErrors++;

    if (this.config.primarySource === 'legacy') {
      if (legacySuccess) return legacyResult.value;
      if (microserviceSuccess) return microserviceResult.value;
    } else {
      if (microserviceSuccess) return microserviceResult.value;
      if (legacySuccess) return legacyResult.value;
    }

    throw new Error(`Dual write failed for ${this.entityName}: both sources failed`);
  }

  async update(id: ID, entity: Partial<T>): Promise<T | null> {
    if (!this.config.enableDualWrite) {
      const primaryRepo = this.getPrimaryRepo();
      const result = await primaryRepo.update(id, entity);
      this.incrementWriteMetric(this.config.primarySource);
      return result;
    }

    const [legacyResult, microserviceResult] = await Promise.allSettled([
      this.legacyRepo.update(id, entity),
      this.microserviceRepo.update(id, entity),
    ]);

    this.handleDualWriteResults('update', legacyResult, microserviceResult, { id, entity });

    const legacySuccess = legacyResult.status === 'fulfilled';
    const microserviceSuccess = microserviceResult.status === 'fulfilled';

    if (legacySuccess) this.metrics.legacyWrites++;
    else this.metrics.legacyErrors++;
    
    if (microserviceSuccess) this.metrics.microserviceWrites++;
    else this.metrics.microserviceErrors++;

    if (this.config.primarySource === 'legacy') {
      if (legacySuccess) return legacyResult.value;
      if (microserviceSuccess) return microserviceResult.value;
    } else {
      if (microserviceSuccess) return microserviceResult.value;
      if (legacySuccess) return legacyResult.value;
    }

    throw new Error(`Dual write update failed for ${this.entityName} id=${id}: both sources failed`);
  }

  async delete(id: ID): Promise<boolean> {
    if (!this.config.enableDualWrite) {
      const primaryRepo = this.getPrimaryRepo();
      const result = await primaryRepo.delete(id);
      this.incrementWriteMetric(this.config.primarySource);
      return result;
    }

    const [legacyResult, microserviceResult] = await Promise.allSettled([
      this.legacyRepo.delete(id),
      this.microserviceRepo.delete(id),
    ]);

    this.handleDualWriteResults('delete', legacyResult, microserviceResult, { id });

    const legacySuccess = legacyResult.status === 'fulfilled';
    const microserviceSuccess = microserviceResult.status === 'fulfilled';

    if (legacySuccess) this.metrics.legacyWrites++;
    else this.metrics.legacyErrors++;
    
    if (microserviceSuccess) this.metrics.microserviceWrites++;
    else this.metrics.microserviceErrors++;

    if (this.config.primarySource === 'legacy') {
      if (legacySuccess) return legacyResult.value;
      if (microserviceSuccess) return microserviceResult.value;
    } else {
      if (microserviceSuccess) return microserviceResult.value;
      if (legacySuccess) return legacyResult.value;
    }

    throw new Error(`Dual write delete failed for ${this.entityName} id=${id}: both sources failed`);
  }

  private getPrimaryRepo(): Repository<T, ID> {
    return this.config.primarySource === 'legacy' ? this.legacyRepo : this.microserviceRepo;
  }

  private getSecondaryRepo(): Repository<T, ID> {
    return this.config.primarySource === 'legacy' ? this.microserviceRepo : this.legacyRepo;
  }

  private getSecondarySource(): DataSource {
    return this.config.primarySource === 'legacy' ? 'microservice' : 'legacy';
  }

  private shouldCompare(): boolean {
    return this.config.enableComparisonLogging && Math.random() < this.config.comparisonSampleRate;
  }

  private async compareReadResults(id: ID, primaryResult: T | null, secondaryRepo: Repository<T, ID>): Promise<void> {
    try {
      const secondaryResult = await secondaryRepo.findById(id);
      const areEqual = this.compareEntities(primaryResult, secondaryResult);
      
      if (!areEqual) {
        this.metrics.readMismatches++;
        this.logger.warn('Read mismatch detected', {
          id,
          primarySource: this.config.primarySource,
          primaryResult: primaryResult ? 'found' : 'null',
          secondaryResult: secondaryResult ? 'found' : 'null',
        });

        if (this.config.failOnMismatch) {
          throw new Error(`Read mismatch detected for ${this.entityName} id=${id}`);
        }
      }
    } catch (error) {
      if (this.config.failOnMismatch) throw error;
      this.logger.error('Comparison read failed', error instanceof Error ? error : undefined, { id });
    }
  }

  private handleDualWriteResults(
    operation: string,
    legacyResult: PromiseSettledResult<any>,
    microserviceResult: PromiseSettledResult<any>,
    context: any
  ): void {
    const legacySuccess = legacyResult.status === 'fulfilled';
    const microserviceSuccess = microserviceResult.status === 'fulfilled';

    if (legacySuccess && microserviceSuccess) {
      const areEqual = this.compareEntities(legacyResult.value, microserviceResult.value);
      if (!areEqual) {
        this.metrics.writeMismatches++;
        this.logger.warn('Write result mismatch', { operation, context });
      }
    } else {
      if (!legacySuccess) {
        const legacyErr = (legacyResult as PromiseRejectedResult).reason;
        this.logger.error('Legacy write failed', legacyErr instanceof Error ? legacyErr : undefined, { operation });
      }
      if (!microserviceSuccess) {
        const msErr = (microserviceResult as PromiseRejectedResult).reason;
        this.logger.error('Microservice write failed', msErr instanceof Error ? msErr : undefined, { operation });
      }
    }
  }

  private compareEntities(a: T | null, b: T | null): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    
    const normalizeForComparison = (obj: T): any => {
      const copy = { ...obj } as any;
      delete copy.createdAt;
      delete copy.updatedAt;
      return copy;
    };

    return JSON.stringify(normalizeForComparison(a)) === JSON.stringify(normalizeForComparison(b));
  }

  private incrementReadMetric(source: DataSource): void {
    if (source === 'legacy') {
      this.metrics.legacyReads++;
    } else {
      this.metrics.microserviceReads++;
    }
  }

  private incrementWriteMetric(source: DataSource): void {
    if (source === 'legacy') {
      this.metrics.legacyWrites++;
    } else {
      this.metrics.microserviceWrites++;
    }
  }

  private incrementErrorMetric(source: DataSource): void {
    if (source === 'legacy') {
      this.metrics.legacyErrors++;
    } else {
      this.metrics.microserviceErrors++;
    }
  }
}

export function createDefaultDualWriteConfig(overrides?: Partial<DualWriteConfig>): DualWriteConfig {
  return {
    primarySource: 'legacy',
    enableDualWrite: true,
    enableComparisonLogging: true,
    comparisonSampleRate: 0.1,
    failOnMismatch: false,
    ...overrides,
  };
}
