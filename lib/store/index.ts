import {
  Strategy,
  BacktestRun,
  Deployment,
  LedgerEntry,
  AlgorithmTemplate,
  UserSettings,
} from "@/lib/types";
import { algorithmTemplates } from "./templates";

const STORAGE_KEYS = {
  strategies: "trading_strategies",
  backtests: "trading_backtests",
  deployments: "trading_deployments",
  ledger: "trading_ledger",
  settings: "trading_settings",
};

// Default user settings (no mock data dependency)
const defaultUserSettings: UserSettings = {
  theme: "dark",
  notifications: {
    trades: true,
    aiAlerts: true,
    riskWarnings: true,
    dailyDigest: false,
  },
  riskGuardrails: {
    maxPositionSize: 0.1,
    maxDrawdown: 0.2,
    maxDailyLoss: 0.05,
    requireConfirmation: true,
  },
};

function getStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage error:", e);
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
    return algorithmTemplates.find((t) => t.id === id);
  },

  async getStrategies(): Promise<Strategy[]> {
    await new Promise((r) => setTimeout(r, 100));
    return getStorage<Strategy[]>(STORAGE_KEYS.strategies, []);
  },

  async getStrategy(id: string): Promise<Strategy | undefined> {
    const strategies = await this.getStrategies();
    return strategies.find((s) => s.id === id);
  },

  async createStrategy(
    data: Omit<Strategy, "id" | "createdAt" | "updatedAt">
  ): Promise<Strategy> {
    await new Promise((r) => setTimeout(r, 200));
    const strategies = await this.getStrategies();
    const strategy: Strategy = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    strategies.push(strategy);
    setStorage(STORAGE_KEYS.strategies, strategies);
    return strategy;
  },

  async updateStrategy(
    id: string,
    data: Partial<Strategy>
  ): Promise<Strategy | undefined> {
    await new Promise((r) => setTimeout(r, 150));
    const strategies = await this.getStrategies();
    const index = strategies.findIndex((s) => s.id === id);
    if (index === -1) return undefined;

    strategies[index] = {
      ...strategies[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    setStorage(STORAGE_KEYS.strategies, strategies);
    return strategies[index];
  },

  async deleteStrategy(id: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 150));
    const strategies = await this.getStrategies();
    const filtered = strategies.filter((s) => s.id !== id);
    if (filtered.length === strategies.length) return false;
    setStorage(STORAGE_KEYS.strategies, filtered);

    const backtests = await this.getBacktests();
    setStorage(
      STORAGE_KEYS.backtests,
      backtests.filter((b) => b.strategyId !== id)
    );

    const deployments = await this.getDeployments();
    setStorage(
      STORAGE_KEYS.deployments,
      deployments.filter((d) => d.strategyId !== id)
    );

    const ledger = await this.getLedgerEntries();
    setStorage(
      STORAGE_KEYS.ledger,
      ledger.filter((l) => l.strategyId !== id)
    );

    return true;
  },

  async cloneStrategy(id: string): Promise<Strategy | undefined> {
    const strategy = await this.getStrategy(id);
    if (!strategy) return undefined;

    return this.createStrategy({
      name: `${strategy.name} (Copy)`,
      type: strategy.type,
      templateId: strategy.templateId,
      status: "Draft",
      configValues: { ...strategy.configValues },
    });
  },

  async getBacktests(): Promise<BacktestRun[]> {
    await new Promise((r) => setTimeout(r, 100));
    return getStorage<BacktestRun[]>(STORAGE_KEYS.backtests, []);
  },

  async getBacktest(id: string): Promise<BacktestRun | undefined> {
    const backtests = await this.getBacktests();
    return backtests.find((b) => b.id === id);
  },

  async getBacktestsForStrategy(strategyId: string): Promise<BacktestRun[]> {
    const backtests = await this.getBacktests();
    return backtests.filter((b) => b.strategyId === strategyId);
  },

  async getDeployments(): Promise<Deployment[]> {
    await new Promise((r) => setTimeout(r, 100));
    return getStorage<Deployment[]>(STORAGE_KEYS.deployments, []);
  },

  async getLedgerEntries(): Promise<LedgerEntry[]> {
    await new Promise((r) => setTimeout(r, 100));
    return getStorage<LedgerEntry[]>(STORAGE_KEYS.ledger, []);
  },

  getSettings(): UserSettings {
    return getStorage<UserSettings>(STORAGE_KEYS.settings, defaultUserSettings);
  },

  updateSettings(settings: Partial<UserSettings>): UserSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    setStorage(STORAGE_KEYS.settings, updated);
    return updated;
  },
};

export type Store = typeof store;
