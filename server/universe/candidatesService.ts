import { db } from "../db";
import { universeCandidates, universeFundamentals, universeLiquidityMetrics, universeAssets, type InsertUniverseCandidate, type UniverseCandidate, type LiquidityTier } from "../../shared/schema";
import { eq, sql, and, desc, inArray } from "drizzle-orm";
import { fundamentalsService } from "./fundamentalsService";
import { liquidityService } from "./liquidityService";

export type CandidateStatus = "NEW" | "WATCHLIST" | "APPROVED" | "REJECTED";

export interface CandidateGenerationResult {
  success: boolean;
  generated: number;
  updated: number;
  duration: number;
  traceId?: string;
}

export interface CandidateApprovalResult {
  success: boolean;
  symbol: string;
  previousStatus: CandidateStatus;
  newStatus: CandidateStatus;
}

export class CandidatesService {
  async generateCandidates(options: {
    minLiquidityTier?: LiquidityTier;
    minScore?: number;
    limit?: number;
    traceId?: string;
  } = {}): Promise<CandidateGenerationResult> {
    const startTime = Date.now();
    const {
      minLiquidityTier = "B",
      minScore = 0.4,
      limit = 100,
      traceId,
    } = options;

    console.log(`[CANDIDATES] Generating candidates, minTier=${minLiquidityTier}, minScore=${minScore}, traceId=${traceId}`);

    const eligibleSymbols = await db
      .select({
        symbol: universeLiquidityMetrics.symbol,
        tier: universeLiquidityMetrics.liquidityTier,
      })
      .from(universeLiquidityMetrics)
      .where(
        inArray(universeLiquidityMetrics.liquidityTier, 
          minLiquidityTier === "A" ? ["A"] : ["A", "B"])
      )
      .limit(limit * 2);

    console.log(`[CANDIDATES] Found ${eligibleSymbols.length} symbols meeting liquidity criteria`);

    let generated = 0;
    let updated = 0;

    for (const { symbol, tier } of eligibleSymbols) {
      const fundamentals = await fundamentalsService.getFundamentalsBySymbol(symbol);
      const liquidity = await liquidityService.getMetricsBySymbol(symbol);

      let qualityScore = 0.5;
      let growthScore = 0.5;
      let finalScore = 0.5;
      let rationale = "Insufficient data for scoring";

      if (fundamentals) {
        const scores = fundamentalsService.calculateQualityGrowthScore(fundamentals);
        qualityScore = scores.qualityScore;
        growthScore = scores.growthScore;
        finalScore = scores.finalScore;
        rationale = `Quality: ${(qualityScore * 100).toFixed(1)}%, Growth: ${(growthScore * 100).toFixed(1)}%`;
      }

      if (finalScore < minScore) {
        continue;
      }

      const liquidityScore = tier === "A" ? 1.0 : tier === "B" ? 0.7 : 0.4;

      const candidateData: InsertUniverseCandidate = {
        symbol,
        tier: tier || "C",
        liquidityScore: liquidityScore.toString(),
        qualityScore: qualityScore.toString(),
        growthScore: growthScore.toString(),
        finalScore: finalScore.toString(),
        rationale,
        traceId,
      };

      const existing = await db
        .select({ id: universeCandidates.id, status: universeCandidates.status })
        .from(universeCandidates)
        .where(eq(universeCandidates.symbol, symbol))
        .limit(1);

      if (existing.length > 0) {
        if (existing[0].status === "NEW" || existing[0].status === "WATCHLIST") {
          await db
            .update(universeCandidates)
            .set({
              ...candidateData,
              updatedAt: new Date(),
            })
            .where(eq(universeCandidates.symbol, symbol));
          updated++;
        }
      } else {
        await db.insert(universeCandidates).values({
          ...candidateData,
          status: "NEW",
        });
        generated++;
      }

      if (generated + updated >= limit) break;
    }

    const duration = Date.now() - startTime;
    console.log(`[CANDIDATES] Generation complete: generated=${generated}, updated=${updated}, duration=${duration}ms`);

    return {
      success: true,
      generated,
      updated,
      duration,
      traceId,
    };
  }

  async approveCandidate(symbol: string, userId: string): Promise<CandidateApprovalResult> {
    return this.updateCandidateStatus(symbol, "APPROVED", userId);
  }

  async rejectCandidate(symbol: string): Promise<CandidateApprovalResult> {
    return this.updateCandidateStatus(symbol, "REJECTED");
  }

  async watchlistCandidate(symbol: string): Promise<CandidateApprovalResult> {
    return this.updateCandidateStatus(symbol, "WATCHLIST");
  }

  private async updateCandidateStatus(
    symbol: string,
    newStatus: CandidateStatus,
    userId?: string
  ): Promise<CandidateApprovalResult> {
    const existing = await db
      .select()
      .from(universeCandidates)
      .where(eq(universeCandidates.symbol, symbol.toUpperCase()))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Candidate not found: ${symbol}`);
    }

    const previousStatus = existing[0].status as CandidateStatus;

    await db
      .update(universeCandidates)
      .set({
        status: newStatus,
        approvedBy: newStatus === "APPROVED" ? userId : null,
        approvedAt: newStatus === "APPROVED" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(universeCandidates.symbol, symbol.toUpperCase()));

    console.log(`[CANDIDATES] ${symbol}: ${previousStatus} -> ${newStatus}`);

    return {
      success: true,
      symbol: symbol.toUpperCase(),
      previousStatus,
      newStatus,
    };
  }

  async getCandidateBySymbol(symbol: string): Promise<UniverseCandidate | null> {
    const result = await db
      .select()
      .from(universeCandidates)
      .where(eq(universeCandidates.symbol, symbol.toUpperCase()))
      .limit(1);
    return result[0] || null;
  }

  async getCandidatesByStatus(status: CandidateStatus, limit = 100): Promise<UniverseCandidate[]> {
    return db
      .select()
      .from(universeCandidates)
      .where(eq(universeCandidates.status, status))
      .orderBy(desc(universeCandidates.finalScore))
      .limit(limit);
  }

  async getApprovedSymbols(): Promise<string[]> {
    const approved = await db
      .select({ symbol: universeCandidates.symbol })
      .from(universeCandidates)
      .where(eq(universeCandidates.status, "APPROVED"));
    return approved.map((c) => c.symbol);
  }

  async isSymbolApproved(symbol: string): Promise<boolean> {
    const candidate = await this.getCandidateBySymbol(symbol);
    return candidate?.status === "APPROVED";
  }

  async getStats(): Promise<{
    total: number;
    new: number;
    watchlist: number;
    approved: number;
    rejected: number;
    avgScore: number;
  }> {
    const all = await db.select().from(universeCandidates);

    let newCount = 0;
    let watchlistCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let totalScore = 0;

    for (const c of all) {
      if (c.status === "NEW") newCount++;
      else if (c.status === "WATCHLIST") watchlistCount++;
      else if (c.status === "APPROVED") approvedCount++;
      else if (c.status === "REJECTED") rejectedCount++;

      const score = parseFloat(c.finalScore || "0");
      totalScore += isNaN(score) ? 0 : score;
    }

    return {
      total: all.length,
      new: newCount,
      watchlist: watchlistCount,
      approved: approvedCount,
      rejected: rejectedCount,
      avgScore: all.length > 0 ? Math.round((totalScore / all.length) * 100) / 100 : 0,
    };
  }

  async getTopCandidates(limit = 50): Promise<UniverseCandidate[]> {
    return db
      .select()
      .from(universeCandidates)
      .where(inArray(universeCandidates.status, ["NEW", "WATCHLIST", "APPROVED"]))
      .orderBy(desc(universeCandidates.finalScore))
      .limit(limit);
  }
}

export const candidatesService = new CandidatesService();
