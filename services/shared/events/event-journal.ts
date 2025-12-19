/**
 * AI Active Trader - Event Journal
 * LMAX Architecture-inspired event sourcing with deterministic replay
 * 
 * Features:
 * - Append-only disk journal for durability
 * - Sequence-based ordering with checksums
 * - Periodic checkpointing for fast recovery
 * - Replica synchronization for failover
 * - Deterministic replay from any checkpoint
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createLogger } from '../common/logger';
import type { EventMetadata } from './types';

const logger = createLogger('event-journal');

export enum JournalState {
  IDLE = 'IDLE',
  WRITING = 'WRITING',
  REPLAYING = 'REPLAYING',
  SYNCING = 'SYNCING',
  RECOVERING = 'RECOVERING',
  CLOSED = 'CLOSED',
}

export enum ReplicaRole {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  STANDALONE = 'STANDALONE',
}

export interface JournalEntry<T = unknown> {
  sequence: number;
  timestamp: number;
  eventType: string;
  payload: T;
  metadata: Partial<EventMetadata>;
  checksum: string;
  version: number;
}

export interface JournalCheckpoint {
  checkpointId: string;
  sequence: number;
  timestamp: number;
  snapshotPath: string;
  entryCount: number;
  checksum: string;
  segmentIds: string[];
}

export interface JournalSegment {
  segmentId: string;
  startSequence: number;
  endSequence: number;
  filePath: string;
  fileSize: number;
  createdAt: number;
  closedAt?: number;
  entryCount: number;
  isOpen: boolean;
}

export interface JournalIndex {
  version: number;
  replicaId: string;
  lastSequence: number;
  segments: JournalSegment[];
  checkpoints: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ReplicaInfo {
  id: string;
  endpoint: string;
  role: ReplicaRole;
  lastSyncSequence: number;
  lastSyncTime: number;
  isHealthy: boolean;
  lag: number;
}

export interface JournalConfig {
  journalDir: string;
  segmentMaxSize: number;
  segmentMaxEntries: number;
  checkpointIntervalMs: number;
  checkpointMinEntries: number;
  syncIntervalMs: number;
  flushOnWrite: boolean;
  enableCompression: boolean;
  replicaId: string;
  role: ReplicaRole;
  maxReplayBatchSize: number;
}

export interface JournalMetrics {
  totalEntries: number;
  totalSegments: number;
  totalCheckpoints: number;
  lastSequence: number;
  lastWriteTime: number;
  bytesWritten: number;
  replayCount: number;
  avgWriteLatencyUs: number;
  segmentRotations: number;
  checksumErrors: number;
}

export interface ReplayOptions {
  fromSequence?: number;
  toSequence?: number;
  fromCheckpoint?: string;
  eventTypes?: string[];
  batchSize?: number;
  onEntry?: (entry: JournalEntry) => Promise<void> | void;
  onBatch?: (entries: JournalEntry[]) => Promise<void> | void;
  onProgress?: (current: number, total: number) => void;
}

export interface SnapshotData {
  sequence: number;
  timestamp: number;
  state: Record<string, unknown>;
  checksum: string;
}

const JOURNAL_VERSION = 1;
const ENTRY_DELIMITER = '\n';
const SEGMENT_PREFIX = 'segment-';
const CHECKPOINT_PREFIX = 'checkpoint-';
const SEGMENT_EXTENSION = '.journal';
const CHECKPOINT_EXTENSION = '.checkpoint';
const SNAPSHOT_EXTENSION = '.snapshot';
const INDEX_FILE = 'journal-index.json';

const DEFAULT_CONFIG: JournalConfig = {
  journalDir: './data/journal',
  segmentMaxSize: 64 * 1024 * 1024,
  segmentMaxEntries: 100000,
  checkpointIntervalMs: 60000,
  checkpointMinEntries: 1000,
  syncIntervalMs: 5000,
  flushOnWrite: true,
  enableCompression: false,
  replicaId: 'primary-0',
  role: ReplicaRole.STANDALONE,
  maxReplayBatchSize: 1000,
};

export class EventJournal {
  private static instance: EventJournal;
  
  private config: JournalConfig;
  private state: JournalState = JournalState.IDLE;
  private segments: JournalSegment[] = [];
  private checkpoints: JournalCheckpoint[] = [];
  private replicas: Map<string, ReplicaInfo> = new Map();
  private currentSegment: JournalSegment | null = null;
  private currentFileHandle: fs.promises.FileHandle | null = null;
  private sequence: number = 0;
  private checkpointTimer: ReturnType<typeof setInterval> | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private entriesSinceCheckpoint: number = 0;
  private indexPath: string = '';
  
  private metrics: JournalMetrics = {
    totalEntries: 0,
    totalSegments: 0,
    totalCheckpoints: 0,
    lastSequence: 0,
    lastWriteTime: 0,
    bytesWritten: 0,
    replayCount: 0,
    avgWriteLatencyUs: 0,
    segmentRotations: 0,
    checksumErrors: 0,
  };
  private writeLatencySum = 0;
  private writeLatencyCount = 0;

  private constructor(config?: Partial<JournalConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.indexPath = path.join(this.config.journalDir, INDEX_FILE);
  }

  static getInstance(config?: Partial<JournalConfig>): EventJournal {
    if (!EventJournal.instance) {
      EventJournal.instance = new EventJournal(config);
    }
    return EventJournal.instance;
  }

  static resetInstance(): void {
    if (EventJournal.instance) {
      EventJournal.instance.close();
    }
    EventJournal.instance = undefined as unknown as EventJournal;
  }

  async initialize(): Promise<void> {
    await fs.promises.mkdir(this.config.journalDir, { recursive: true });
    
    const indexExists = await this.fileExists(this.indexPath);
    
    if (indexExists) {
      await this.loadFromIndex();
    } else {
      await this.discoverExistingSegments();
    }
    
    await this.loadExistingCheckpoints();
    
    const openSegment = this.segments.find(s => s.isOpen);
    
    if (openSegment) {
      await this.recoverAndReopenSegment(openSegment);
    } else if (this.segments.length > 0) {
      const lastSegment = this.segments[this.segments.length - 1];
      this.sequence = lastSegment.endSequence;
      await this.openNewSegment();
    } else {
      await this.openNewSegment();
    }
    
    await this.persistIndex();
    
    this.startCheckpointTimer();
    
    if (this.config.role !== ReplicaRole.STANDALONE) {
      this.startSyncTimer();
    }
    
    logger.info('Event journal initialized', {
      journalDir: this.config.journalDir,
      segments: this.segments.length,
      checkpoints: this.checkpoints.length,
      lastSequence: this.sequence,
      role: this.config.role,
    });
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async loadFromIndex(): Promise<void> {
    try {
      const content = await fs.promises.readFile(this.indexPath, 'utf-8');
      const index = JSON.parse(content) as JournalIndex;
      
      this.segments = index.segments;
      this.sequence = index.lastSequence;
      this.metrics.totalSegments = this.segments.length;
      
      for (const segment of this.segments) {
        const exists = await this.fileExists(segment.filePath);
        if (!exists) {
          logger.warn('Segment file missing, removing from index', { segmentId: segment.segmentId });
          this.segments = this.segments.filter(s => s.segmentId !== segment.segmentId);
        }
      }
      
      logger.info('Loaded journal from index', { 
        segments: this.segments.length, 
        lastSequence: this.sequence,
      });
    } catch (error) {
      logger.warn('Failed to load index, discovering segments', { error });
      await this.discoverExistingSegments();
    }
  }

  private async discoverExistingSegments(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.config.journalDir);
      const segmentFiles = files
        .filter(f => f.startsWith(SEGMENT_PREFIX) && f.endsWith(SEGMENT_EXTENSION))
        .sort();
      
      for (const file of segmentFiles) {
        const filePath = path.join(this.config.journalDir, file);
        const stats = await fs.promises.stat(filePath);
        
        const closedMatch = file.match(/segment-(\d+)-(\d+)/);
        const openMatch = file.match(/segment-(\d+)-open/);
        
        if (closedMatch) {
          const startSeq = parseInt(closedMatch[1], 10);
          const endSeq = parseInt(closedMatch[2], 10);
          
          this.segments.push({
            segmentId: file.replace(SEGMENT_EXTENSION, ''),
            startSequence: startSeq,
            endSequence: endSeq,
            filePath,
            fileSize: stats.size,
            createdAt: stats.birthtimeMs,
            closedAt: stats.mtimeMs,
            entryCount: endSeq - startSeq + 1,
            isOpen: false,
          });
          
          if (endSeq > this.sequence) {
            this.sequence = endSeq;
          }
        } else if (openMatch) {
          const startSeq = parseInt(openMatch[1], 10);
          
          this.segments.push({
            segmentId: file.replace(SEGMENT_EXTENSION, ''),
            startSequence: startSeq,
            endSequence: startSeq - 1,
            filePath,
            fileSize: stats.size,
            createdAt: stats.birthtimeMs,
            entryCount: 0,
            isOpen: true,
          });
        }
      }
      
      this.segments.sort((a, b) => a.startSequence - b.startSequence);
      this.metrics.totalSegments = this.segments.length;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async loadExistingCheckpoints(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.config.journalDir);
      const checkpointFiles = files
        .filter(f => f.startsWith(CHECKPOINT_PREFIX) && f.endsWith(CHECKPOINT_EXTENSION))
        .sort();
      
      for (const file of checkpointFiles) {
        const filePath = path.join(this.config.journalDir, file);
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const checkpoint = JSON.parse(content) as JournalCheckpoint;
          
          if (checkpoint.snapshotPath) {
            const snapshotExists = await this.fileExists(checkpoint.snapshotPath);
            if (!snapshotExists) {
              logger.warn('Checkpoint snapshot missing', { checkpointId: checkpoint.checkpointId });
              continue;
            }
          }
          
          this.checkpoints.push(checkpoint);
        } catch (error) {
          logger.warn('Failed to load checkpoint', { file, error });
        }
      }
      
      this.checkpoints.sort((a, b) => a.sequence - b.sequence);
      this.metrics.totalCheckpoints = this.checkpoints.length;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async recoverAndReopenSegment(segment: JournalSegment): Promise<void> {
    this.state = JournalState.RECOVERING;
    logger.info('Recovering open segment', { segmentId: segment.segmentId });
    
    try {
      const content = await fs.promises.readFile(segment.filePath, 'utf-8');
      const lines = content.split(ENTRY_DELIMITER).filter(l => l.trim());
      
      let lastValidSequence = segment.startSequence - 1;
      let validEntries = 0;
      const validLines: string[] = [];
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as JournalEntry;
          if (this.verifyChecksum(entry)) {
            if (entry.sequence !== lastValidSequence + 1) {
              logger.error('Sequence gap detected during recovery', undefined, { 
                expected: lastValidSequence + 1, 
                found: entry.sequence,
              });
              break;
            }
            lastValidSequence = entry.sequence;
            validEntries++;
            validLines.push(line);
          } else {
            logger.warn('Checksum mismatch during recovery', { sequence: entry.sequence });
            this.metrics.checksumErrors++;
            break;
          }
        } catch {
          logger.warn('Corrupt entry during recovery, truncating');
          break;
        }
      }
      
      if (validLines.length !== lines.length) {
        const validContent = validLines.join(ENTRY_DELIMITER) + (validLines.length > 0 ? ENTRY_DELIMITER : '');
        await fs.promises.writeFile(segment.filePath, validContent);
        logger.info('Truncated corrupt entries from segment', { 
          original: lines.length, 
          valid: validLines.length,
        });
      }
      
      segment.endSequence = lastValidSequence;
      segment.entryCount = validEntries;
      segment.fileSize = Buffer.byteLength(validLines.join(ENTRY_DELIMITER) + ENTRY_DELIMITER, 'utf-8');
      this.sequence = lastValidSequence;
      
      this.currentFileHandle = await fs.promises.open(segment.filePath, 'a');
      this.currentSegment = segment;
      
      logger.info('Segment recovery complete', { 
        segmentId: segment.segmentId, 
        validEntries,
        lastSequence: lastValidSequence,
      });
    } catch (error) {
      logger.error('Segment recovery failed', error instanceof Error ? error : undefined);
      segment.isOpen = false;
      await this.openNewSegment();
    } finally {
      this.state = JournalState.IDLE;
    }
  }

  private async persistIndex(): Promise<void> {
    const segmentsSnapshot: JournalSegment[] = this.segments.map(s => ({
      segmentId: s.segmentId,
      startSequence: s.startSequence,
      endSequence: s.endSequence,
      filePath: s.filePath,
      fileSize: s.fileSize,
      createdAt: s.createdAt,
      closedAt: s.closedAt,
      entryCount: s.entryCount,
      isOpen: s.isOpen,
    }));
    
    const index: JournalIndex = {
      version: JOURNAL_VERSION,
      replicaId: this.config.replicaId,
      lastSequence: this.sequence,
      segments: segmentsSnapshot,
      checkpoints: this.checkpoints.map(c => c.checkpointId),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    const tempPath = this.indexPath + '.tmp';
    await fs.promises.writeFile(tempPath, JSON.stringify(index, null, 2));
    await fs.promises.rename(tempPath, this.indexPath);
  }

  private async openNewSegment(): Promise<void> {
    if (this.currentFileHandle) {
      await this.currentFileHandle.sync();
      await this.currentFileHandle.close();
      this.currentFileHandle = null;
    }
    
    if (this.currentSegment && this.currentSegment.isOpen) {
      await this.closeCurrentSegment();
    }
    
    const startSeq = this.sequence + 1;
    const segmentId = `${SEGMENT_PREFIX}${startSeq.toString().padStart(12, '0')}-open`;
    const filePath = path.join(this.config.journalDir, `${segmentId}${SEGMENT_EXTENSION}`);
    
    this.currentFileHandle = await fs.promises.open(filePath, 'a');
    
    this.currentSegment = {
      segmentId,
      startSequence: startSeq,
      endSequence: startSeq - 1,
      filePath,
      fileSize: 0,
      createdAt: Date.now(),
      entryCount: 0,
      isOpen: true,
    };
    
    this.segments.push(this.currentSegment);
    this.metrics.totalSegments++;
    this.metrics.segmentRotations++;
    
    await this.persistIndex();
  }

  private async closeCurrentSegment(): Promise<void> {
    if (!this.currentSegment || !this.currentSegment.isOpen) return;
    
    if (this.currentFileHandle) {
      await this.currentFileHandle.sync();
      await this.currentFileHandle.close();
      this.currentFileHandle = null;
    }
    
    this.currentSegment.closedAt = Date.now();
    this.currentSegment.isOpen = false;
    
    const newSegmentId = `${SEGMENT_PREFIX}${this.currentSegment.startSequence.toString().padStart(12, '0')}-${this.currentSegment.endSequence.toString().padStart(12, '0')}`;
    const newFilePath = path.join(this.config.journalDir, `${newSegmentId}${SEGMENT_EXTENSION}`);
    
    await fs.promises.rename(this.currentSegment.filePath, newFilePath);
    this.currentSegment.segmentId = newSegmentId;
    this.currentSegment.filePath = newFilePath;
    
    const idx = this.segments.findIndex(s => s.segmentId.includes('-open'));
    if (idx >= 0) {
      this.segments[idx] = this.currentSegment;
    }
    
    await this.persistIndex();
    
    this.currentSegment = null;
  }

  private computeChecksum(entry: Omit<JournalEntry, 'checksum'>): string {
    const data = JSON.stringify({
      sequence: entry.sequence,
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      payload: entry.payload,
      metadata: entry.metadata,
      version: entry.version,
    });
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private verifyChecksum(entry: JournalEntry): boolean {
    const { checksum, ...rest } = entry;
    const computed = this.computeChecksum(rest);
    return computed === checksum;
  }

  async append<T>(
    eventType: string,
    payload: T,
    metadata: Partial<EventMetadata> = {}
  ): Promise<number> {
    if (this.state === JournalState.CLOSED) {
      throw new Error('Journal is closed');
    }
    
    if (this.state === JournalState.REPLAYING) {
      throw new Error('Cannot append during replay');
    }
    
    const startTime = performance.now();
    this.state = JournalState.WRITING;
    
    try {
      this.sequence++;
      const timestamp = Date.now();
      
      const entryWithoutChecksum = {
        sequence: this.sequence,
        timestamp,
        eventType,
        payload,
        metadata: {
          ...metadata,
          eventId: metadata.eventId || `evt-${this.sequence}-${timestamp}`,
          timestamp: metadata.timestamp || new Date(timestamp).toISOString(),
        },
        version: JOURNAL_VERSION,
      };
      
      const entry: JournalEntry<T> = {
        ...entryWithoutChecksum,
        checksum: this.computeChecksum(entryWithoutChecksum),
      };
      
      if (!this.currentSegment || !this.currentFileHandle) {
        await this.openNewSegment();
      }
      
      const line = JSON.stringify(entry) + ENTRY_DELIMITER;
      const buffer = Buffer.from(line, 'utf-8');
      
      await this.currentFileHandle!.write(buffer);
      
      if (this.config.flushOnWrite) {
        await this.currentFileHandle!.sync();
      }
      
      this.currentSegment!.endSequence = this.sequence;
      this.currentSegment!.entryCount++;
      this.currentSegment!.fileSize += buffer.length;
      
      this.metrics.totalEntries++;
      this.metrics.lastSequence = this.sequence;
      this.metrics.lastWriteTime = timestamp;
      this.metrics.bytesWritten += buffer.length;
      this.entriesSinceCheckpoint++;
      
      const latencyUs = (performance.now() - startTime) * 1000;
      this.writeLatencySum += latencyUs;
      this.writeLatencyCount++;
      this.metrics.avgWriteLatencyUs = this.writeLatencySum / this.writeLatencyCount;
      
      if (this.shouldRotateSegment()) {
        await this.closeCurrentSegment();
        await this.openNewSegment();
      }
      
      return this.sequence;
    } finally {
      this.state = JournalState.IDLE;
    }
  }

  async appendBatch<T>(
    events: Array<{ eventType: string; payload: T; metadata?: Partial<EventMetadata> }>
  ): Promise<number[]> {
    const sequences: number[] = [];
    
    for (const event of events) {
      const seq = await this.append(event.eventType, event.payload, event.metadata);
      sequences.push(seq);
    }
    
    return sequences;
  }

  private shouldRotateSegment(): boolean {
    if (!this.currentSegment) return false;
    
    return (
      this.currentSegment.fileSize >= this.config.segmentMaxSize ||
      this.currentSegment.entryCount >= this.config.segmentMaxEntries
    );
  }

  async createCheckpoint(snapshotState?: Record<string, unknown>): Promise<JournalCheckpoint> {
    if (this.currentSegment && this.currentFileHandle) {
      await this.currentFileHandle.sync();
    }
    
    const checkpointId = `${CHECKPOINT_PREFIX}${this.sequence.toString().padStart(12, '0')}-${Date.now()}`;
    const snapshotPath = path.join(this.config.journalDir, `${checkpointId}${SNAPSHOT_EXTENSION}`);
    
    if (snapshotState) {
      const snapshot: SnapshotData = {
        sequence: this.sequence,
        timestamp: Date.now(),
        state: snapshotState,
        checksum: crypto.createHash('sha256')
          .update(JSON.stringify(snapshotState))
          .digest('hex')
          .substring(0, 16),
      };
      
      const tempPath = snapshotPath + '.tmp';
      await fs.promises.writeFile(tempPath, JSON.stringify(snapshot, null, 2));
      await fs.promises.rename(tempPath, snapshotPath);
    }
    
    const segmentIds = this.segments
      .filter(s => s.endSequence <= this.sequence)
      .map(s => s.segmentId);
    
    const checkpoint: JournalCheckpoint = {
      checkpointId,
      sequence: this.sequence,
      timestamp: Date.now(),
      snapshotPath: snapshotState ? snapshotPath : '',
      entryCount: this.metrics.totalEntries,
      checksum: crypto.createHash('sha256')
        .update(`${checkpointId}-${this.sequence}-${Date.now()}`)
        .digest('hex')
        .substring(0, 16),
      segmentIds,
    };
    
    const checkpointPath = path.join(
      this.config.journalDir,
      `${checkpointId}${CHECKPOINT_EXTENSION}`
    );
    
    const tempCheckpointPath = checkpointPath + '.tmp';
    await fs.promises.writeFile(tempCheckpointPath, JSON.stringify(checkpoint, null, 2));
    await fs.promises.rename(tempCheckpointPath, checkpointPath);
    
    this.checkpoints.push(checkpoint);
    this.metrics.totalCheckpoints++;
    this.entriesSinceCheckpoint = 0;
    
    await this.persistIndex();
    
    logger.info('Checkpoint created', { checkpointId, sequence: this.sequence });
    
    return checkpoint;
  }

  async loadSnapshotState(checkpoint: JournalCheckpoint): Promise<Record<string, unknown> | null> {
    if (!checkpoint.snapshotPath) {
      return null;
    }
    
    try {
      const content = await fs.promises.readFile(checkpoint.snapshotPath, 'utf-8');
      const snapshot = JSON.parse(content) as SnapshotData;
      
      const computedChecksum = crypto.createHash('sha256')
        .update(JSON.stringify(snapshot.state))
        .digest('hex')
        .substring(0, 16);
      
      if (computedChecksum !== snapshot.checksum) {
        logger.error('Snapshot checksum mismatch', undefined, { 
          checkpointId: checkpoint.checkpointId,
          expected: snapshot.checksum,
          computed: computedChecksum,
        });
        this.metrics.checksumErrors++;
        return null;
      }
      
      return snapshot.state;
    } catch (error) {
      logger.error('Failed to load snapshot', error instanceof Error ? error : undefined);
      return null;
    }
  }

  private startCheckpointTimer(): void {
    this.checkpointTimer = setInterval(async () => {
      if (this.entriesSinceCheckpoint >= this.config.checkpointMinEntries) {
        try {
          await this.createCheckpoint();
        } catch (error) {
          logger.error('Auto-checkpoint failed', error instanceof Error ? error : undefined);
        }
      }
    }, this.config.checkpointIntervalMs);
  }

  private startSyncTimer(): void {
    this.syncTimer = setInterval(async () => {
      await this.syncWithReplicas();
    }, this.config.syncIntervalMs);
  }

  async replay(options: ReplayOptions = {}): Promise<number> {
    this.state = JournalState.REPLAYING;
    this.metrics.replayCount++;
    
    try {
      let fromSequence = options.fromSequence ?? 1;
      const toSequence = options.toSequence ?? this.sequence;
      const batchSize = options.batchSize ?? this.config.maxReplayBatchSize;
      
      if (options.fromCheckpoint) {
        const checkpoint = this.checkpoints.find(c => c.checkpointId === options.fromCheckpoint);
        if (checkpoint) {
          fromSequence = checkpoint.sequence + 1;
        }
      }
      
      if (fromSequence > toSequence) {
        return 0;
      }
      
      const relevantSegments = this.getSegmentsInRange(fromSequence, toSequence);
      let processedCount = 0;
      let batch: JournalEntry[] = [];
      const total = toSequence - fromSequence + 1;
      let expectedSequence = fromSequence;
      
      for (const segment of relevantSegments) {
        const entries = await this.readSegmentEntries(segment, fromSequence, toSequence);
        
        entries.sort((a, b) => a.sequence - b.sequence);
        
        for (const entry of entries) {
          if (!this.verifyChecksum(entry)) {
            logger.error('Checksum mismatch during replay', undefined, { sequence: entry.sequence });
            this.metrics.checksumErrors++;
            throw new Error(`Checksum mismatch at sequence ${entry.sequence}`);
          }
          
          if (entry.sequence !== expectedSequence) {
            throw new Error(`Sequence gap: expected ${expectedSequence}, got ${entry.sequence}`);
          }
          expectedSequence++;
          
          if (options.eventTypes && !options.eventTypes.includes(entry.eventType)) {
            continue;
          }
          
          if (options.onEntry) {
            await options.onEntry(entry);
          }
          
          if (options.onBatch) {
            batch.push(entry);
            if (batch.length >= batchSize) {
              await options.onBatch(batch);
              batch = [];
            }
          }
          
          processedCount++;
          
          if (options.onProgress) {
            options.onProgress(processedCount, total);
          }
        }
      }
      
      if (options.onBatch && batch.length > 0) {
        await options.onBatch(batch);
      }
      
      logger.info('Replay completed', { 
        fromSequence, 
        toSequence, 
        processedCount,
      });
      
      return processedCount;
    } finally {
      this.state = JournalState.IDLE;
    }
  }

  private getSegmentsInRange(from: number, to: number): JournalSegment[] {
    const result: JournalSegment[] = [];
    
    for (const segment of this.segments) {
      if (segment.endSequence >= from && segment.startSequence <= to) {
        result.push(segment);
      }
    }
    
    return result.sort((a, b) => a.startSequence - b.startSequence);
  }

  private async readSegmentEntries(
    segment: JournalSegment,
    fromSequence: number,
    toSequence: number
  ): Promise<JournalEntry[]> {
    const content = await fs.promises.readFile(segment.filePath, 'utf-8');
    const lines = content.split(ENTRY_DELIMITER).filter(l => l.trim());
    
    const entries: JournalEntry[] = [];
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as JournalEntry;
        if (entry.sequence >= fromSequence && entry.sequence <= toSequence) {
          entries.push(entry);
        }
      } catch {
        logger.warn('Failed to parse entry during replay', { segment: segment.segmentId });
      }
    }
    
    return entries;
  }

  async getEntry(sequence: number): Promise<JournalEntry | null> {
    const segments = this.getSegmentsInRange(sequence, sequence);
    
    if (segments.length === 0) {
      return null;
    }
    
    const entries = await this.readSegmentEntries(segments[0], sequence, sequence);
    return entries.length > 0 ? entries[0] : null;
  }

  async getEntriesSince(fromSequence: number, limit?: number): Promise<JournalEntry[]> {
    const toSequence = limit ? Math.min(fromSequence + limit - 1, this.sequence) : this.sequence;
    
    const segments = this.getSegmentsInRange(fromSequence, toSequence);
    const entries: JournalEntry[] = [];
    
    for (const segment of segments) {
      const segmentEntries = await this.readSegmentEntries(segment, fromSequence, toSequence);
      entries.push(...segmentEntries);
      
      if (limit && entries.length >= limit) {
        break;
      }
    }
    
    entries.sort((a, b) => a.sequence - b.sequence);
    
    return limit ? entries.slice(0, limit) : entries;
  }

  registerReplica(replica: ReplicaInfo): void {
    this.replicas.set(replica.id, replica);
    logger.info('Replica registered', { 
      id: replica.id, 
      role: replica.role, 
      endpoint: replica.endpoint,
    });
  }

  unregisterReplica(replicaId: string): void {
    this.replicas.delete(replicaId);
    logger.info('Replica unregistered', { id: replicaId });
  }

  private async syncWithReplicas(): Promise<void> {
    if (this.config.role !== ReplicaRole.PRIMARY) {
      return;
    }
    
    this.state = JournalState.SYNCING;
    
    try {
      for (const [id, replica] of this.replicas) {
        if (replica.role === ReplicaRole.SECONDARY) {
          const lag = this.sequence - replica.lastSyncSequence;
          replica.lag = lag;
          
          if (lag > 0) {
            const entries = await this.getEntriesSince(
              replica.lastSyncSequence + 1,
              Math.min(lag, this.config.maxReplayBatchSize)
            );
            
            logger.debug('Sync entries to replica', { 
              replicaId: id, 
              entries: entries.length, 
              lag,
            });
          }
        }
      }
    } finally {
      this.state = JournalState.IDLE;
    }
  }

  async promoteToReplica(replicaId: string): Promise<boolean> {
    const replica = this.replicas.get(replicaId);
    
    if (!replica) {
      logger.error('Replica not found for promotion', undefined, { replicaId });
      return false;
    }
    
    if (replica.lag > this.config.maxReplayBatchSize) {
      logger.error('Replica too far behind for promotion', undefined, { 
        replicaId, 
        lag: replica.lag,
      });
      return false;
    }
    
    this.config.role = ReplicaRole.SECONDARY;
    replica.role = ReplicaRole.PRIMARY;
    
    logger.warn('Replica promoted to primary', { 
      newPrimary: replicaId, 
      previousPrimary: this.config.replicaId,
    });
    
    return true;
  }

  getLatestCheckpoint(): JournalCheckpoint | null {
    if (this.checkpoints.length === 0) {
      return null;
    }
    return this.checkpoints[this.checkpoints.length - 1];
  }

  getCheckpoints(): JournalCheckpoint[] {
    return [...this.checkpoints];
  }

  getSegments(): JournalSegment[] {
    return [...this.segments];
  }

  getReplicas(): ReplicaInfo[] {
    return Array.from(this.replicas.values());
  }

  getState(): JournalState {
    return this.state;
  }

  getSequence(): number {
    return this.sequence;
  }

  getMetrics(): JournalMetrics {
    return { ...this.metrics };
  }

  async compact(beforeSequence: number): Promise<number> {
    let compactedSegments = 0;
    const segmentsToRemove: JournalSegment[] = [];
    
    for (const segment of this.segments) {
      if (segment.endSequence < beforeSequence && !segment.isOpen) {
        segmentsToRemove.push(segment);
      }
    }
    
    for (const segment of segmentsToRemove) {
      try {
        await fs.promises.unlink(segment.filePath);
        const idx = this.segments.indexOf(segment);
        if (idx >= 0) {
          this.segments.splice(idx, 1);
        }
        compactedSegments++;
        logger.info('Segment compacted', { segmentId: segment.segmentId });
      } catch (error) {
        logger.error('Failed to compact segment', error instanceof Error ? error : undefined);
      }
    }
    
    this.metrics.totalSegments = this.segments.length;
    await this.persistIndex();
    
    return compactedSegments;
  }

  async close(): Promise<void> {
    if (this.state === JournalState.CLOSED) {
      return;
    }
    
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (this.currentFileHandle) {
      await this.currentFileHandle.sync();
      await this.currentFileHandle.close();
      this.currentFileHandle = null;
    }
    
    await this.persistIndex();
    
    this.state = JournalState.CLOSED;
    logger.info('Event journal closed', { lastSequence: this.sequence });
  }
}

export interface JournalReplayHandler {
  onEntry(entry: JournalEntry): Promise<void> | void;
  onComplete(count: number): void;
  onError(error: Error, entry?: JournalEntry): void;
}

export class DeterministicReplayEngine {
  private journal: EventJournal;
  private handlers: Map<string, Array<(entry: JournalEntry) => Promise<void> | void>> = new Map();
  private isReplaying = false;
  
  constructor(journal: EventJournal) {
    this.journal = journal;
  }
  
  registerHandler(eventType: string, handler: (entry: JournalEntry) => Promise<void> | void): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }
  
  registerWildcardHandler(handler: (entry: JournalEntry) => Promise<void> | void): void {
    if (!this.handlers.has('*')) {
      this.handlers.set('*', []);
    }
    this.handlers.get('*')!.push(handler);
  }
  
  async replayFromCheckpoint(checkpointId: string, initialState?: Record<string, unknown>): Promise<{ count: number; state: Record<string, unknown> | null }> {
    if (this.isReplaying) {
      throw new Error('Replay already in progress');
    }
    
    const checkpoint = this.journal.getCheckpoints().find(c => c.checkpointId === checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }
    
    this.isReplaying = true;
    
    try {
      let state: Record<string, unknown> | null = initialState ?? null;
      
      if (checkpoint.snapshotPath) {
        state = await this.journal.loadSnapshotState(checkpoint);
      }
      
      const count = await this.journal.replay({
        fromCheckpoint: checkpointId,
        onEntry: async (entry) => {
          const typeHandlers = this.handlers.get(entry.eventType) || [];
          const wildcardHandlers = this.handlers.get('*') || [];
          
          for (const handler of [...typeHandlers, ...wildcardHandlers]) {
            await handler(entry);
          }
        },
      });
      
      return { count, state };
    } finally {
      this.isReplaying = false;
    }
  }
  
  async replayRange(fromSequence: number, toSequence: number): Promise<number> {
    if (this.isReplaying) {
      throw new Error('Replay already in progress');
    }
    
    this.isReplaying = true;
    
    try {
      return await this.journal.replay({
        fromSequence,
        toSequence,
        onEntry: async (entry) => {
          const typeHandlers = this.handlers.get(entry.eventType) || [];
          const wildcardHandlers = this.handlers.get('*') || [];
          
          for (const handler of [...typeHandlers, ...wildcardHandlers]) {
            await handler(entry);
          }
        },
      });
    } finally {
      this.isReplaying = false;
    }
  }
  
  isInReplay(): boolean {
    return this.isReplaying;
  }
}

export const createEventJournal = (config?: Partial<JournalConfig>): EventJournal => {
  return EventJournal.getInstance(config);
};

export const createReplayEngine = (journal: EventJournal): DeterministicReplayEngine => {
  return new DeterministicReplayEngine(journal);
};
