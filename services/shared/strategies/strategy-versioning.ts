/**
 * AI Active Trader - Strategy Versioning Module
 * 
 * Comprehensive strategy version management with A/B testing, automatic rollback,
 * and Git-like branching for strategy variants.
 * 
 * Features:
 * - Semantic versioning for strategies
 * - Performance tracking per version
 * - A/B testing framework with statistical significance
 * - Automatic rollback on performance degradation
 * - Git-like branching for strategy variants
 * - Version history with changelog
 */

import { createLogger } from '../common';

const logger = createLogger('strategy-versioning');

// ============================================================================
// Interfaces and Types
// ============================================================================

/**
 * Semantic version representation
 */
export interface SemanticVersion {
  /** Major version - breaking changes */
  major: number;
  /** Minor version - new features, backward compatible */
  minor: number;
  /** Patch version - bug fixes */
  patch: number;
  /** Optional pre-release tag (e.g., 'alpha', 'beta', 'rc.1') */
  preRelease?: string;
  /** Optional build metadata */
  buildMetadata?: string;
}

/**
 * Strategy version metadata and configuration
 */
export interface StrategyVersion {
  /** Unique identifier for this version */
  id: string;
  /** Strategy identifier this version belongs to */
  strategyId: string;
  /** Semantic version */
  version: SemanticVersion;
  /** Version string representation (e.g., '1.2.3-beta+build.123') */
  versionString: string;
  /** Parent version ID (for branching) */
  parentVersionId?: string;
  /** Branch name (e.g., 'main', 'experimental', 'conservative') */
  branch: string;
  /** Human-readable name for this version */
  name: string;
  /** Detailed description of changes */
  description: string;
  /** Changelog entries */
  changelog: ChangelogEntry[];
  /** Strategy parameters for this version */
  parameters: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Author/creator identifier */
  author: string;
  /** Tags for categorization */
  tags: string[];
  /** Whether this version is active/deployable */
  isActive: boolean;
  /** Whether this version is deprecated */
  isDeprecated: boolean;
  /** Deprecation reason if applicable */
  deprecationReason?: string;
}

/**
 * Changelog entry for version history
 */
export interface ChangelogEntry {
  /** Entry timestamp */
  timestamp: Date;
  /** Type of change */
  type: 'feature' | 'fix' | 'performance' | 'breaking' | 'deprecation' | 'security';
  /** Brief description */
  summary: string;
  /** Detailed description */
  details?: string;
  /** Related issue/ticket references */
  references?: string[];
}

/**
 * Performance metrics tracked per version
 */
export interface VersionPerformanceMetrics {
  /** Version ID */
  versionId: string;
  /** Measurement period start */
  periodStart: Date;
  /** Measurement period end */
  periodEnd: Date;
  /** Total return percentage */
  totalReturnPercent: number;
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Sortino ratio */
  sortinoRatio: number;
  /** Maximum drawdown percentage */
  maxDrawdownPercent: number;
  /** Win rate percentage */
  winRate: number;
  /** Profit factor */
  profitFactor: number;
  /** Total number of trades */
  totalTrades: number;
  /** Average trade duration in milliseconds */
  avgTradeDurationMs: number;
  /** Expectancy per trade */
  expectancy: number;
  /** Calmar ratio */
  calmarRatio: number;
  /** Number of samples/observations */
  sampleCount: number;
  /** Standard deviation of returns */
  returnStdDev: number;
  /** Individual trade returns for statistical analysis */
  tradeReturns: number[];
}

/**
 * A/B test configuration
 */
export interface ABTest {
  /** Unique test identifier */
  id: string;
  /** Test name */
  name: string;
  /** Test description */
  description: string;
  /** Strategy ID being tested */
  strategyId: string;
  /** Control version (baseline) */
  controlVersionId: string;
  /** Treatment versions being tested */
  treatmentVersionIds: string[];
  /** Capital allocation ratios (must sum to 1) */
  allocationRatios: Record<string, number>;
  /** Test start time */
  startTime: Date;
  /** Planned end time */
  plannedEndTime: Date;
  /** Actual end time (if completed) */
  actualEndTime?: Date;
  /** Primary metric to optimize */
  primaryMetric: keyof VersionPerformanceMetrics;
  /** Secondary metrics to track */
  secondaryMetrics: Array<keyof VersionPerformanceMetrics>;
  /** Minimum sample size per arm */
  minSampleSize: number;
  /** Required statistical significance level (e.g., 0.05) */
  significanceLevel: number;
  /** Test status */
  status: 'pending' | 'running' | 'completed' | 'stopped' | 'failed';
  /** Winner version ID (if determined) */
  winnerId?: string;
  /** Confidence level of winner determination */
  winnerConfidence?: number;
  /** Test metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A/B test arm (variant) results
 */
export interface ABTestArm {
  /** Version ID for this arm */
  versionId: string;
  /** Whether this is the control arm */
  isControl: boolean;
  /** Allocated capital ratio */
  allocationRatio: number;
  /** Performance metrics for this arm */
  metrics: VersionPerformanceMetrics;
  /** Sample size (number of trades) */
  sampleSize: number;
  /** Confidence interval for primary metric */
  confidenceInterval: ConfidenceInterval;
}

/**
 * Statistical confidence interval
 */
export interface ConfidenceInterval {
  /** Lower bound */
  lower: number;
  /** Upper bound */
  upper: number;
  /** Point estimate (mean) */
  pointEstimate: number;
  /** Confidence level (e.g., 0.95) */
  confidenceLevel: number;
}

/**
 * Statistical test result
 */
export interface StatisticalTestResult {
  /** Test type performed */
  testType: 't-test' | 'chi-square' | 'mann-whitney';
  /** Test statistic value */
  statistic: number;
  /** P-value */
  pValue: number;
  /** Whether result is statistically significant */
  isSignificant: boolean;
  /** Effect size (Cohen's d for t-test) */
  effectSize: number;
  /** Degrees of freedom */
  degreesOfFreedom: number;
  /** Sample sizes */
  sampleSizes: { control: number; treatment: number };
}

/**
 * Rollback policy configuration
 */
export interface RollbackPolicy {
  /** Policy identifier */
  id: string;
  /** Policy name */
  name: string;
  /** Strategy ID this policy applies to */
  strategyId: string;
  /** Whether policy is enabled */
  enabled: boolean;
  /** Degradation thresholds that trigger rollback */
  thresholds: RollbackThreshold[];
  /** Cooldown period in milliseconds after a rollback */
  cooldownPeriodMs: number;
  /** Last rollback timestamp */
  lastRollbackAt?: Date;
  /** Version to rollback to (if not specified, uses previous stable) */
  rollbackTargetVersionId?: string;
  /** Alert configuration */
  alertConfig: AlertConfig;
  /** Whether to auto-rollback or just alert */
  autoRollback: boolean;
  /** Minimum evaluation period before rollback can trigger */
  minEvaluationPeriodMs: number;
}

/**
 * Threshold configuration for rollback triggers
 */
export interface RollbackThreshold {
  /** Metric to monitor */
  metric: keyof VersionPerformanceMetrics;
  /** Comparison operator */
  operator: 'lt' | 'lte' | 'gt' | 'gte';
  /** Threshold value */
  value: number;
  /** Consecutive periods threshold must be breached */
  consecutivePeriods: number;
  /** Current breach count */
  currentBreachCount: number;
  /** Severity level */
  severity: 'warning' | 'critical';
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Alert channels */
  channels: Array<'log' | 'webhook' | 'email' | 'slack'>;
  /** Webhook URL if applicable */
  webhookUrl?: string;
  /** Whether to include detailed metrics in alert */
  includeMetrics: boolean;
  /** Throttle period in milliseconds */
  throttlePeriodMs: number;
  /** Last alert timestamp */
  lastAlertAt?: Date;
}

/**
 * Rollback event record
 */
export interface RollbackEvent {
  /** Event ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Strategy ID */
  strategyId: string;
  /** Version rolled back from */
  fromVersionId: string;
  /** Version rolled back to */
  toVersionId: string;
  /** Trigger reason */
  reason: string;
  /** Threshold that was breached */
  triggeredThreshold: RollbackThreshold;
  /** Metrics at time of rollback */
  metricsSnapshot: Partial<VersionPerformanceMetrics>;
  /** Whether rollback was automatic */
  wasAutomatic: boolean;
  /** Operator who initiated (if manual) */
  initiatedBy?: string;
}

/**
 * Branch information for Git-like versioning
 */
export interface StrategyBranch {
  /** Branch name */
  name: string;
  /** Strategy ID */
  strategyId: string;
  /** Head version ID */
  headVersionId: string;
  /** Branch description */
  description: string;
  /** Whether this is the default/main branch */
  isDefault: boolean;
  /** Branch creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Protected branch (cannot be deleted) */
  isProtected: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse a version string into semantic version components
 * @param versionString - Version string (e.g., '1.2.3-beta+build.123')
 * @returns Parsed semantic version
 */
export function parseVersionString(versionString: string): SemanticVersion {
  const regex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;
  const match = versionString.match(regex);
  
  if (!match) {
    throw new Error(`Invalid version string: ${versionString}`);
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    preRelease: match[4],
    buildMetadata: match[5],
  };
}

/**
 * Format a semantic version to string
 * @param version - Semantic version object
 * @returns Formatted version string
 */
export function formatVersionString(version: SemanticVersion): string {
  let str = `${version.major}.${version.minor}.${version.patch}`;
  if (version.preRelease) {
    str += `-${version.preRelease}`;
  }
  if (version.buildMetadata) {
    str += `+${version.buildMetadata}`;
  }
  return str;
}

/**
 * Compare two semantic versions
 * @param a - First version
 * @param b - Second version
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareVersions(a: SemanticVersion, b: SemanticVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  
  // Pre-release versions have lower precedence
  if (a.preRelease && !b.preRelease) return -1;
  if (!a.preRelease && b.preRelease) return 1;
  if (a.preRelease && b.preRelease) {
    return a.preRelease.localeCompare(b.preRelease);
  }
  
  return 0;
}

/**
 * Generate a unique ID
 * @returns Unique identifier string
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// StrategyVersionManager Class
// ============================================================================

/**
 * Manages strategy versions, including registration, tracking, and branching.
 * Provides Git-like version control semantics for trading strategies.
 */
export class StrategyVersionManager {
  /** All registered versions indexed by ID */
  private versions: Map<string, StrategyVersion> = new Map();
  
  /** Performance metrics indexed by version ID */
  private performanceMetrics: Map<string, VersionPerformanceMetrics[]> = new Map();
  
  /** Branches indexed by strategy ID then branch name */
  private branches: Map<string, Map<string, StrategyBranch>> = new Map();
  
  /** Active version per strategy */
  private activeVersions: Map<string, string> = new Map();

  /**
   * Register a new strategy version
   * @param config - Version configuration
   * @returns Created strategy version
   */
  registerVersion(config: {
    strategyId: string;
    version: SemanticVersion;
    parentVersionId?: string;
    branch?: string;
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    author: string;
    tags?: string[];
    changelog?: ChangelogEntry[];
  }): StrategyVersion {
    const id = generateId();
    const versionString = formatVersionString(config.version);
    const branch = config.branch || 'main';
    
    const strategyVersion: StrategyVersion = {
      id,
      strategyId: config.strategyId,
      version: config.version,
      versionString,
      parentVersionId: config.parentVersionId,
      branch,
      name: config.name,
      description: config.description,
      changelog: config.changelog || [],
      parameters: config.parameters,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: config.author,
      tags: config.tags || [],
      isActive: false,
      isDeprecated: false,
    };
    
    this.versions.set(id, strategyVersion);
    this.performanceMetrics.set(id, []);
    
    // Update or create branch
    this.ensureBranch(config.strategyId, branch, id);
    
    logger.info('Registered new strategy version', {
      versionId: id,
      strategyId: config.strategyId,
      version: versionString,
      branch,
    });
    
    return strategyVersion;
  }

  /**
   * Ensure a branch exists and update its head
   * @param strategyId - Strategy identifier
   * @param branchName - Branch name
   * @param headVersionId - Head version ID
   */
  private ensureBranch(strategyId: string, branchName: string, headVersionId: string): void {
    if (!this.branches.has(strategyId)) {
      this.branches.set(strategyId, new Map());
    }
    
    const strategyBranches = this.branches.get(strategyId)!;
    
    if (!strategyBranches.has(branchName)) {
      strategyBranches.set(branchName, {
        name: branchName,
        strategyId,
        headVersionId,
        description: branchName === 'main' ? 'Main development branch' : `Branch: ${branchName}`,
        isDefault: branchName === 'main',
        createdAt: new Date(),
        lastActivityAt: new Date(),
        isProtected: branchName === 'main',
      });
    } else {
      const branch = strategyBranches.get(branchName)!;
      branch.headVersionId = headVersionId;
      branch.lastActivityAt = new Date();
    }
  }

  /**
   * Get a version by ID
   * @param versionId - Version identifier
   * @returns Strategy version or undefined
   */
  getVersion(versionId: string): StrategyVersion | undefined {
    return this.versions.get(versionId);
  }

  /**
   * Get all versions for a strategy
   * @param strategyId - Strategy identifier
   * @param options - Filter options
   * @returns Array of strategy versions
   */
  getVersions(
    strategyId: string,
    options?: {
      branch?: string;
      includeDeprecated?: boolean;
      limit?: number;
    }
  ): StrategyVersion[] {
    const versions = Array.from(this.versions.values())
      .filter(v => v.strategyId === strategyId)
      .filter(v => !options?.branch || v.branch === options.branch)
      .filter(v => options?.includeDeprecated || !v.isDeprecated)
      .sort((a, b) => compareVersions(b.version, a.version));
    
    return options?.limit ? versions.slice(0, options.limit) : versions;
  }

  /**
   * Get version history with parent chain
   * @param versionId - Starting version ID
   * @returns Array of versions from newest to oldest
   */
  getVersionHistory(versionId: string): StrategyVersion[] {
    const history: StrategyVersion[] = [];
    let currentId: string | undefined = versionId;
    
    while (currentId) {
      const version = this.versions.get(currentId);
      if (!version) break;
      history.push(version);
      currentId = version.parentVersionId;
    }
    
    return history;
  }

  /**
   * Set the active version for a strategy
   * @param strategyId - Strategy identifier
   * @param versionId - Version to activate
   */
  setActiveVersion(strategyId: string, versionId: string): void {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }
    if (version.strategyId !== strategyId) {
      throw new Error(`Version ${versionId} does not belong to strategy ${strategyId}`);
    }
    
    // Deactivate previous active version
    const previousActiveId = this.activeVersions.get(strategyId);
    if (previousActiveId) {
      const previousVersion = this.versions.get(previousActiveId);
      if (previousVersion) {
        previousVersion.isActive = false;
      }
    }
    
    // Activate new version
    version.isActive = true;
    version.updatedAt = new Date();
    this.activeVersions.set(strategyId, versionId);
    
    logger.info('Set active version', {
      strategyId,
      versionId,
      version: version.versionString,
    });
  }

  /**
   * Get the active version for a strategy
   * @param strategyId - Strategy identifier
   * @returns Active version or undefined
   */
  getActiveVersion(strategyId: string): StrategyVersion | undefined {
    const versionId = this.activeVersions.get(strategyId);
    return versionId ? this.versions.get(versionId) : undefined;
  }

  /**
   * Record performance metrics for a version
   * @param versionId - Version identifier
   * @param metrics - Performance metrics to record
   */
  recordPerformance(versionId: string, metrics: VersionPerformanceMetrics): void {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }
    
    const metricsArray = this.performanceMetrics.get(versionId) || [];
    metricsArray.push(metrics);
    this.performanceMetrics.set(versionId, metricsArray);
    
    logger.debug('Recorded performance metrics', {
      versionId,
      totalReturn: `${metrics.totalReturnPercent.toFixed(2)}%`,
      sharpe: metrics.sharpeRatio.toFixed(3),
      trades: metrics.totalTrades,
    });
  }

  /**
   * Get performance metrics for a version
   * @param versionId - Version identifier
   * @param options - Filter options
   * @returns Array of performance metrics
   */
  getPerformanceMetrics(
    versionId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): VersionPerformanceMetrics[] {
    let metrics = this.performanceMetrics.get(versionId) || [];
    
    if (options?.startDate) {
      metrics = metrics.filter(m => m.periodStart >= options.startDate!);
    }
    if (options?.endDate) {
      metrics = metrics.filter(m => m.periodEnd <= options.endDate!);
    }
    
    metrics.sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime());
    
    return options?.limit ? metrics.slice(0, options.limit) : metrics;
  }

  /**
   * Get aggregated performance metrics for a version
   * @param versionId - Version identifier
   * @returns Aggregated metrics or undefined
   */
  getAggregatedMetrics(versionId: string): VersionPerformanceMetrics | undefined {
    const allMetrics = this.performanceMetrics.get(versionId);
    if (!allMetrics || allMetrics.length === 0) return undefined;
    
    const allReturns = allMetrics.flatMap(m => m.tradeReturns);
    const totalTrades = allMetrics.reduce((sum, m) => sum + m.totalTrades, 0);
    
    if (totalTrades === 0) return undefined;
    
    const avgReturn = allReturns.reduce((a, b) => a + b, 0) / allReturns.length;
    const stdDev = Math.sqrt(
      allReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / allReturns.length
    );
    
    const winningTrades = allReturns.filter(r => r > 0);
    const losingTrades = allReturns.filter(r => r <= 0);
    
    return {
      versionId,
      periodStart: allMetrics[0].periodStart,
      periodEnd: allMetrics[allMetrics.length - 1].periodEnd,
      totalReturnPercent: allReturns.reduce((a, b) => a + b, 0),
      sharpeRatio: stdDev > 0 ? avgReturn / stdDev : 0,
      sortinoRatio: this.calculateSortinoFromReturns(allReturns),
      maxDrawdownPercent: Math.max(...allMetrics.map(m => m.maxDrawdownPercent)),
      winRate: totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0,
      profitFactor: losingTrades.length > 0 
        ? Math.abs(winningTrades.reduce((a, b) => a + b, 0) / losingTrades.reduce((a, b) => a + b, 0))
        : winningTrades.length > 0 ? Infinity : 0,
      totalTrades,
      avgTradeDurationMs: allMetrics.reduce((sum, m) => sum + m.avgTradeDurationMs, 0) / allMetrics.length,
      expectancy: avgReturn,
      calmarRatio: this.calculateCalmarFromMetrics(allMetrics),
      sampleCount: allReturns.length,
      returnStdDev: stdDev,
      tradeReturns: allReturns,
    };
  }

  /**
   * Calculate Sortino ratio from returns array
   */
  private calculateSortinoFromReturns(returns: number[]): number {
    if (returns.length < 2) return 0;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return avgReturn > 0 ? 10 : 0;
    const downsideDeviation = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length
    );
    return downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;
  }

  /**
   * Calculate Calmar ratio from metrics
   */
  private calculateCalmarFromMetrics(metrics: VersionPerformanceMetrics[]): number {
    const totalReturn = metrics.reduce((sum, m) => sum + m.totalReturnPercent, 0);
    const maxDrawdown = Math.max(...metrics.map(m => m.maxDrawdownPercent));
    return maxDrawdown > 0 ? totalReturn / maxDrawdown : totalReturn > 0 ? 10 : 0;
  }

  /**
   * Compare performance between two versions
   * @param versionIdA - First version ID
   * @param versionIdB - Second version ID
   * @returns Comparison result with statistical significance
   */
  compareVersions(versionIdA: string, versionIdB: string): {
    metricsA: VersionPerformanceMetrics | undefined;
    metricsB: VersionPerformanceMetrics | undefined;
    statisticalTest: StatisticalTestResult | null;
    winner: string | null;
    comparison: Record<string, { a: number; b: number; diff: number; percentDiff: number }>;
  } {
    const metricsA = this.getAggregatedMetrics(versionIdA);
    const metricsB = this.getAggregatedMetrics(versionIdB);
    
    const comparison: Record<string, { a: number; b: number; diff: number; percentDiff: number }> = {};
    
    if (metricsA && metricsB) {
      const metricsToCompare: Array<keyof VersionPerformanceMetrics> = [
        'totalReturnPercent', 'sharpeRatio', 'sortinoRatio', 'maxDrawdownPercent',
        'winRate', 'profitFactor', 'expectancy',
      ];
      
      for (const metric of metricsToCompare) {
        const a = metricsA[metric] as number;
        const b = metricsB[metric] as number;
        comparison[metric] = {
          a,
          b,
          diff: a - b,
          percentDiff: b !== 0 ? ((a - b) / Math.abs(b)) * 100 : a > 0 ? 100 : 0,
        };
      }
    }
    
    const statisticalTest = metricsA && metricsB
      ? performTTest(metricsA.tradeReturns, metricsB.tradeReturns)
      : null;
    
    let winner: string | null = null;
    if (statisticalTest?.isSignificant && metricsA && metricsB) {
      const avgA = metricsA.tradeReturns.reduce((a, b) => a + b, 0) / metricsA.tradeReturns.length;
      const avgB = metricsB.tradeReturns.reduce((a, b) => a + b, 0) / metricsB.tradeReturns.length;
      winner = avgA > avgB ? versionIdA : versionIdB;
    }
    
    return { metricsA, metricsB, statisticalTest, winner, comparison };
  }

  /**
   * Create a new branch from an existing version
   * @param sourceVersionId - Source version to branch from
   * @param branchName - New branch name
   * @param description - Branch description
   * @returns Created branch
   */
  createBranch(
    sourceVersionId: string,
    branchName: string,
    description?: string
  ): StrategyBranch {
    const sourceVersion = this.versions.get(sourceVersionId);
    if (!sourceVersion) {
      throw new Error(`Source version not found: ${sourceVersionId}`);
    }
    
    const strategyId = sourceVersion.strategyId;
    const strategyBranches = this.branches.get(strategyId) || new Map();
    
    if (strategyBranches.has(branchName)) {
      throw new Error(`Branch already exists: ${branchName}`);
    }
    
    const branch: StrategyBranch = {
      name: branchName,
      strategyId,
      headVersionId: sourceVersionId,
      description: description || `Branch from ${sourceVersion.versionString}`,
      isDefault: false,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      isProtected: false,
    };
    
    strategyBranches.set(branchName, branch);
    this.branches.set(strategyId, strategyBranches);
    
    logger.info('Created new branch', {
      strategyId,
      branch: branchName,
      sourceVersion: sourceVersion.versionString,
    });
    
    return branch;
  }

  /**
   * Get all branches for a strategy
   * @param strategyId - Strategy identifier
   * @returns Array of branches
   */
  getBranches(strategyId: string): StrategyBranch[] {
    const strategyBranches = this.branches.get(strategyId);
    return strategyBranches ? Array.from(strategyBranches.values()) : [];
  }

  /**
   * Deprecate a version
   * @param versionId - Version to deprecate
   * @param reason - Deprecation reason
   */
  deprecateVersion(versionId: string, reason: string): void {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }
    
    version.isDeprecated = true;
    version.deprecationReason = reason;
    version.isActive = false;
    version.updatedAt = new Date();
    
    logger.warn('Deprecated version', {
      versionId,
      version: version.versionString,
      reason,
    });
  }

  /**
   * Add a changelog entry to a version
   * @param versionId - Version identifier
   * @param entry - Changelog entry
   */
  addChangelogEntry(versionId: string, entry: Omit<ChangelogEntry, 'timestamp'>): void {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }
    
    version.changelog.push({
      ...entry,
      timestamp: new Date(),
    });
    version.updatedAt = new Date();
  }

  /**
   * Allocate capital between versions for A/B testing
   * @param strategyId - Strategy identifier
   * @param allocations - Map of version ID to allocation ratio
   * @returns Validated allocations
   */
  allocateCapital(
    strategyId: string,
    allocations: Record<string, number>
  ): Record<string, number> {
    const total = Object.values(allocations).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 0.001) {
      throw new Error(`Allocations must sum to 1, got ${total}`);
    }
    
    // Validate all versions exist and belong to strategy
    for (const versionId of Object.keys(allocations)) {
      const version = this.versions.get(versionId);
      if (!version) {
        throw new Error(`Version not found: ${versionId}`);
      }
      if (version.strategyId !== strategyId) {
        throw new Error(`Version ${versionId} does not belong to strategy ${strategyId}`);
      }
    }
    
    logger.info('Capital allocation set', {
      strategyId,
      allocations,
    });
    
    return allocations;
  }
}

// ============================================================================
// ABTestManager Class
// ============================================================================

/**
 * Manages A/B tests for strategy versions with statistical significance testing.
 */
export class ABTestManager {
  /** All registered tests */
  private tests: Map<string, ABTest> = new Map();
  
  /** Test arm results */
  private armResults: Map<string, Map<string, ABTestArm>> = new Map();
  
  /** Version manager reference */
  private versionManager: StrategyVersionManager;

  /**
   * Create a new A/B test manager
   * @param versionManager - Strategy version manager instance
   */
  constructor(versionManager: StrategyVersionManager) {
    this.versionManager = versionManager;
  }

  /**
   * Create a new A/B test
   * @param config - Test configuration
   * @returns Created A/B test
   */
  createTest(config: {
    name: string;
    description: string;
    strategyId: string;
    controlVersionId: string;
    treatmentVersionIds: string[];
    allocationRatios?: Record<string, number>;
    durationMs: number;
    primaryMetric?: keyof VersionPerformanceMetrics;
    secondaryMetrics?: Array<keyof VersionPerformanceMetrics>;
    minSampleSize?: number;
    significanceLevel?: number;
  }): ABTest {
    const id = generateId();
    const allVersionIds = [config.controlVersionId, ...config.treatmentVersionIds];
    
    // Default equal allocation if not specified
    const allocationRatios = config.allocationRatios || (() => {
      const ratio = 1 / allVersionIds.length;
      return Object.fromEntries(allVersionIds.map(id => [id, ratio]));
    })();
    
    // Validate allocations sum to 1
    const total = Object.values(allocationRatios).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 0.001) {
      throw new Error(`Allocation ratios must sum to 1, got ${total}`);
    }
    
    const test: ABTest = {
      id,
      name: config.name,
      description: config.description,
      strategyId: config.strategyId,
      controlVersionId: config.controlVersionId,
      treatmentVersionIds: config.treatmentVersionIds,
      allocationRatios,
      startTime: new Date(),
      plannedEndTime: new Date(Date.now() + config.durationMs),
      primaryMetric: config.primaryMetric || 'sharpeRatio',
      secondaryMetrics: config.secondaryMetrics || ['totalReturnPercent', 'winRate', 'maxDrawdownPercent'],
      minSampleSize: config.minSampleSize || 30,
      significanceLevel: config.significanceLevel || 0.05,
      status: 'pending',
    };
    
    this.tests.set(id, test);
    this.armResults.set(id, new Map());
    
    // Initialize arm results
    for (const versionId of allVersionIds) {
      this.armResults.get(id)!.set(versionId, {
        versionId,
        isControl: versionId === config.controlVersionId,
        allocationRatio: allocationRatios[versionId],
        metrics: this.createEmptyMetrics(versionId),
        sampleSize: 0,
        confidenceInterval: { lower: 0, upper: 0, pointEstimate: 0, confidenceLevel: 0.95 },
      });
    }
    
    logger.info('Created A/B test', {
      testId: id,
      name: config.name,
      control: config.controlVersionId,
      treatments: config.treatmentVersionIds,
    });
    
    return test;
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(versionId: string): VersionPerformanceMetrics {
    return {
      versionId,
      periodStart: new Date(),
      periodEnd: new Date(),
      totalReturnPercent: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdownPercent: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      avgTradeDurationMs: 0,
      expectancy: 0,
      calmarRatio: 0,
      sampleCount: 0,
      returnStdDev: 0,
      tradeReturns: [],
    };
  }

  /**
   * Start a test
   * @param testId - Test identifier
   */
  startTest(testId: string): void {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }
    
    test.status = 'running';
    test.startTime = new Date();
    
    logger.info('Started A/B test', { testId, name: test.name });
  }

  /**
   * Record performance for a test arm
   * @param testId - Test identifier
   * @param versionId - Version identifier
   * @param tradeReturn - Trade return percentage
   */
  recordArmPerformance(testId: string, versionId: string, tradeReturn: number): void {
    const arms = this.armResults.get(testId);
    if (!arms) {
      throw new Error(`Test not found: ${testId}`);
    }
    
    const arm = arms.get(versionId);
    if (!arm) {
      throw new Error(`Version ${versionId} not in test ${testId}`);
    }
    
    arm.metrics.tradeReturns.push(tradeReturn);
    arm.sampleSize = arm.metrics.tradeReturns.length;
    arm.metrics.totalTrades = arm.sampleSize;
    arm.metrics.periodEnd = new Date();
    
    // Recalculate metrics
    this.recalculateArmMetrics(arm);
  }

  /**
   * Recalculate arm metrics from trade returns
   */
  private recalculateArmMetrics(arm: ABTestArm): void {
    const returns = arm.metrics.tradeReturns;
    if (returns.length === 0) return;
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    
    const winningTrades = returns.filter(r => r > 0);
    const losingTrades = returns.filter(r => r <= 0);
    
    arm.metrics.totalReturnPercent = returns.reduce((a, b) => a + b, 0);
    arm.metrics.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    arm.metrics.winRate = (winningTrades.length / returns.length) * 100;
    arm.metrics.returnStdDev = stdDev;
    arm.metrics.expectancy = avgReturn;
    arm.metrics.sampleCount = returns.length;
    
    // Calculate confidence interval for primary metric (mean return)
    arm.confidenceInterval = this.calculateConfidenceInterval(returns, 0.95);
  }

  /**
   * Calculate confidence interval for a sample
   * @param sample - Array of values
   * @param confidenceLevel - Confidence level (e.g., 0.95)
   * @returns Confidence interval
   */
  private calculateConfidenceInterval(sample: number[], confidenceLevel: number): ConfidenceInterval {
    if (sample.length < 2) {
      return { lower: 0, upper: 0, pointEstimate: 0, confidenceLevel };
    }
    
    const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
    const stdDev = Math.sqrt(
      sample.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (sample.length - 1)
    );
    const standardError = stdDev / Math.sqrt(sample.length);
    
    // Use approximate t-value for 95% confidence (1.96 for large samples)
    const tValue = sample.length > 30 ? 1.96 : 2.0;
    const margin = tValue * standardError;
    
    return {
      lower: mean - margin,
      upper: mean + margin,
      pointEstimate: mean,
      confidenceLevel,
    };
  }

  /**
   * Get test results
   * @param testId - Test identifier
   * @returns Test with arm results
   */
  getTestResults(testId: string): {
    test: ABTest;
    arms: ABTestArm[];
    statisticalTests: Map<string, StatisticalTestResult>;
    isComplete: boolean;
    canDetermineWinner: boolean;
  } {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }
    
    const arms = Array.from(this.armResults.get(testId)?.values() || []);
    const controlArm = arms.find(a => a.isControl);
    const treatmentArms = arms.filter(a => !a.isControl);
    
    const statisticalTests = new Map<string, StatisticalTestResult>();
    
    // Run statistical tests against control
    if (controlArm) {
      for (const treatmentArm of treatmentArms) {
        const testResult = performTTest(
          controlArm.metrics.tradeReturns,
          treatmentArm.metrics.tradeReturns,
          test.significanceLevel
        );
        statisticalTests.set(treatmentArm.versionId, testResult);
      }
    }
    
    const minSampleMet = arms.every(a => a.sampleSize >= test.minSampleSize);
    const timeComplete = new Date() >= test.plannedEndTime;
    const isComplete = minSampleMet || timeComplete;
    
    // Check if any treatment is significantly better than control
    const significantWinners = treatmentArms.filter(arm => {
      const stat = statisticalTests.get(arm.versionId);
      if (!stat?.isSignificant) return false;
      const controlMean = controlArm?.metrics.tradeReturns.reduce((a, b) => a + b, 0) || 0;
      const treatmentMean = arm.metrics.tradeReturns.reduce((a, b) => a + b, 0);
      return treatmentMean > controlMean;
    });
    
    const canDetermineWinner = significantWinners.length > 0 || isComplete;
    
    return { test, arms, statisticalTests, isComplete, canDetermineWinner };
  }

  /**
   * Determine and declare the winner of a test
   * @param testId - Test identifier
   * @returns Winner information
   */
  determineWinner(testId: string): {
    winnerId: string;
    confidence: number;
    reason: string;
  } | null {
    const { test, arms, statisticalTests, canDetermineWinner } = this.getTestResults(testId);
    
    if (!canDetermineWinner) {
      return null;
    }
    
    const controlArm = arms.find(a => a.isControl)!;
    let bestArm = controlArm;
    let bestValue = controlArm.metrics.tradeReturns.reduce((a, b) => a + b, 0) / 
      Math.max(controlArm.metrics.tradeReturns.length, 1);
    let confidence = 0.5;
    let reason = 'Control performed best';
    
    for (const arm of arms.filter(a => !a.isControl)) {
      const stat = statisticalTests.get(arm.versionId);
      const armValue = arm.metrics.tradeReturns.reduce((a, b) => a + b, 0) / 
        Math.max(arm.metrics.tradeReturns.length, 1);
      
      if (stat?.isSignificant && armValue > bestValue) {
        bestArm = arm;
        bestValue = armValue;
        confidence = 1 - (stat.pValue || 0.5);
        reason = `Treatment ${arm.versionId} significantly outperformed (p=${stat.pValue.toFixed(4)})`;
      }
    }
    
    // Update test with winner
    test.winnerId = bestArm.versionId;
    test.winnerConfidence = confidence;
    test.status = 'completed';
    test.actualEndTime = new Date();
    
    logger.info('A/B test winner determined', {
      testId,
      winnerId: bestArm.versionId,
      confidence,
      reason,
    });
    
    return {
      winnerId: bestArm.versionId,
      confidence,
      reason,
    };
  }

  /**
   * Stop a running test
   * @param testId - Test identifier
   * @param reason - Stop reason
   */
  stopTest(testId: string, reason: string): void {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }
    
    test.status = 'stopped';
    test.actualEndTime = new Date();
    
    logger.warn('A/B test stopped', { testId, reason });
  }

  /**
   * Get all tests for a strategy
   * @param strategyId - Strategy identifier
   * @returns Array of tests
   */
  getTests(strategyId: string): ABTest[] {
    return Array.from(this.tests.values())
      .filter(t => t.strategyId === strategyId);
  }
}

// ============================================================================
// Statistical Testing Functions
// ============================================================================

/**
 * Perform independent samples t-test
 * @param sample1 - First sample
 * @param sample2 - Second sample
 * @param alpha - Significance level (default 0.05)
 * @returns Statistical test result
 */
export function performTTest(
  sample1: number[],
  sample2: number[],
  alpha: number = 0.05
): StatisticalTestResult {
  if (sample1.length < 2 || sample2.length < 2) {
    return {
      testType: 't-test',
      statistic: 0,
      pValue: 1,
      isSignificant: false,
      effectSize: 0,
      degreesOfFreedom: 0,
      sampleSizes: { control: sample1.length, treatment: sample2.length },
    };
  }
  
  const n1 = sample1.length;
  const n2 = sample2.length;
  const mean1 = sample1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = sample2.reduce((a, b) => a + b, 0) / n2;
  
  const var1 = sample1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1);
  const var2 = sample2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1);
  
  // Welch's t-test (does not assume equal variances)
  const se = Math.sqrt(var1 / n1 + var2 / n2);
  const tStatistic = se > 0 ? (mean1 - mean2) / se : 0;
  
  // Welch-Satterthwaite degrees of freedom
  const numerator = Math.pow(var1 / n1 + var2 / n2, 2);
  const denominator = 
    Math.pow(var1 / n1, 2) / (n1 - 1) + 
    Math.pow(var2 / n2, 2) / (n2 - 1);
  const df = denominator > 0 ? numerator / denominator : 1;
  
  // Approximate p-value using normal distribution for large samples
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)));
  
  // Cohen's d effect size
  const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
  const effectSize = pooledStd > 0 ? (mean1 - mean2) / pooledStd : 0;
  
  return {
    testType: 't-test',
    statistic: tStatistic,
    pValue,
    isSignificant: pValue < alpha,
    effectSize,
    degreesOfFreedom: df,
    sampleSizes: { control: n1, treatment: n2 },
  };
}

/**
 * Perform chi-square test for categorical data
 * @param observed - Observed frequencies
 * @param expected - Expected frequencies
 * @param alpha - Significance level
 * @returns Statistical test result
 */
export function performChiSquare(
  observed: number[],
  expected: number[],
  alpha: number = 0.05
): StatisticalTestResult {
  if (observed.length !== expected.length || observed.length < 2) {
    return {
      testType: 'chi-square',
      statistic: 0,
      pValue: 1,
      isSignificant: false,
      effectSize: 0,
      degreesOfFreedom: 0,
      sampleSizes: { control: 0, treatment: 0 },
    };
  }
  
  const n = observed.reduce((a, b) => a + b, 0);
  const df = observed.length - 1;
  
  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) {
      chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
    }
  }
  
  // Approximate p-value using chi-square distribution
  const pValue = 1 - chiSquareCDF(chiSquare, df);
  
  // Cramer's V effect size
  const effectSize = Math.sqrt(chiSquare / n);
  
  return {
    testType: 'chi-square',
    statistic: chiSquare,
    pValue,
    isSignificant: pValue < alpha,
    effectSize,
    degreesOfFreedom: df,
    sampleSizes: { control: n, treatment: 0 },
  };
}

/**
 * Standard normal CDF approximation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

/**
 * Chi-square CDF approximation using Wilson-Hilferty transformation
 */
function chiSquareCDF(x: number, df: number): number {
  if (x <= 0 || df <= 0) return 0;
  
  // Wilson-Hilferty transformation
  const z = Math.pow(x / df, 1/3) - (1 - 2/(9*df));
  const standardized = z / Math.sqrt(2/(9*df));
  
  return normalCDF(standardized);
}

// ============================================================================
// RollbackManager Class
// ============================================================================

/**
 * Manages rollback policies and automatic rollback triggers for strategy versions.
 */
export class RollbackManager {
  /** Rollback policies indexed by strategy ID */
  private policies: Map<string, RollbackPolicy> = new Map();
  
  /** Rollback event history */
  private rollbackHistory: RollbackEvent[] = [];
  
  /** Version manager reference */
  private versionManager: StrategyVersionManager;
  
  /** Alert callbacks */
  private alertCallbacks: Array<(event: RollbackEvent | { type: 'warning'; policy: RollbackPolicy; threshold: RollbackThreshold; metrics: Partial<VersionPerformanceMetrics> }) => void> = [];

  /**
   * Create a new rollback manager
   * @param versionManager - Strategy version manager instance
   */
  constructor(versionManager: StrategyVersionManager) {
    this.versionManager = versionManager;
  }

  /**
   * Register an alert callback
   * @param callback - Callback function
   */
  onAlert(callback: (event: RollbackEvent | { type: 'warning'; policy: RollbackPolicy; threshold: RollbackThreshold; metrics: Partial<VersionPerformanceMetrics> }) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Create or update a rollback policy
   * @param config - Policy configuration
   * @returns Created/updated policy
   */
  setPolicy(config: {
    strategyId: string;
    name?: string;
    thresholds: Array<{
      metric: keyof VersionPerformanceMetrics;
      operator: 'lt' | 'lte' | 'gt' | 'gte';
      value: number;
      consecutivePeriods?: number;
      severity?: 'warning' | 'critical';
    }>;
    cooldownPeriodMs?: number;
    autoRollback?: boolean;
    minEvaluationPeriodMs?: number;
    alertChannels?: Array<'log' | 'webhook' | 'email' | 'slack'>;
    webhookUrl?: string;
  }): RollbackPolicy {
    const id = `policy-${config.strategyId}`;
    
    const thresholds: RollbackThreshold[] = config.thresholds.map(t => ({
      metric: t.metric,
      operator: t.operator,
      value: t.value,
      consecutivePeriods: t.consecutivePeriods || 1,
      currentBreachCount: 0,
      severity: t.severity || 'critical',
    }));
    
    const policy: RollbackPolicy = {
      id,
      name: config.name || `Rollback policy for ${config.strategyId}`,
      strategyId: config.strategyId,
      enabled: true,
      thresholds,
      cooldownPeriodMs: config.cooldownPeriodMs || 3600000, // 1 hour default
      autoRollback: config.autoRollback ?? true,
      minEvaluationPeriodMs: config.minEvaluationPeriodMs || 86400000, // 24 hours default
      alertConfig: {
        channels: config.alertChannels || ['log'],
        webhookUrl: config.webhookUrl,
        includeMetrics: true,
        throttlePeriodMs: 300000, // 5 minutes
      },
    };
    
    this.policies.set(config.strategyId, policy);
    
    logger.info('Rollback policy configured', {
      strategyId: config.strategyId,
      thresholds: thresholds.length,
      autoRollback: policy.autoRollback,
    });
    
    return policy;
  }

  /**
   * Evaluate metrics against rollback policy
   * @param strategyId - Strategy identifier
   * @param metrics - Current performance metrics
   * @returns Evaluation result
   */
  evaluateMetrics(
    strategyId: string,
    metrics: Partial<VersionPerformanceMetrics>
  ): {
    shouldRollback: boolean;
    triggeredThresholds: RollbackThreshold[];
    warnings: RollbackThreshold[];
  } {
    const policy = this.policies.get(strategyId);
    if (!policy || !policy.enabled) {
      return { shouldRollback: false, triggeredThresholds: [], warnings: [] };
    }
    
    // Check cooldown
    if (policy.lastRollbackAt) {
      const timeSinceRollback = Date.now() - policy.lastRollbackAt.getTime();
      if (timeSinceRollback < policy.cooldownPeriodMs) {
        logger.debug('Rollback evaluation skipped - in cooldown', {
          strategyId,
          cooldownRemaining: policy.cooldownPeriodMs - timeSinceRollback,
        });
        return { shouldRollback: false, triggeredThresholds: [], warnings: [] };
      }
    }
    
    const triggeredThresholds: RollbackThreshold[] = [];
    const warnings: RollbackThreshold[] = [];
    
    for (const threshold of policy.thresholds) {
      const metricValue = metrics[threshold.metric];
      if (metricValue === undefined) continue;
      
      const isBreached = this.checkThreshold(metricValue as number, threshold);
      
      if (isBreached) {
        threshold.currentBreachCount++;
        
        if (threshold.currentBreachCount >= threshold.consecutivePeriods) {
          if (threshold.severity === 'critical') {
            triggeredThresholds.push(threshold);
          } else {
            warnings.push(threshold);
          }
        }
      } else {
        threshold.currentBreachCount = 0;
      }
    }
    
    // Generate warnings
    for (const warning of warnings) {
      this.generateAlert(policy, warning, metrics, false);
    }
    
    const shouldRollback = triggeredThresholds.length > 0 && policy.autoRollback;
    
    if (shouldRollback) {
      logger.warn('Rollback triggered', {
        strategyId,
        triggeredThresholds: triggeredThresholds.map(t => `${t.metric} ${t.operator} ${t.value}`),
      });
    }
    
    return { shouldRollback, triggeredThresholds, warnings };
  }

  /**
   * Check if a metric value breaches a threshold
   */
  private checkThreshold(value: number, threshold: RollbackThreshold): boolean {
    switch (threshold.operator) {
      case 'lt': return value < threshold.value;
      case 'lte': return value <= threshold.value;
      case 'gt': return value > threshold.value;
      case 'gte': return value >= threshold.value;
      default: return false;
    }
  }

  /**
   * Execute a rollback
   * @param strategyId - Strategy identifier
   * @param fromVersionId - Version to rollback from
   * @param toVersionId - Version to rollback to (optional, uses previous if not specified)
   * @param threshold - Threshold that triggered rollback
   * @param metrics - Metrics at time of rollback
   * @param initiatedBy - Who initiated the rollback (optional for manual)
   * @returns Rollback event
   */
  executeRollback(
    strategyId: string,
    fromVersionId: string,
    toVersionId: string | undefined,
    threshold: RollbackThreshold,
    metrics: Partial<VersionPerformanceMetrics>,
    initiatedBy?: string
  ): RollbackEvent {
    const policy = this.policies.get(strategyId);
    
    // Determine target version
    let targetVersionId = toVersionId || policy?.rollbackTargetVersionId;
    
    if (!targetVersionId) {
      // Find previous stable version
      const versions = this.versionManager.getVersions(strategyId, { includeDeprecated: false });
      const currentVersion = this.versionManager.getVersion(fromVersionId);
      
      if (currentVersion?.parentVersionId) {
        targetVersionId = currentVersion.parentVersionId;
      } else if (versions.length > 1) {
        targetVersionId = versions[1].id; // Second newest version
      }
    }
    
    if (!targetVersionId) {
      throw new Error(`No rollback target found for strategy ${strategyId}`);
    }
    
    const event: RollbackEvent = {
      id: generateId(),
      timestamp: new Date(),
      strategyId,
      fromVersionId,
      toVersionId: targetVersionId,
      reason: `Threshold breached: ${threshold.metric} ${threshold.operator} ${threshold.value}`,
      triggeredThreshold: threshold,
      metricsSnapshot: metrics,
      wasAutomatic: !initiatedBy,
      initiatedBy,
    };
    
    // Execute the rollback
    this.versionManager.setActiveVersion(strategyId, targetVersionId);
    
    // Update policy
    if (policy) {
      policy.lastRollbackAt = new Date();
    }
    
    // Record event
    this.rollbackHistory.push(event);
    
    // Generate alert
    if (policy) {
      this.generateAlert(policy, threshold, metrics, true, event);
    }
    
    logger.warn('Rollback executed', {
      strategyId,
      fromVersion: fromVersionId,
      toVersion: targetVersionId,
      reason: event.reason,
    });
    
    return event;
  }

  /**
   * Generate an alert
   */
  private generateAlert(
    policy: RollbackPolicy,
    threshold: RollbackThreshold,
    metrics: Partial<VersionPerformanceMetrics>,
    isRollback: boolean,
    event?: RollbackEvent
  ): void {
    // Check throttle
    if (policy.alertConfig.lastAlertAt) {
      const timeSinceAlert = Date.now() - policy.alertConfig.lastAlertAt.getTime();
      if (timeSinceAlert < policy.alertConfig.throttlePeriodMs) {
        return;
      }
    }
    
    policy.alertConfig.lastAlertAt = new Date();
    
    // Log alert
    if (policy.alertConfig.channels.includes('log')) {
      const alertData = {
        strategyId: policy.strategyId,
        threshold: `${threshold.metric} ${threshold.operator} ${threshold.value}`,
        severity: threshold.severity,
        metrics: policy.alertConfig.includeMetrics ? metrics : undefined,
      };
      if (isRollback) {
        logger.error('ROLLBACK ALERT', undefined, alertData);
      } else {
        logger.warn('WARNING ALERT', alertData);
      }
    }
    
    // Notify callbacks
    for (const callback of this.alertCallbacks) {
      try {
        if (event) {
          callback(event);
        } else {
          callback({ type: 'warning', policy, threshold, metrics });
        }
      } catch (e) {
        logger.error('Alert callback error', e instanceof Error ? e : undefined, { callbackError: String(e) });
      }
    }
  }

  /**
   * Get rollback history for a strategy
   * @param strategyId - Strategy identifier
   * @param limit - Maximum number of events
   * @returns Array of rollback events
   */
  getRollbackHistory(strategyId: string, limit?: number): RollbackEvent[] {
    const events = this.rollbackHistory
      .filter(e => e.strategyId === strategyId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? events.slice(0, limit) : events;
  }

  /**
   * Get policy for a strategy
   * @param strategyId - Strategy identifier
   * @returns Rollback policy or undefined
   */
  getPolicy(strategyId: string): RollbackPolicy | undefined {
    return this.policies.get(strategyId);
  }

  /**
   * Enable or disable a policy
   * @param strategyId - Strategy identifier
   * @param enabled - Whether to enable or disable
   */
  setEnabled(strategyId: string, enabled: boolean): void {
    const policy = this.policies.get(strategyId);
    if (policy) {
      policy.enabled = enabled;
      logger.info(`Rollback policy ${enabled ? 'enabled' : 'disabled'}`, { strategyId });
    }
  }

  /**
   * Reset breach counts for a policy
   * @param strategyId - Strategy identifier
   */
  resetBreachCounts(strategyId: string): void {
    const policy = this.policies.get(strategyId);
    if (policy) {
      for (const threshold of policy.thresholds) {
        threshold.currentBreachCount = 0;
      }
      logger.debug('Breach counts reset', { strategyId });
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a complete strategy versioning system
 * @returns Object containing all managers
 */
export function createStrategyVersioningSystem(): {
  versionManager: StrategyVersionManager;
  abTestManager: ABTestManager;
  rollbackManager: RollbackManager;
} {
  const versionManager = new StrategyVersionManager();
  const abTestManager = new ABTestManager(versionManager);
  const rollbackManager = new RollbackManager(versionManager);
  
  logger.info('Strategy versioning system initialized');
  
  return { versionManager, abTestManager, rollbackManager };
}

/**
 * Create a default rollback policy with common thresholds
 * @param strategyId - Strategy identifier
 * @param rollbackManager - Rollback manager instance
 * @returns Created policy
 */
export function createDefaultRollbackPolicy(
  strategyId: string,
  rollbackManager: RollbackManager
): RollbackPolicy {
  return rollbackManager.setPolicy({
    strategyId,
    name: 'Default Rollback Policy',
    thresholds: [
      { metric: 'maxDrawdownPercent', operator: 'gt', value: 20, severity: 'critical' },
      { metric: 'sharpeRatio', operator: 'lt', value: 0, consecutivePeriods: 3, severity: 'critical' },
      { metric: 'winRate', operator: 'lt', value: 30, consecutivePeriods: 5, severity: 'warning' },
      { metric: 'profitFactor', operator: 'lt', value: 0.5, consecutivePeriods: 3, severity: 'critical' },
    ],
    cooldownPeriodMs: 3600000, // 1 hour
    autoRollback: true,
    minEvaluationPeriodMs: 86400000, // 24 hours
    alertChannels: ['log'],
  });
}
