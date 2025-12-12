/**
 * AI Active Trader - Backtesting Module
 * Comprehensive backtesting engine for strategy validation
 * 
 * Features:
 * - Event-driven simulation matching live trading flow
 * - Multiple fill models (immediate, realistic, volume-participation)
 * - Flexible commission structures (flat, percentage, tiered, Alpaca)
 * - Slippage modeling (fixed, volume-based, volatility-based)
 * - Performance analytics (Sharpe, Sortino, Calmar, drawdowns)
 * - Trade-by-trade analysis
 * 
 * @example
 * ```typescript
 * import { 
 *   BacktestEngine, 
 *   createDataFeed, 
 *   createAlpacaCommission,
 *   createRealisticSlippage,
 *   formatMetricsSummary 
 * } from '../backtesting';
 * import { AlgorithmFramework } from '../algorithm-framework';
 * 
 * const dataFeed = createDataFeed(historicalBars, '1d');
 * const algorithm = new AlgorithmFramework({ name: 'MyStrategy' });
 * 
 * const engine = new BacktestEngine({
 *   name: 'MyBacktest',
 *   initialCapital: 100000,
 *   commissionModel: createAlpacaCommission(),
 *   slippageModel: createRealisticSlippage(),
 * });
 * 
 * const result = await engine.run(dataFeed, algorithm);
 * console.log(formatMetricsSummary(result.metrics));
 * ```
 */

export * from './data-feed';
export * from './fill-model';
export * from './commission-model';
export * from './slippage-model';
export * from './performance-analyzer';
export * from './backtesting-engine';
