/**
 * Comprehensive Alpaca Order Failure Report
 *
 * Combines data from orders table and work_items table to provide
 * a complete picture of order cancellations and rejections.
 */

const { Pool } = require("@neondatabase/serverless");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function categorizeError(error, payload) {
  const lowerError = error?.toLowerCase() || "";
  const payloadData =
    typeof payload === "string" ? JSON.parse(payload) : payload;

  const orderType = payloadData?.type?.toLowerCase() || "";
  const tif = payloadData?.time_in_force?.toLowerCase() || "";
  const extendedHours = payloadData?.extended_hours || false;

  // Market orders in extended hours
  if (
    lowerError.includes("market orders not allowed") &&
    (lowerError.includes("pre_market") || lowerError.includes("after_hours"))
  ) {
    return {
      category: "MARKET_ORDER_EXTENDED_HOURS",
      description:
        "Market orders attempted during extended hours (pre-market/after-hours)",
      severity: "CRITICAL",
      fix: "Reject market orders during extended hours OR auto-convert to limit orders with competitive pricing",
    };
  }

  // TIF validation errors
  if (lowerError.includes("time_in_force") || lowerError.includes("tif")) {
    return {
      category: "INVALID_TIME_IN_FORCE",
      description: "Invalid time_in_force for order type or market session",
      severity: "HIGH",
      fix: "Validate TIF before submission: market orders must be DAY, bracket orders must be DAY",
    };
  }

  // GTC with incompatible order types
  if (tif === "gtc" && orderType === "market") {
    return {
      category: "GTC_MARKET_ORDER",
      description: "Market orders cannot have GTC time_in_force",
      severity: "HIGH",
      fix: "Force market orders to DAY time_in_force",
    };
  }

  // Insufficient funds
  if (lowerError.includes("insufficient") || lowerError.includes("balance")) {
    return {
      category: "INSUFFICIENT_FUNDS",
      description: "Insufficient buying power for order",
      severity: "MEDIUM",
      fix: "Pre-check buying power before order submission",
    };
  }

  // Price validation
  if (
    lowerError.includes("price") ||
    lowerError.includes("limit_price") ||
    lowerError.includes("stop_price")
  ) {
    return {
      category: "INVALID_PRICE",
      description: "Invalid limit or stop price",
      severity: "MEDIUM",
      fix: "Validate prices against current market price and minimum tick size",
    };
  }

  // Symbol/asset errors
  if (
    lowerError.includes("symbol") ||
    lowerError.includes("asset") ||
    lowerError.includes("not tradable") ||
    lowerError.includes("not found")
  ) {
    return {
      category: "INVALID_SYMBOL",
      description: "Symbol not found or not tradable",
      severity: "LOW",
      fix: "Pre-validate symbols against broker_assets table",
    };
  }

  // System errors (our code bugs)
  if (
    lowerError.includes("is not a function") ||
    lowerError.includes("undefined") ||
    lowerError.includes("null")
  ) {
    return {
      category: "SYSTEM_ERROR",
      description: "Internal system error (code bug)",
      severity: "CRITICAL",
      fix: "Fix the code bug in the trading system",
    };
  }

  // Canceled orders (user or system initiated)
  if (lowerError === "canceled" || !error) {
    return {
      category: "USER_CANCELED",
      description: "Order was canceled (possibly by user or system cleanup)",
      severity: "INFO",
      fix: "No action needed - this is normal behavior",
    };
  }

  return {
    category: "OTHER",
    description: error || "Unknown error",
    severity: "UNKNOWN",
    fix: "Investigate error message",
  };
}

async function generateReport() {
  console.log("=".repeat(100));
  console.log("COMPREHENSIVE ALPACA ORDER CANCELLATION & REJECTION ANALYSIS");
  console.log("=".repeat(100));
  console.log("\nAnalyzing last 48 hours of failed orders and work items\n");

  try {
    // Query failed work items
    const workItemQuery = `
      SELECT
        id,
        type,
        status,
        last_error,
        broker_order_id,
        symbol,
        payload,
        created_at,
        attempts,
        max_attempts
      FROM work_items
      WHERE type IN ('ORDER_SUBMIT', 'ORDER_CANCEL')
        AND status IN ('FAILED', 'DEAD_LETTER')
        AND created_at >= NOW() - INTERVAL '48 hours'
      ORDER BY created_at DESC
    `;

    const workItemResult = await pool.query(workItemQuery);
    const failedWorkItems = workItemResult.rows;

    // Categorize failures
    const categories = new Map();
    const symbolStats = new Map();
    const timeOfDayStats = new Map();
    const orderTypeStats = new Map();

    console.log(`Found ${failedWorkItems.length} failed work items\n`);

    failedWorkItems.forEach((wi) => {
      const category = categorizeError(wi.last_error, wi.payload);
      const payload =
        typeof wi.payload === "string" ? JSON.parse(wi.payload) : wi.payload;

      // Track by category
      if (!categories.has(category.category)) {
        categories.set(category.category, {
          ...category,
          count: 0,
          examples: [],
        });
      }
      const catData = categories.get(category.category);
      catData.count++;
      if (catData.examples.length < 5) {
        catData.examples.push({
          symbol: wi.symbol || payload.symbol,
          workItemId: wi.id,
          type: payload.type,
          tif: payload.time_in_force,
          extendedHours: payload.extended_hours,
          createdAt: wi.created_at,
          error: wi.last_error,
          attempts: wi.attempts,
          payload,
        });
      }

      // Track by symbol
      const symbol = wi.symbol || payload.symbol;
      if (symbol) {
        if (!symbolStats.has(symbol)) {
          symbolStats.set(symbol, { count: 0, categories: new Set() });
        }
        symbolStats.get(symbol).count++;
        symbolStats.get(symbol).categories.add(category.category);
      }

      // Track by time of day
      const hour = new Date(wi.created_at).getUTCHours();
      let timeSlot;
      if (hour >= 9 && hour < 13) timeSlot = "04:00-09:00 ET (Pre-Market)";
      else if (hour >= 13 && hour < 21)
        timeSlot = "09:00-17:00 ET (Regular Hours)";
      else if (hour >= 21 || hour < 1)
        timeSlot = "17:00-20:00 ET (After-Hours)";
      else timeSlot = "20:00-04:00 ET (Closed)";

      if (!timeOfDayStats.has(timeSlot)) {
        timeOfDayStats.set(timeSlot, { count: 0, categories: new Map() });
      }
      timeOfDayStats.get(timeSlot).count++;
      const todCat = timeOfDayStats.get(timeSlot).categories;
      todCat.set(category.category, (todCat.get(category.category) || 0) + 1);

      // Track by order type
      const orderTypeKey = `${payload.type || "unknown"}/${payload.time_in_force || "unknown"}`;
      if (!orderTypeStats.has(orderTypeKey)) {
        orderTypeStats.set(orderTypeKey, { count: 0, categories: new Set() });
      }
      orderTypeStats.get(orderTypeKey).count++;
      orderTypeStats.get(orderTypeKey).categories.add(category.category);
    });

    // Print Category Breakdown
    console.log("═".repeat(100));
    console.log("1. FAILURE CATEGORY BREAKDOWN");
    console.log("═".repeat(100));

    const sortedCategories = Array.from(categories.values()).sort(
      (a, b) => b.count - a.count
    );

    sortedCategories.forEach((cat, idx) => {
      const pct = ((cat.count / failedWorkItems.length) * 100).toFixed(1);
      console.log(`\n┌─ [${idx + 1}] ${cat.category}`);
      console.log(`│   Count:       ${cat.count} failures (${pct}%)`);
      console.log(`│   Severity:    ${cat.severity}`);
      console.log(`│   Description: ${cat.description}`);
      console.log(`│   Fix:         ${cat.fix}`);
      console.log("│");
      console.log("│   Examples:");

      cat.examples.forEach((ex, i) => {
        console.log(`│   ${i + 1}. ${ex.symbol} - ${ex.type}/${ex.tif}`);
        console.log(
          `│      Extended Hours: ${ex.extendedHours}, Attempts: ${ex.attempts}`
        );
        console.log(`│      Time: ${new Date(ex.createdAt).toISOString()}`);
        console.log(
          `│      Error: ${ex.error?.substring(0, 100)}${ex.error?.length > 100 ? "..." : ""}`
        );
        if (i < cat.examples.length - 1) console.log("│");
      });
      console.log("└" + "─".repeat(98));
    });

    // Print Symbol Statistics
    console.log("\n\n" + "═".repeat(100));
    console.log("2. MOST AFFECTED SYMBOLS");
    console.log("═".repeat(100));

    const sortedSymbols = Array.from(symbolStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);

    console.log(
      "\n┌─────────────┬───────┬─────────────────────────────────────────────────┐"
    );
    console.log(
      "│ Symbol      │ Count │ Failure Categories                              │"
    );
    console.log(
      "├─────────────┼───────┼─────────────────────────────────────────────────┤"
    );
    sortedSymbols.forEach(([symbol, data]) => {
      const categories = Array.from(data.categories).join(", ");
      const truncCat =
        categories.length > 45
          ? categories.substring(0, 42) + "..."
          : categories;
      console.log(
        `│ ${symbol.padEnd(11)} │ ${String(data.count).padStart(5)} │ ${truncCat.padEnd(47)} │`
      );
    });
    console.log(
      "└─────────────┴───────┴─────────────────────────────────────────────────┘"
    );

    // Print Time of Day Analysis
    console.log("\n\n" + "═".repeat(100));
    console.log("3. TIME OF DAY ANALYSIS");
    console.log("═".repeat(100));

    const sortedTimes = Array.from(timeOfDayStats.entries()).sort(
      (a, b) => b[1].count - a[1].count
    );

    sortedTimes.forEach(([time, data]) => {
      const pct = ((data.count / failedWorkItems.length) * 100).toFixed(1);
      console.log(`\n${time} - ${data.count} failures (${pct}%)`);

      const sortedCats = Array.from(data.categories.entries()).sort(
        (a, b) => b[1] - a[1]
      );

      sortedCats.forEach(([cat, count]) => {
        console.log(`  ├─ ${cat}: ${count}`);
      });
    });

    // Print Order Type Analysis
    console.log("\n\n" + "═".repeat(100));
    console.log("4. ORDER TYPE / TIME-IN-FORCE COMBINATIONS");
    console.log("═".repeat(100));

    const sortedOrderTypes = Array.from(orderTypeStats.entries()).sort(
      (a, b) => b[1].count - a[1].count
    );

    console.log(
      "\n┌─────────────────────┬───────┬───────────────────────────────────────┐"
    );
    console.log(
      "│ Type/TIF            │ Count │ Failure Categories                    │"
    );
    console.log(
      "├─────────────────────┼───────┼───────────────────────────────────────┤"
    );
    sortedOrderTypes.forEach(([type, data]) => {
      const categories = Array.from(data.categories).join(", ");
      const truncCat =
        categories.length > 37
          ? categories.substring(0, 34) + "..."
          : categories;
      console.log(
        `│ ${type.padEnd(19)} │ ${String(data.count).padStart(5)} │ ${truncCat.padEnd(37)} │`
      );
    });
    console.log(
      "└─────────────────────┴───────┴───────────────────────────────────────┘"
    );

    // Print Actionable Recommendations
    console.log("\n\n" + "═".repeat(100));
    console.log("5. ACTIONABLE RECOMMENDATIONS (PRIORITY ORDERED)");
    console.log("═".repeat(100));

    const recommendations = [];

    sortedCategories.forEach((cat) => {
      if (cat.severity === "CRITICAL" || cat.severity === "HIGH") {
        recommendations.push({
          priority: cat.severity,
          category: cat.category,
          count: cat.count,
          fix: cat.fix,
          codeLocation: getCodeLocation(cat.category),
        });
      }
    });

    recommendations.forEach((rec, idx) => {
      console.log(
        `\n[${idx + 1}] ${rec.priority} PRIORITY - ${rec.category} (${rec.count} occurrences)`
      );
      console.log(`    Fix:           ${rec.fix}`);
      console.log(`    Code Location: ${rec.codeLocation}`);
    });

    // Summary Statistics
    console.log("\n\n" + "═".repeat(100));
    console.log("6. SUMMARY STATISTICS");
    console.log("═".repeat(100));

    console.log(`\nTotal Failed Work Items:     ${failedWorkItems.length}`);
    console.log(`Unique Failure Categories:   ${categories.size}`);
    console.log(`Affected Symbols:            ${symbolStats.size}`);
    console.log(
      `Critical/High Severity:      ${sortedCategories.filter((c) => c.severity === "CRITICAL" || c.severity === "HIGH").length} categories`
    );

    // Calculate success rate (need to query successful orders)
    const successQuery = `
      SELECT COUNT(*) as success_count
      FROM work_items
      WHERE type = 'ORDER_SUBMIT'
        AND status = 'SUCCEEDED'
        AND created_at >= NOW() - INTERVAL '48 hours'
    `;
    const successResult = await pool.query(successQuery);
    const successCount = parseInt(successResult.rows[0].success_count);
    const totalAttempts =
      successCount +
      failedWorkItems.filter((w) => w.type === "ORDER_SUBMIT").length;
    const successRate =
      totalAttempts > 0 ? ((successCount / totalAttempts) * 100).toFixed(2) : 0;

    console.log(
      `\nOrder Submission Success Rate: ${successRate}% (${successCount} successful, ${failedWorkItems.filter((w) => w.type === "ORDER_SUBMIT").length} failed)`
    );

    console.log("\n\n" + "═".repeat(100));
    console.log("ANALYSIS COMPLETE");
    console.log("═".repeat(100));
  } catch (error) {
    console.error("Error generating report:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

function getCodeLocation(category) {
  const locations = {
    MARKET_ORDER_EXTENDED_HOURS:
      "server/trading/unified-order-executor.ts or services/trading-engine/order-manager.ts",
    INVALID_TIME_IN_FORCE: "server/trading/order-types-matrix.ts",
    GTC_MARKET_ORDER: "server/connectors/alpaca.ts (validateOrder method)",
    SYSTEM_ERROR:
      "Check stack trace - likely server/trading/* or services/trading-engine/*",
    INVALID_PRICE: "Add validation in order submission flow",
    INVALID_SYMBOL: "Pre-validate against broker_assets table",
    INSUFFICIENT_FUNDS: "Add buying power check before order submission",
  };

  return locations[category] || "Unknown - needs investigation";
}

generateReport()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Report generation failed:", error);
    process.exit(1);
  });
