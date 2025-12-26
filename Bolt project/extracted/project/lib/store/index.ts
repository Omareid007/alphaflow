import {
  Strategy, BacktestRun, Deployment, PortfolioSnapshot,
  LedgerEntry, AiEvent, FeedSource, SentimentSignal,
  Watchlist, UserSettings, AlgorithmTemplate
} from '@/lib/types';
import { algorithmTemplates } from './templates';
import {
  generateBacktestMetrics, generateInterpretation,
  generateEquityCurve, generateDrawdownSeries, generateReturnsSeries,
  generateLedgerEntries, generateAiEvents, generateFeedSources,
  generateSentimentSignals, generatePortfolioSnapshot, generateWatchlists,
  defaultUserSettings
} from './mock-data';

const STORAGE_KEYS = {
  strategies: 'trading_strategies',
  backtests: 'trading_backtests',
  deployments: 'trading_deployments',
  ledger: 'trading_ledger',
  aiEvents: 'trading_ai_events',
  watchlists: 'trading_watchlists',
  settings: 'trading_settings'
};

function getStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export const store = {
  getTemplates(): AlgorithmTemplate[] {
    return algorithmTemplates;
  },

  getTemplate(id: string): AlgorithmTemplate | undefined {
    return algorithmTemplates.find(t => t.id === id);
  },

  async getStrategies(): Promise<Strategy[]> {
    await new Promise(r => setTimeout(r, 100));
    return getStorage<Strategy[]>(STORAGE_KEYS.strategies, []);
  },

  async getStrategy(id: string): Promise<Strategy | undefined> {
    const strategies = await this.getStrategies();
    return strategies.find(s => s.id === id);
  },

  async createStrategy(data: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Strategy> {
    await new Promise(r => setTimeout(r, 200));
    const strategies = await this.getStrategies();
    const strategy: Strategy = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    strategies.push(strategy);
    setStorage(STORAGE_KEYS.strategies, strategies);
    return strategy;
  },

  async updateStrategy(id: string, data: Partial<Strategy>): Promise<Strategy | undefined> {
    await new Promise(r => setTimeout(r, 150));
    const strategies = await this.getStrategies();
    const index = strategies.findIndex(s => s.id === id);
    if (index === -1) return undefined;

    strategies[index] = {
      ...strategies[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    setStorage(STORAGE_KEYS.strategies, strategies);
    return strategies[index];
  },

  async deleteStrategy(id: string): Promise<boolean> {
    await new Promise(r => setTimeout(r, 150));
    const strategies = await this.getStrategies();
    const filtered = strategies.filter(s => s.id !== id);
    if (filtered.length === strategies.length) return false;
    setStorage(STORAGE_KEYS.strategies, filtered);

    const backtests = await this.getBacktests();
    setStorage(STORAGE_KEYS.backtests, backtests.filter(b => b.strategyId !== id));

    const deployments = await this.getDeployments();
    setStorage(STORAGE_KEYS.deployments, deployments.filter(d => d.strategyId !== id));

    const ledger = await this.getLedgerEntries();
    setStorage(STORAGE_KEYS.ledger, ledger.filter(l => l.strategyId !== id));

    return true;
  },

  async cloneStrategy(id: string): Promise<Strategy | undefined> {
    const strategy = await this.getStrategy(id);
    if (!strategy) return undefined;

    return this.createStrategy({
      name: `${strategy.name} (Copy)`,
      templateId: strategy.templateId,
      status: 'Draft',
      configValues: { ...strategy.configValues }
    });
  },

  async getBacktests(): Promise<BacktestRun[]> {
    await new Promise(r => setTimeout(r, 100));
    return getStorage<BacktestRun[]>(STORAGE_KEYS.backtests, []);
  },

  async getBacktest(id: string): Promise<BacktestRun | undefined> {
    const backtests = await this.getBacktests();
    return backtests.find(b => b.id === id);
  },

  async getBacktestsForStrategy(strategyId: string): Promise<BacktestRun[]> {
    const backtests = await this.getBacktests();
    return backtests.filter(b => b.strategyId === strategyId);
  },

  async runBacktest(strategyId: string, onProgress?: (p: number) => void): Promise<BacktestRun> {
    const strategy = await this.getStrategy(strategyId);
    if (!strategy) throw new Error('Strategy not found');

    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 200));
      onProgress?.(i);
    }

    const metrics = generateBacktestMetrics(strategy.configValues);
    const equityCurve = generateEquityCurve(252, 100000, metrics.cagr / 100, metrics.volatility / 100);

    const backtest: BacktestRun = {
      id: generateId(),
      strategyId,
      strategyName: strategy.name,
      metrics,
      chartSeries: {
        equityCurve,
        drawdown: generateDrawdownSeries(equityCurve),
        returns: generateReturnsSeries(equityCurve)
      },
      interpretation: generateInterpretation(metrics, strategy.configValues),
      configSnapshot: { ...strategy.configValues },
      createdAt: new Date().toISOString()
    };

    const backtests = await this.getBacktests();
    backtests.unshift(backtest);
    setStorage(STORAGE_KEYS.backtests, backtests);

    await this.updateStrategy(strategyId, {
      status: 'Backtested',
      lastBacktestId: backtest.id,
      performanceSummary: {
        totalReturn: metrics.cagr,
        dayReturn: (Math.random() - 0.5) * 4,
        weekReturn: (Math.random() - 0.5) * 8,
        monthReturn: metrics.cagr / 12,
        sharpe: metrics.sharpe,
        maxDrawdown: metrics.maxDrawdown,
        winRate: metrics.winRate
      },
      riskSummary: {
        riskLevel: metrics.maxDrawdown < 15 ? 'Low' : metrics.maxDrawdown < 25 ? 'Medium' : 'High',
        volatility: metrics.volatility,
        exposure: metrics.exposure,
        var95: metrics.volatility * 1.65
      }
    });

    return backtest;
  },

  async getDeployments(): Promise<Deployment[]> {
    await new Promise(r => setTimeout(r, 100));
    return getStorage<Deployment[]>(STORAGE_KEYS.deployments, []);
  },

  async deployStrategy(strategyId: string, mode: 'paper' | 'live'): Promise<Deployment> {
    await new Promise(r => setTimeout(r, 500));
    const strategy = await this.getStrategy(strategyId);
    if (!strategy) throw new Error('Strategy not found');

    const deployment: Deployment = {
      id: generateId(),
      strategyId,
      mode,
      status: 'active',
      startedAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString()
    };

    const deployments = await this.getDeployments();
    deployments.push(deployment);
    setStorage(STORAGE_KEYS.deployments, deployments);

    await this.updateStrategy(strategyId, {
      status: 'Deployed',
      deploymentId: deployment.id
    });

    const newEntries = generateLedgerEntries(strategyId, strategy.name, 15);
    const ledger = await this.getLedgerEntries();
    setStorage(STORAGE_KEYS.ledger, [...newEntries, ...ledger]);

    const strategies = await this.getStrategies();
    const strategyRefs = strategies.map(s => ({ id: s.id, name: s.name }));
    const events = generateAiEvents(strategyRefs);
    const existingEvents = await this.getAiEvents();
    setStorage(STORAGE_KEYS.aiEvents, [...events.slice(0, 5), ...existingEvents].slice(0, 50));

    return deployment;
  },

  async pauseStrategy(strategyId: string): Promise<void> {
    await new Promise(r => setTimeout(r, 200));
    const deployments = await this.getDeployments();
    const deployment = deployments.find(d => d.strategyId === strategyId);
    if (deployment) {
      deployment.status = 'paused';
      setStorage(STORAGE_KEYS.deployments, deployments);
    }
    await this.updateStrategy(strategyId, { status: 'Paused' });
  },

  async resumeStrategy(strategyId: string): Promise<void> {
    await new Promise(r => setTimeout(r, 200));
    const deployments = await this.getDeployments();
    const deployment = deployments.find(d => d.strategyId === strategyId);
    if (deployment) {
      deployment.status = 'active';
      deployment.lastHeartbeat = new Date().toISOString();
      setStorage(STORAGE_KEYS.deployments, deployments);
    }
    await this.updateStrategy(strategyId, { status: 'Deployed' });
  },

  async stopStrategy(strategyId: string): Promise<void> {
    await new Promise(r => setTimeout(r, 200));
    const deployments = await this.getDeployments();
    const filtered = deployments.filter(d => d.strategyId !== strategyId);
    setStorage(STORAGE_KEYS.deployments, filtered);
    await this.updateStrategy(strategyId, { status: 'Stopped', deploymentId: undefined });
  },

  async getLedgerEntries(): Promise<LedgerEntry[]> {
    await new Promise(r => setTimeout(r, 100));
    return getStorage<LedgerEntry[]>(STORAGE_KEYS.ledger, []);
  },

  async getAiEvents(): Promise<AiEvent[]> {
    await new Promise(r => setTimeout(r, 100));
    let events = getStorage<AiEvent[]>(STORAGE_KEYS.aiEvents, []);
    if (events.length === 0) {
      const strategies = await this.getStrategies();
      events = generateAiEvents(strategies.map(s => ({ id: s.id, name: s.name })));
      setStorage(STORAGE_KEYS.aiEvents, events);
    }
    return events;
  },

  getFeedSources(): FeedSource[] {
    return generateFeedSources();
  },

  getSentimentSignals(): SentimentSignal[] {
    return generateSentimentSignals();
  },

  async getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
    await new Promise(r => setTimeout(r, 150));
    const strategies = await this.getStrategies();
    return generatePortfolioSnapshot(strategies);
  },

  async getWatchlists(): Promise<Watchlist[]> {
    await new Promise(r => setTimeout(r, 100));
    let watchlists = getStorage<Watchlist[]>(STORAGE_KEYS.watchlists, []);
    if (watchlists.length === 0) {
      watchlists = generateWatchlists();
      setStorage(STORAGE_KEYS.watchlists, watchlists);
    }
    return watchlists;
  },

  async addToWatchlist(watchlistId: string, symbol: string): Promise<void> {
    const watchlists = await this.getWatchlists();
    const watchlist = watchlists.find(w => w.id === watchlistId);
    if (watchlist && !watchlist.items.find(i => i.symbol === symbol)) {
      watchlist.items.push({
        symbol,
        name: `${symbol} Inc`,
        price: Math.random() * 400 + 50,
        change: (Math.random() - 0.5) * 20,
        changePercent: (Math.random() - 0.5) * 6,
        tags: [],
        eligible: true
      });
      setStorage(STORAGE_KEYS.watchlists, watchlists);
    }
  },

  async removeFromWatchlist(watchlistId: string, symbol: string): Promise<void> {
    const watchlists = await this.getWatchlists();
    const watchlist = watchlists.find(w => w.id === watchlistId);
    if (watchlist) {
      watchlist.items = watchlist.items.filter(i => i.symbol !== symbol);
      setStorage(STORAGE_KEYS.watchlists, watchlists);
    }
  },

  getSettings(): UserSettings {
    return getStorage<UserSettings>(STORAGE_KEYS.settings, defaultUserSettings);
  },

  updateSettings(settings: Partial<UserSettings>): UserSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    setStorage(STORAGE_KEYS.settings, updated);
    return updated;
  }
};

export type Store = typeof store;
