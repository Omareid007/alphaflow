#!/usr/bin/env tsx
/**
 * Database Query Performance Analyzer
 * Analyzes query performance, index usage, and identifies optimization opportunities
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface QueryPlan {
  query: string;
  executionTime: number;
  planText: string;
  hasSeqScan: boolean;
  hasIndexScan: boolean;
  rowsReturned: number;
}

interface QueryStats {
  query: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  calls: number;
  totalTime: number;
}

async function analyzeQuery(query: string, label: string): Promise<QueryPlan> {
  console.log(`\n📊 Analyzing: ${label}`);
  console.log(`   Query: ${query.substring(0, 80)}...`);

  const start = Date.now();

  try {
    // Run EXPLAIN ANALYZE
    const explainResult = await pool.query(`EXPLAIN ANALYZE ${query}`);
    const executionTime = Date.now() - start;

    const planText = explainResult.rows.map((r) => r["QUERY PLAN"]).join("\n");
    const hasSeqScan = planText.toLowerCase().includes("seq scan");
    const hasIndexScan =
      planText.toLowerCase().includes("index scan") ||
      planText.toLowerCase().includes("index only scan");

    // Extract rows returned from plan
    const rowMatch = planText.match(/rows=(\d+)/);
    const rowsReturned = rowMatch ? parseInt(rowMatch[1]) : 0;

    console.log(`   ⏱️  Execution Time: ${executionTime}ms`);
    console.log(`   📈 Rows: ${rowsReturned}`);
    console.log(
      `   🔍 Scan Type: ${hasSeqScan ? "⚠️ Sequential Scan" : hasIndexScan ? "✅ Index Scan" : "❓ Unknown"}`
    );

    if (hasSeqScan && rowsReturned > 100) {
      console.log(
        `   🚨 WARNING: Sequential scan on ${rowsReturned} rows - consider adding an index!`
      );
    }

    return {
      query: label,
      executionTime,
      planText,
      hasSeqScan,
      hasIndexScan,
      rowsReturned,
    };
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      query: label,
      executionTime: Date.now() - start,
      planText: error.message,
      hasSeqScan: false,
      hasIndexScan: false,
      rowsReturned: 0,
    };
  }
}

async function testDatabasePerformance() {
  console.log("🔍 DATABASE QUERY PERFORMANCE ANALYSIS");
  console.log("=".repeat(80));

  const results: QueryPlan[] = [];

  // Check if we have test user data
  const userCheck = await pool.query(`SELECT id FROM users LIMIT 1`);
  if (userCheck.rows.length === 0) {
    console.log(
      "\n⚠️  No users found in database. Some queries will be skipped."
    );
  }
  const userId = userCheck.rows[0]?.id;

  // Test common queries
  console.log("\n\n📋 TESTING COMMON QUERIES");
  console.log("─".repeat(80));

  // Positions query
  if (userId) {
    results.push(
      await analyzeQuery(
        `SELECT * FROM positions WHERE user_id = '${userId}'`,
        "Get user positions"
      )
    );
  }

  // Orders query
  if (userId) {
    results.push(
      await analyzeQuery(
        `SELECT * FROM orders WHERE user_id = '${userId}' ORDER BY created_at DESC LIMIT 100`,
        "Get recent orders"
      )
    );
  }

  // Trades query with joins
  if (userId) {
    results.push(
      await analyzeQuery(
        `SELECT t.*, s.name as strategy_name
       FROM trades t
       LEFT JOIN strategies s ON t.strategy_id = s.id
       WHERE t.user_id = '${userId}'
       ORDER BY t.executed_at DESC
       LIMIT 100`,
        "Get enriched trades"
      )
    );
  }

  // AI decisions with joins
  if (userId) {
    results.push(
      await analyzeQuery(
        `SELECT d.*, t.symbol as trade_symbol, t.pnl
       FROM ai_decisions d
       LEFT JOIN trades t ON d.executed_trade_id = t.id
       WHERE d.user_id = '${userId}'
       ORDER BY d.created_at DESC
       LIMIT 100`,
        "Get enriched AI decisions"
      )
    );
  }

  // Activity timeline (complex query)
  if (userId) {
    results.push(
      await analyzeQuery(
        `SELECT 'trade' as type, id, executed_at as timestamp, symbol
       FROM trades WHERE user_id = '${userId}'
       UNION ALL
       SELECT 'decision' as type, id, created_at as timestamp, symbol
       FROM ai_decisions WHERE user_id = '${userId}'
       ORDER BY timestamp DESC
       LIMIT 50`,
        "Activity timeline (UNION query)"
      )
    );
  }

  // Session cleanup query
  results.push(
    await analyzeQuery(
      `SELECT COUNT(*) FROM sessions WHERE expires_at < NOW()`,
      "Count expired sessions"
    )
  );

  // Check for missing indexes
  console.log("\n\n🔍 CHECKING FOR MISSING INDEXES");
  console.log("─".repeat(80));

  const tableQueries = [
    { table: "trades", column: "strategy_id", reason: "Frequently joined" },
    { table: "trades", column: "symbol", reason: "Frequently filtered" },
    { table: "trades", column: "executed_at", reason: "Used in ORDER BY" },
    {
      table: "ai_decisions",
      column: "strategy_id",
      reason: "Frequently joined",
    },
    { table: "ai_decisions", column: "symbol", reason: "Frequently filtered" },
    { table: "ai_decisions", column: "created_at", reason: "Used in ORDER BY" },
    { table: "ai_decisions", column: "status", reason: "Frequently filtered" },
    { table: "positions", column: "symbol", reason: "Frequently filtered" },
    { table: "orders", column: "symbol", reason: "Frequently filtered" },
    { table: "orders", column: "created_at", reason: "Used in ORDER BY" },
  ];

  const indexCheck = await pool.query(`
    SELECT
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  const existingIndexes = new Map<string, string[]>();
  indexCheck.rows.forEach((row) => {
    if (!existingIndexes.has(row.tablename)) {
      existingIndexes.set(row.tablename, []);
    }
    existingIndexes.get(row.tablename)!.push(row.indexdef.toLowerCase());
  });

  const missingIndexes: Array<{
    table: string;
    column: string;
    reason: string;
  }> = [];

  for (const { table, column, reason } of tableQueries) {
    const indexes = existingIndexes.get(table) || [];
    const hasIndex = indexes.some(
      (idx) =>
        idx.includes(`(${column})`) ||
        idx.includes(`(${column},`) ||
        idx.includes(`, ${column}`)
    );

    if (!hasIndex) {
      missingIndexes.push({ table, column, reason });
      console.log(`⚠️  Missing index on ${table}.${column} - ${reason}`);
    } else {
      console.log(`✅ Index exists on ${table}.${column}`);
    }
  }

  // Check table sizes and statistics
  console.log("\n\n📊 TABLE STATISTICS");
  console.log("─".repeat(80));

  const tableSizes = await pool.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
      pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY size_bytes DESC
    LIMIT 20
  `);

  console.log("\nTable Sizes:");
  tableSizes.rows.forEach((row) => {
    console.log(`  ${row.tablename.padEnd(35)} ${row.size}`);
  });

  // Row counts
  const tables = [
    "users",
    "sessions",
    "strategies",
    "trades",
    "positions",
    "ai_decisions",
    "orders",
    "fills",
    "backtest_runs",
  ];

  console.log("\nRow Counts:");
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(result.rows[0].count);
      const status = count === 0 ? "⚠️" : count > 1000 ? "📈" : "✅";
      console.log(
        `  ${status} ${table.padEnd(35)} ${count.toLocaleString()} rows`
      );
    } catch (error) {
      console.log(`  ❌ ${table.padEnd(35)} Error getting count`);
    }
  }

  // Check connection pool status
  console.log("\n\n🔌 CONNECTION POOL STATUS");
  console.log("─".repeat(80));
  console.log(`  Total connections: ${pool.totalCount}`);
  console.log(`  Idle connections: ${pool.idleCount}`);
  console.log(`  Waiting requests: ${pool.waitingCount}`);

  // Check for slow queries (if pg_stat_statements is available)
  console.log("\n\n🐌 SLOW QUERY DETECTION");
  console.log("─".repeat(80));

  try {
    const slowQueries = await pool.query(`
      SELECT
        LEFT(query, 80) as query_preview,
        calls,
        ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
        ROUND(total_exec_time::numeric, 2) as total_time_ms
      FROM pg_stat_statements
      WHERE mean_exec_time > 100
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `);

    if (slowQueries.rows.length > 0) {
      console.log("Top slow queries (>100ms average):");
      slowQueries.rows.forEach((row) => {
        console.log(`\n  Query: ${row.query_preview}...`);
        console.log(
          `  Calls: ${row.calls}, Avg: ${row.avg_time_ms}ms, Total: ${row.total_time_ms}ms`
        );
      });
    } else {
      console.log(
        "✅ No slow queries detected (or pg_stat_statements not enabled)"
      );
    }
  } catch (error) {
    console.log("⚠️  pg_stat_statements extension not available");
    console.log("   To enable: CREATE EXTENSION pg_stat_statements;");
  }

  // Generate optimization report
  console.log("\n\n");
  console.log("=".repeat(80));
  console.log("📈 OPTIMIZATION RECOMMENDATIONS");
  console.log("=".repeat(80));

  const recommendations: Array<{
    priority: string;
    title: string;
    description: string;
    impact: string;
  }> = [];

  // Check for sequential scans
  const seqScans = results.filter((r) => r.hasSeqScan && r.rowsReturned > 100);
  if (seqScans.length > 0) {
    recommendations.push({
      priority: "CRITICAL",
      title: "Add indexes to eliminate sequential scans",
      description: `${seqScans.length} queries are doing sequential scans on large tables`,
      impact: "HIGH - Can improve query performance by 10-100x",
    });
  }

  // Check for missing indexes
  if (missingIndexes.length > 0) {
    recommendations.push({
      priority: "HIGH",
      title: "Add missing indexes",
      description: `${missingIndexes.length} commonly queried columns lack indexes: ${missingIndexes.map((m) => `${m.table}.${m.column}`).join(", ")}`,
      impact: "MEDIUM-HIGH - Improve query performance by 2-10x",
    });
  }

  // Check for slow queries
  const slowQueries = results.filter((r) => r.executionTime > 200);
  if (slowQueries.length > 0) {
    recommendations.push({
      priority: "MEDIUM",
      title: "Optimize slow queries",
      description: `${slowQueries.length} queries taking >200ms`,
      impact: "MEDIUM - Improve user experience",
    });
  }

  // Sort by priority
  const priorityOrder = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
  recommendations.sort(
    (a, b) =>
      priorityOrder[a.priority as keyof typeof priorityOrder] -
      priorityOrder[b.priority as keyof typeof priorityOrder]
  );

  recommendations.forEach((rec, i) => {
    console.log(`\n${i + 1}. [${rec.priority}] ${rec.title}`);
    console.log(`   ${rec.description}`);
    console.log(`   Impact: ${rec.impact}`);
  });

  // Specific index recommendations
  if (missingIndexes.length > 0) {
    console.log("\n\n📝 SUGGESTED INDEX COMMANDS:");
    console.log("─".repeat(80));
    missingIndexes.forEach(({ table, column }) => {
      console.log(
        `CREATE INDEX CONCURRENTLY ${table}_${column}_idx ON ${table}(${column});`
      );
    });
  }

  console.log("\n");
  console.log("=".repeat(80));
  console.log("Analysis Complete!");
  console.log("=".repeat(80));
}

async function main() {
  try {
    await testDatabasePerformance();
  } catch (error) {
    console.error("Error during performance testing:", error);
  } finally {
    await pool.end();
  }
}

main();
