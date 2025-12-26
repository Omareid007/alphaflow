import { log } from "../utils/logger";

export interface TemporalContext {
  asOf: Date;
  isReplay: boolean;
  replayId?: string;
  allowedDataCutoff: Date;
  strictMode: boolean;
}

let currentContext: TemporalContext | null = null;

export function setTemporalContext(context: Omit<TemporalContext, "allowedDataCutoff">): void {
  currentContext = {
    ...context,
    allowedDataCutoff: new Date(context.asOf.getTime() - 1000),
  };
  log.info("TemporalContext", `Set temporal context: asOf=${context.asOf.toISOString()}, isReplay=${context.isReplay}`);
}

export function getTemporalContext(): TemporalContext | null {
  return currentContext;
}

export function clearTemporalContext(): void {
  currentContext = null;
  log.info("TemporalContext", "Cleared temporal context");
}

export function getCurrentAsOf(): Date {
  return currentContext?.asOf || new Date();
}

export function isReplayMode(): boolean {
  return currentContext?.isReplay || false;
}

export interface TimestampedData {
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
  timestamp?: Date | string | null;
  date?: Date | string | null;
}

export function filterByAsOf<T extends TimestampedData>(items: T[], asOf?: Date): T[] {
  const cutoff = asOf || getCurrentAsOf();
  
  return items.filter(item => {
    const itemDate = getItemTimestamp(item);
    if (!itemDate) {
      return currentContext?.strictMode ? false : true;
    }
    return itemDate <= cutoff;
  });
}

function getItemTimestamp(item: TimestampedData): Date | null {
  const raw = item.publishedAt || item.createdAt || item.timestamp || item.date;
  if (!raw) return null;
  
  if (raw instanceof Date) return raw;
  
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export interface FutureInfoFilterOptions {
  strictMode?: boolean;
  allowUnknownDates?: boolean;
  logFiltered?: boolean;
}

export function createFutureInfoFilter<T extends TimestampedData>(
  options: FutureInfoFilterOptions = {}
): (items: T[], asOf?: Date) => T[] {
  const { strictMode = false, allowUnknownDates = true, logFiltered = false } = options;
  
  return (items: T[], asOf?: Date): T[] => {
    const cutoff = asOf || getCurrentAsOf();
    const result: T[] = [];
    let filteredCount = 0;
    
    for (const item of items) {
      const itemDate = getItemTimestamp(item);
      
      if (!itemDate) {
        if (allowUnknownDates && !strictMode) {
          result.push(item);
        } else {
          filteredCount++;
        }
        continue;
      }
      
      if (itemDate <= cutoff) {
        result.push(item);
      } else {
        filteredCount++;
      }
    }
    
    if (logFiltered && filteredCount > 0) {
      log.warn("FutureInfoFilter", `Filtered ${filteredCount} items with future timestamps (cutoff: ${cutoff.toISOString()})`);
    }
    
    return result;
  };
}

export interface NewsItem {
  title: string;
  publishedAt?: Date | string | null;
  source?: string;
  url?: string;
  sentiment?: number;
}

export const filterNewsItems = createFutureInfoFilter<NewsItem>({
  strictMode: true,
  allowUnknownDates: false,
  logFiltered: true,
});

export interface MarketDataPoint {
  timestamp?: Date | string | null;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export const filterMarketData = createFutureInfoFilter<MarketDataPoint>({
  strictMode: true,
  allowUnknownDates: false,
  logFiltered: false,
});

export interface ReplaySession {
  id: string;
  startDate: Date;
  endDate: Date;
  currentAsOf: Date;
  speed: number;
  isPaused: boolean;
  strategyVersionId?: string;
}

let activeReplaySession: ReplaySession | null = null;

export function startReplaySession(params: {
  startDate: Date;
  endDate: Date;
  speed?: number;
  strategyVersionId?: string;
}): ReplaySession {
  const session: ReplaySession = {
    id: `replay-${Date.now()}`,
    startDate: params.startDate,
    endDate: params.endDate,
    currentAsOf: params.startDate,
    speed: params.speed || 1,
    isPaused: false,
    strategyVersionId: params.strategyVersionId,
  };
  
  activeReplaySession = session;
  
  setTemporalContext({
    asOf: session.currentAsOf,
    isReplay: true,
    replayId: session.id,
    strictMode: true,
  });
  
  log.info("ReplaySession", `Started replay session ${session.id}: ${params.startDate.toISOString()} - ${params.endDate.toISOString()}`);
  
  return session;
}

export function advanceReplayTime(stepMs: number): Date | null {
  if (!activeReplaySession) return null;
  
  const newTime = new Date(activeReplaySession.currentAsOf.getTime() + stepMs);
  
  if (newTime > activeReplaySession.endDate) {
    stopReplaySession();
    return null;
  }
  
  activeReplaySession.currentAsOf = newTime;
  
  setTemporalContext({
    asOf: newTime,
    isReplay: true,
    replayId: activeReplaySession.id,
    strictMode: true,
  });
  
  return newTime;
}

export function stopReplaySession(): void {
  if (activeReplaySession) {
    log.info("ReplaySession", `Stopped replay session ${activeReplaySession.id}`);
    activeReplaySession = null;
  }
  clearTemporalContext();
}

export function getActiveReplaySession(): ReplaySession | null {
  return activeReplaySession;
}

export function validateTemporalIntegrity(
  dataSource: string,
  items: TimestampedData[],
  asOf: Date
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const itemDate = getItemTimestamp(items[i]);
    if (itemDate && itemDate > asOf) {
      violations.push(`${dataSource}[${i}]: timestamp ${itemDate.toISOString()} > asOf ${asOf.toISOString()}`);
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}
