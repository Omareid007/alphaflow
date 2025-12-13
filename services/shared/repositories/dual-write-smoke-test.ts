/**
 * AI Active Trader - DualWriteRepository Smoke Test
 * Validates the dual-write repository pattern works correctly
 */

import { 
  DualWriteRepository, 
  Repository, 
  createDefaultDualWriteConfig,
  DualWriteConfig 
} from './dual-write-repository';

interface TestEntity {
  id?: string;
  name: string;
  value: number;
  createdAt?: Date;
  updatedAt?: Date;
}

class InMemoryRepository implements Repository<TestEntity, string> {
  private store: Map<string, TestEntity> = new Map();
  private idCounter = 0;

  async findById(id: string): Promise<TestEntity | null> {
    return this.store.get(id) || null;
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<TestEntity[]> {
    const all = Array.from(this.store.values());
    const offset = options?.offset || 0;
    const limit = options?.limit || all.length;
    return all.slice(offset, offset + limit);
  }

  async create(entity: Omit<TestEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestEntity> {
    const id = `entity-${++this.idCounter}`;
    const now = new Date();
    const newEntity: TestEntity = {
      ...entity,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(id, newEntity);
    return newEntity;
  }

  async update(id: string, entity: Partial<TestEntity>): Promise<TestEntity | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated: TestEntity = {
      ...existing,
      ...entity,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  clear(): void {
    this.store.clear();
    this.idCounter = 0;
  }

  getStore(): Map<string, TestEntity> {
    return new Map(this.store);
  }
}

class FailingRepository implements Repository<TestEntity, string> {
  async findById(): Promise<TestEntity | null> {
    throw new Error('Repository failure');
  }
  async findAll(): Promise<TestEntity[]> {
    throw new Error('Repository failure');
  }
  async create(): Promise<TestEntity> {
    throw new Error('Repository failure');
  }
  async update(): Promise<TestEntity | null> {
    throw new Error('Repository failure');
  }
  async delete(): Promise<boolean> {
    throw new Error('Repository failure');
  }
}

async function runTests(): Promise<void> {
  console.log('=== DualWriteRepository Smoke Tests ===\n');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`✗ ${name}`);
      console.log(`  Error: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  await test('Create with dual-write writes to both repositories', async () => {
    const legacyRepo = new InMemoryRepository();
    const msRepo = new InMemoryRepository();
    const config = createDefaultDualWriteConfig({ enableDualWrite: true });
    const dualRepo = new DualWriteRepository(legacyRepo, msRepo, config, 'Test');

    await dualRepo.create({ name: 'test', value: 42 });

    const legacyStore = legacyRepo.getStore();
    const msStore = msRepo.getStore();

    if (legacyStore.size !== 1) throw new Error('Legacy store should have 1 entity');
    if (msStore.size !== 1) throw new Error('Microservice store should have 1 entity');
  });

  await test('Read from primary source (legacy)', async () => {
    const legacyRepo = new InMemoryRepository();
    const msRepo = new InMemoryRepository();
    const config = createDefaultDualWriteConfig({ primarySource: 'legacy' });
    const dualRepo = new DualWriteRepository(legacyRepo, msRepo, config, 'Test');

    const created = await dualRepo.create({ name: 'test', value: 100 });
    const found = await dualRepo.findById(created.id!);

    if (!found) throw new Error('Should find entity');
    if (found.name !== 'test') throw new Error('Entity name mismatch');
  });

  await test('Read from primary source (microservice)', async () => {
    const legacyRepo = new InMemoryRepository();
    const msRepo = new InMemoryRepository();
    const config = createDefaultDualWriteConfig({ primarySource: 'microservice' });
    const dualRepo = new DualWriteRepository(legacyRepo, msRepo, config, 'Test');

    const created = await dualRepo.create({ name: 'ms-test', value: 200 });
    const found = await dualRepo.findById(created.id!);

    if (!found) throw new Error('Should find entity');
    if (found.name !== 'ms-test') throw new Error('Entity name mismatch');
  });

  await test('Update writes to both repositories', async () => {
    const legacyRepo = new InMemoryRepository();
    const msRepo = new InMemoryRepository();
    const config = createDefaultDualWriteConfig({ enableDualWrite: true });
    const dualRepo = new DualWriteRepository(legacyRepo, msRepo, config, 'Test');

    const created = await dualRepo.create({ name: 'original', value: 1 });
    await dualRepo.update(created.id!, { name: 'updated', value: 2 });

    const legacyEntity = await legacyRepo.findById(created.id!);
    const msEntity = await msRepo.findById(created.id!);

    if (legacyEntity?.name !== 'updated') throw new Error('Legacy should be updated');
    if (msEntity?.name !== 'updated') throw new Error('Microservice should be updated');
  });

  await test('Delete removes from both repositories', async () => {
    const legacyRepo = new InMemoryRepository();
    const msRepo = new InMemoryRepository();
    const config = createDefaultDualWriteConfig({ enableDualWrite: true });
    const dualRepo = new DualWriteRepository(legacyRepo, msRepo, config, 'Test');

    const created = await dualRepo.create({ name: 'to-delete', value: 0 });
    await dualRepo.delete(created.id!);

    const legacyEntity = await legacyRepo.findById(created.id!);
    const msEntity = await msRepo.findById(created.id!);

    if (legacyEntity !== null) throw new Error('Legacy entity should be deleted');
    if (msEntity !== null) throw new Error('Microservice entity should be deleted');
  });

  await test('Fallback to secondary on primary failure', async () => {
    const failingRepo = new FailingRepository();
    const workingRepo = new InMemoryRepository();
    
    await workingRepo.create({ name: 'fallback-test', value: 999 });
    
    const config: DualWriteConfig = {
      primarySource: 'legacy',
      enableDualWrite: false,
      enableComparisonLogging: false,
      comparisonSampleRate: 0,
      failOnMismatch: false,
    };
    const dualRepo = new DualWriteRepository(failingRepo, workingRepo, config, 'Test');

    const results = await dualRepo.findAll();
    if (results.length !== 1) throw new Error('Should fallback to secondary');
    if (results[0].name !== 'fallback-test') throw new Error('Fallback data mismatch');
  });

  await test('Metrics track operations correctly', async () => {
    const legacyRepo = new InMemoryRepository();
    const msRepo = new InMemoryRepository();
    const config = createDefaultDualWriteConfig({ 
      enableDualWrite: true,
      enableComparisonLogging: false 
    });
    const dualRepo = new DualWriteRepository(legacyRepo, msRepo, config, 'Test');

    await dualRepo.create({ name: 'metrics-test', value: 1 });
    const created = await legacyRepo.findAll();
    await dualRepo.findById(created[0].id!);

    const metrics = dualRepo.getMetrics();
    if (metrics.legacyWrites < 1) throw new Error('Legacy writes should be tracked');
    if (metrics.legacyReads < 1) throw new Error('Legacy reads should be tracked');
  });

  await test('Dual-write tracks metrics for BOTH repositories when both succeed', async () => {
    const legacyRepo = new InMemoryRepository();
    const msRepo = new InMemoryRepository();
    const config = createDefaultDualWriteConfig({ 
      enableDualWrite: true,
      enableComparisonLogging: false 
    });
    const dualRepo = new DualWriteRepository(legacyRepo, msRepo, config, 'Test');

    await dualRepo.create({ name: 'dual-metrics', value: 1 });
    const metrics = dualRepo.getMetrics();
    
    if (metrics.legacyWrites !== 1) throw new Error(`Legacy writes should be 1, got ${metrics.legacyWrites}`);
    if (metrics.microserviceWrites !== 1) throw new Error(`Microservice writes should be 1, got ${metrics.microserviceWrites}`);
    if (metrics.legacyErrors !== 0) throw new Error('No legacy errors expected');
    if (metrics.microserviceErrors !== 0) throw new Error('No microservice errors expected');
  });

  await test('Config can be updated at runtime', async () => {
    const legacyRepo = new InMemoryRepository();
    const msRepo = new InMemoryRepository();
    const config = createDefaultDualWriteConfig({ primarySource: 'legacy' });
    const dualRepo = new DualWriteRepository(legacyRepo, msRepo, config, 'Test');

    dualRepo.updateConfig({ primarySource: 'microservice' });
    const newConfig = dualRepo.getConfig();

    if (newConfig.primarySource !== 'microservice') throw new Error('Config should be updated');
  });

  await test('Single-write mode when dual-write disabled', async () => {
    const legacyRepo = new InMemoryRepository();
    const msRepo = new InMemoryRepository();
    const config = createDefaultDualWriteConfig({ 
      enableDualWrite: false,
      primarySource: 'legacy' 
    });
    const dualRepo = new DualWriteRepository(legacyRepo, msRepo, config, 'Test');

    await dualRepo.create({ name: 'single-write', value: 1 });

    const legacyStore = legacyRepo.getStore();
    const msStore = msRepo.getStore();

    if (legacyStore.size !== 1) throw new Error('Legacy should have entity');
    if (msStore.size !== 0) throw new Error('Microservice should be empty');
  });

  await test('Metrics can be reset', async () => {
    const legacyRepo = new InMemoryRepository();
    const msRepo = new InMemoryRepository();
    const config = createDefaultDualWriteConfig();
    const dualRepo = new DualWriteRepository(legacyRepo, msRepo, config, 'Test');

    await dualRepo.create({ name: 'reset-test', value: 1 });
    dualRepo.resetMetrics();
    const metrics = dualRepo.getMetrics();

    if (metrics.legacyWrites !== 0) throw new Error('Metrics should be reset');
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
