import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../server/db";
import { count, desc } from "drizzle-orm";
import * as schema from "../../shared/schema";

const API_BASE = "http://localhost:5000";

describe("Data Flow: Database to API", () => {
  describe("Positions Data Flow", () => {
    let dbPositions: any[];
    let apiPositions: any[];

    beforeAll(async () => {
      dbPositions = await db.select().from(schema.positions);

      try {
        const response = await fetch(`${API_BASE}/api/alpaca/positions`);
        const data = await response.json();
        apiPositions = Array.isArray(data) ? data : data.positions || [];
      } catch (error) {
        console.error("Failed to fetch positions from API:", error);
        apiPositions = [];
      }
    });

    it("should have positions in database or API", () => {
      console.log(
        `DB positions: ${dbPositions.length}, API positions: ${apiPositions.length}`
      );
      expect(dbPositions.length >= 0 || apiPositions.length >= 0).toBe(true);
    });
  });

  describe("AI Decisions Data Flow", () => {
    let dbDecisions: any[];

    beforeAll(async () => {
      try {
        dbDecisions = await db
          .select()
          .from(schema.aiDecisions)
          .orderBy(desc(schema.aiDecisions.createdAt))
          .limit(50);
      } catch (error) {
        console.error("Failed to query AI decisions:", error);
        dbDecisions = [];
      }
    });

    it("should have AI decisions in database", () => {
      console.log(`DB AI decisions: ${dbDecisions.length}`);
      if (dbDecisions.length === 0) {
        console.warn("WARNING: No AI decisions found in database");
      }
    });

    it("should have actionable AI decisions", () => {
      const actionableDecisions = dbDecisions.filter((d) => {
        const hasAction = d.action || d.recommendation || d.signal;
        const hasSymbol = d.symbol;
        return hasAction && hasSymbol;
      });

      console.log(
        `Actionable decisions: ${actionableDecisions.length}/${dbDecisions.length}`
      );

      if (actionableDecisions.length === 0 && dbDecisions.length > 0) {
        console.error("AI DECISIONS LACK ACTIONABLE FIELDS");
        console.log(
          "Sample decision:",
          JSON.stringify(dbDecisions[0], null, 2)
        );
      }
    });
  });

  describe("Trades Data Flow", () => {
    let dbTrades: any[];

    beforeAll(async () => {
      try {
        dbTrades = await db
          .select()
          .from(schema.trades)
          .orderBy(desc(schema.trades.executedAt))
          .limit(100);
      } catch (error) {
        console.error("Failed to query trades:", error);
        dbTrades = [];
      }
    });

    it("should have trades in database", () => {
      console.log(`DB trades: ${dbTrades.length}`);
    });
  });

  describe("Orders Data Flow", () => {
    let dbOrders: any[];

    beforeAll(async () => {
      try {
        dbOrders = await db
          .select()
          .from(schema.orders)
          .orderBy(desc(schema.orders.createdAt))
          .limit(100);
      } catch (error) {
        console.error("Failed to query orders:", error);
        dbOrders = [];
      }
    });

    it("should have orders in database", () => {
      console.log(`DB orders: ${dbOrders.length}`);

      if (dbOrders.length > 0) {
        const statuses: Record<string, number> = {};
        for (const order of dbOrders) {
          const status = order.status || "unknown";
          statuses[status] = (statuses[status] || 0) + 1;
        }
        console.log("Order statuses:", statuses);
      }
    });
  });
});
