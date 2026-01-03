/**
 * Genetic Algorithm Module
 * Consolidated from omar-*optimizer*.ts scripts
 */

import type {
  GAConfig,
  Genome,
  ParamRange,
  DEFAULT_GA_CONFIG,
} from "./types.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

export const DEFAULT_PARAM_RANGES: Record<string, ParamRange> = {
  // Position sizing
  maxPositionPct: { min: 0.02, max: 0.15, step: 0.01 },
  maxPortfolioExposure: { min: 0.4, max: 0.95, step: 0.05 },
  maxPositions: { min: 5, max: 40, step: 1, integer: true },

  // Risk management
  atrMultStop: { min: 0.5, max: 3.0, step: 0.1 },
  atrMultTarget: { min: 1.5, max: 8.0, step: 0.25 },
  maxDailyLoss: { min: 0.02, max: 0.1, step: 0.01 },
  stopLossPct: { min: 0.01, max: 0.08, step: 0.005 },
  takeProfitPct: { min: 0.02, max: 0.15, step: 0.01 },

  // Signal thresholds
  buyThreshold: { min: 0.05, max: 0.4, step: 0.01 },
  sellThreshold: { min: 0.05, max: 0.4, step: 0.01 },
  confidenceMin: { min: 0.15, max: 0.65, step: 0.01 },

  // Signal weights
  technicalWeight: { min: 0.05, max: 0.35, step: 0.01 },
  momentumWeight: { min: 0.05, max: 0.35, step: 0.01 },
  volatilityWeight: { min: 0.02, max: 0.2, step: 0.01 },
  volumeWeight: { min: 0.05, max: 0.25, step: 0.01 },
  sentimentWeight: { min: 0.05, max: 0.25, step: 0.01 },
  patternWeight: { min: 0.02, max: 0.2, step: 0.01 },

  // Technical indicator periods
  rsiPeriod: { min: 7, max: 21, step: 1, integer: true },
  rsiOversold: { min: 20, max: 40, step: 1, integer: true },
  rsiOverbought: { min: 60, max: 80, step: 1, integer: true },
  macdFast: { min: 8, max: 16, step: 1, integer: true },
  macdSlow: { min: 20, max: 32, step: 1, integer: true },
  macdSignal: { min: 6, max: 12, step: 1, integer: true },
  smaPeriod: { min: 10, max: 50, step: 1, integer: true },
  emaPeriodFast: { min: 5, max: 15, step: 1, integer: true },
  emaPeriodSlow: { min: 18, max: 30, step: 1, integer: true },
  bbPeriod: { min: 15, max: 25, step: 1, integer: true },
  bbStdDev: { min: 1.5, max: 3.0, step: 0.1 },
  atrPeriod: { min: 10, max: 20, step: 1, integer: true },

  // Strategy modifiers
  momentumLookback: { min: 5, max: 30, step: 1, integer: true },
  volatilityLookback: { min: 10, max: 30, step: 1, integer: true },
};

// Weight keys that should be normalized to sum to 1
const WEIGHT_KEYS = [
  "technicalWeight",
  "momentumWeight",
  "volatilityWeight",
  "volumeWeight",
  "sentimentWeight",
  "patternWeight",
];

// ============================================================================
// GENETIC OPERATORS
// ============================================================================

/**
 * Generate a unique genome ID
 */
export function generateGenomeId(
  generation: number,
  island: number = 0
): string {
  return `gen${generation}-isl${island}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normalize weight genes to sum to 1
 */
export function normalizeWeights(
  genes: Record<string, number>,
  weightKeys: string[] = WEIGHT_KEYS
): void {
  const total = weightKeys.reduce((sum, key) => sum + (genes[key] || 0), 0);
  if (total > 0) {
    for (const key of weightKeys) {
      if (genes[key] !== undefined) {
        genes[key] = Math.round((genes[key] / total) * 100) / 100;
      }
    }
  }
}

/**
 * Generate random genome with valid parameter values
 */
export function generateRandomGenome(
  generation: number,
  island: number = 0,
  paramRanges: Record<string, ParamRange> = DEFAULT_PARAM_RANGES
): Genome {
  const genes: Record<string, number> = {};

  for (const [param, range] of Object.entries(paramRanges)) {
    if (range.boolean) {
      genes[param] = Math.random() < 0.5 ? 0 : 1;
    } else if (range.integer) {
      const numSteps = Math.floor((range.max - range.min) / range.step);
      genes[param] =
        range.min + Math.floor(Math.random() * (numSteps + 1)) * range.step;
    } else {
      const numSteps = Math.round((range.max - range.min) / range.step);
      genes[param] =
        Math.round((range.min + Math.random() * numSteps * range.step) * 1000) /
        1000;
    }
    // Clamp to range
    genes[param] = Math.max(range.min, Math.min(range.max, genes[param]));
  }

  normalizeWeights(genes);

  return {
    id: generateGenomeId(generation, island),
    genes,
    fitness: 0,
    sharpe: 0,
    sortino: 0,
    calmar: 0,
    winRate: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    trades: 0,
    generation,
    island,
    parentIds: [],
    mutations: [],
  };
}

/**
 * Create offspring through crossover of two parents
 */
export function crossover(
  parent1: Genome,
  parent2: Genome,
  generation: number,
  island: number = 0,
  paramRanges: Record<string, ParamRange> = DEFAULT_PARAM_RANGES
): Genome {
  const childGenes: Record<string, number> = {};

  for (const param of Object.keys(paramRanges)) {
    const range = paramRanges[param];
    const rand = Math.random();

    if (rand < 0.4) {
      // Inherit from parent1
      childGenes[param] = parent1.genes[param];
    } else if (rand < 0.8) {
      // Inherit from parent2
      childGenes[param] = parent2.genes[param];
    } else {
      // Blend (BLX-alpha crossover)
      const alpha = Math.random();
      childGenes[param] =
        alpha * parent1.genes[param] + (1 - alpha) * parent2.genes[param];
      childGenes[param] =
        Math.round(childGenes[param] / range.step) * range.step;
      childGenes[param] = Math.max(
        range.min,
        Math.min(range.max, childGenes[param])
      );
      if (range.integer) {
        childGenes[param] = Math.round(childGenes[param]);
      }
    }
  }

  normalizeWeights(childGenes);

  return {
    id: generateGenomeId(generation, island),
    genes: childGenes,
    fitness: 0,
    sharpe: 0,
    sortino: 0,
    calmar: 0,
    winRate: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    trades: 0,
    generation,
    island,
    parentIds: [parent1.id, parent2.id],
    mutations: [],
  };
}

/**
 * Mutate genome with adaptive mutation rate
 */
export function mutate(
  genome: Genome,
  mutationRate: number,
  paramRanges: Record<string, ParamRange> = DEFAULT_PARAM_RANGES,
  adaptiveFactor: number = 1.0
): Genome {
  const mutatedGenes = { ...genome.genes };
  const mutations: string[] = [];

  for (const [param, range] of Object.entries(paramRanges)) {
    if (Math.random() < mutationRate * adaptiveFactor) {
      const currentVal = mutatedGenes[param];

      if (range.boolean) {
        // Flip boolean
        const newVal = currentVal === 0 ? 1 : 0;
        mutatedGenes[param] = newVal;
        mutations.push(`${param}: ${currentVal} -> ${newVal}`);
      } else {
        // Gaussian mutation
        const sigma = (range.max - range.min) * 0.1 * adaptiveFactor;
        let newVal = currentVal + (Math.random() - 0.5) * 2 * sigma;
        newVal = Math.max(range.min, Math.min(range.max, newVal));
        newVal = Math.round(newVal / range.step) * range.step;
        if (range.integer) newVal = Math.round(newVal);

        if (newVal !== currentVal) {
          mutatedGenes[param] = newVal;
          mutations.push(
            `${param}: ${currentVal.toFixed(3)} -> ${newVal.toFixed(3)}`
          );
        }
      }
    }
  }

  normalizeWeights(mutatedGenes);

  return {
    ...genome,
    genes: mutatedGenes,
    mutations,
    fitness: 0, // Reset fitness for re-evaluation
  };
}

/**
 * Tournament selection - select best from random subset
 */
export function tournamentSelect(
  population: Genome[],
  tournamentSize: number = 5
): Genome {
  let best: Genome | null = null;

  for (let i = 0; i < tournamentSize; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (!best || candidate.fitness > best.fitness) {
      best = candidate;
    }
  }

  return best!;
}

/**
 * Roulette wheel selection - probability proportional to fitness
 */
export function rouletteSelect(population: Genome[]): Genome {
  const totalFitness = population.reduce(
    (sum, g) => sum + Math.max(0, g.fitness),
    0
  );

  if (totalFitness === 0) {
    return population[Math.floor(Math.random() * population.length)];
  }

  let r = Math.random() * totalFitness;
  for (const genome of population) {
    r -= Math.max(0, genome.fitness);
    if (r <= 0) return genome;
  }

  return population[population.length - 1];
}

/**
 * Rank-based selection
 */
export function rankSelect(population: Genome[]): Genome {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
  const n = sorted.length;
  const totalRank = (n * (n + 1)) / 2;
  let r = Math.random() * totalRank;

  for (let i = 0; i < n; i++) {
    r -= n - i;
    if (r <= 0) return sorted[i];
  }

  return sorted[n - 1];
}

// ============================================================================
// POPULATION MANAGEMENT
// ============================================================================

/**
 * Initialize population with random genomes
 */
export function initializePopulation(
  size: number,
  numIslands: number = 1,
  paramRanges: Record<string, ParamRange> = DEFAULT_PARAM_RANGES
): Genome[] {
  const population: Genome[] = [];
  const perIsland = Math.ceil(size / numIslands);

  for (let island = 0; island < numIslands; island++) {
    for (let i = 0; i < perIsland && population.length < size; i++) {
      population.push(generateRandomGenome(0, island, paramRanges));
    }
  }

  return population;
}

/**
 * Select elite individuals (top performers)
 */
export function selectElites(
  population: Genome[],
  eliteCount: number
): Genome[] {
  return [...population]
    .sort((a, b) => b.fitness - a.fitness)
    .slice(0, eliteCount);
}

/**
 * Migrate individuals between islands
 */
export function migrate(
  population: Genome[],
  numIslands: number,
  migrationCount: number
): Genome[] {
  const islands: Genome[][] = Array.from({ length: numIslands }, () => []);

  // Group by island
  for (const genome of population) {
    islands[genome.island % numIslands].push(genome);
  }

  // Sort each island by fitness
  for (const island of islands) {
    island.sort((a, b) => b.fitness - a.fitness);
  }

  // Migrate top performers to next island
  for (let i = 0; i < numIslands; i++) {
    const sourceIsland = islands[i];
    const targetIsland = (i + 1) % numIslands;

    for (let j = 0; j < migrationCount && j < sourceIsland.length; j++) {
      const migrant = { ...sourceIsland[j], island: targetIsland };
      islands[targetIsland].push(migrant);
    }
  }

  return islands.flat();
}

/**
 * Evolve population for one generation
 */
export function evolveGeneration(
  population: Genome[],
  generation: number,
  config: GAConfig,
  paramRanges: Record<string, ParamRange> = DEFAULT_PARAM_RANGES
): Genome[] {
  const newPopulation: Genome[] = [];

  // Keep elites
  const elites = selectElites(population, config.eliteCount);
  newPopulation.push(...elites);

  // Generate offspring
  while (newPopulation.length < config.populationSize) {
    // Select parents
    const parent1 = tournamentSelect(population, config.tournamentSize);
    const parent2 = tournamentSelect(population, config.tournamentSize);

    let offspring: Genome;

    // Crossover
    if (Math.random() < config.crossoverRate) {
      offspring = crossover(
        parent1,
        parent2,
        generation,
        parent1.island,
        paramRanges
      );
    } else {
      // Clone better parent
      offspring = {
        ...(parent1.fitness > parent2.fitness ? parent1 : parent2),
        id: generateGenomeId(generation, parent1.island),
        generation,
      };
    }

    // Mutation
    offspring = mutate(offspring, config.mutationRate, paramRanges);

    newPopulation.push(offspring);
  }

  return newPopulation.slice(0, config.populationSize);
}

// ============================================================================
// FITNESS CALCULATION
// ============================================================================

/**
 * Calculate multi-objective fitness score
 */
export function calculateFitness(
  genome: Genome,
  weights: {
    sharpe?: number;
    sortino?: number;
    calmar?: number;
    winRate?: number;
    returnWeight?: number;
    drawdownPenalty?: number;
  } = {}
): number {
  const {
    sharpe: sharpeWeight = 0.3,
    sortino: sortinoWeight = 0.15,
    calmar: calmarWeight = 0.1,
    winRate: winRateWeight = 0.15,
    returnWeight = 0.15,
    drawdownPenalty = 0.15,
  } = weights;

  // Normalize metrics
  const sharpeScore = Math.max(0, Math.min(3, genome.sharpe)) / 3;
  const sortinoScore = Math.max(0, Math.min(4, genome.sortino)) / 4;
  const calmarScore = Math.max(0, Math.min(2, genome.calmar)) / 2;
  const winRateScore = genome.winRate / 100;
  const returnScore = Math.max(0, Math.min(100, genome.totalReturn)) / 100;
  const drawdownScore = Math.max(0, 1 - genome.maxDrawdown / 50);

  // Trade count penalty (avoid overfitting with too few trades)
  const tradePenalty =
    genome.trades < 10 ? 0.5 : genome.trades < 20 ? 0.8 : 1.0;

  const fitness =
    (sharpeScore * sharpeWeight +
      sortinoScore * sortinoWeight +
      calmarScore * calmarWeight +
      winRateScore * winRateWeight +
      returnScore * returnWeight +
      drawdownScore * drawdownPenalty) *
    tradePenalty *
    100;

  return Math.max(0, fitness);
}

// ============================================================================
// CONVERGENCE DETECTION
// ============================================================================

/**
 * Check if population has converged
 */
export function checkConvergence(
  fitnessHistory: number[],
  threshold: number = 0.001,
  windowSize: number = 10
): boolean {
  if (fitnessHistory.length < windowSize) return false;

  const recent = fitnessHistory.slice(-windowSize);
  const avg = recent.reduce((a, b) => a + b, 0) / windowSize;
  const variance =
    recent.reduce((sum, f) => sum + Math.pow(f - avg, 2), 0) / windowSize;

  return variance < threshold;
}

/**
 * Calculate adaptive mutation rate based on diversity
 */
export function getAdaptiveMutationRate(
  population: Genome[],
  baseMutationRate: number,
  convergenceDetected: boolean
): number {
  if (convergenceDetected) {
    return Math.min(baseMutationRate * 2, 0.5);
  }

  // Calculate population diversity (variance of fitness)
  const fitnesses = population.map((g) => g.fitness);
  const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
  const variance =
    fitnesses.reduce((sum, f) => sum + Math.pow(f - avgFitness, 2), 0) /
    fitnesses.length;
  const diversity = Math.sqrt(variance) / (avgFitness + 0.001);

  // Increase mutation when diversity is low
  if (diversity < 0.1) {
    return baseMutationRate * 1.5;
  } else if (diversity > 0.3) {
    return baseMutationRate * 0.8;
  }

  return baseMutationRate;
}

// ============================================================================
// PATTERN MINING
// ============================================================================

export interface LearningInsight {
  pattern: string;
  correlation: number;
  sampleSize: number;
  avgImprovement: number;
}

/**
 * Analyze successful genomes to find patterns
 */
export function minePatterns(
  population: Genome[],
  topPercentile: number = 0.1
): LearningInsight[] {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
  const topCount = Math.max(1, Math.floor(population.length * topPercentile));
  const topGenomes = sorted.slice(0, topCount);
  const bottomGenomes = sorted.slice(-topCount);

  const insights: LearningInsight[] = [];

  // Analyze parameter distributions in top vs bottom performers
  const allParams = Object.keys(topGenomes[0]?.genes || {});

  for (const param of allParams) {
    const topAvg =
      topGenomes.reduce((sum, g) => sum + g.genes[param], 0) /
      topGenomes.length;
    const bottomAvg =
      bottomGenomes.reduce((sum, g) => sum + g.genes[param], 0) /
      bottomGenomes.length;

    const difference = topAvg - bottomAvg;
    const avgValue = (topAvg + bottomAvg) / 2;
    const relDiff = avgValue !== 0 ? Math.abs(difference / avgValue) : 0;

    if (relDiff > 0.1) {
      insights.push({
        pattern: `${param}: top avg=${topAvg.toFixed(3)}, bottom avg=${bottomAvg.toFixed(3)}`,
        correlation: difference > 0 ? 1 : -1,
        sampleSize: topCount,
        avgImprovement: relDiff * 100,
      });
    }
  }

  return insights.sort((a, b) => b.avgImprovement - a.avgImprovement);
}
