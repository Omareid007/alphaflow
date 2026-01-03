/**
 * Alpaca Order Cancellation & Rejection Analysis Script
 *
 * This script queries the database for canceled and rejected orders
 * and categorizes them by failure reason to identify patterns.
 */

const { Pool } = require("@neondatabase/serverless");

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Analysis time window (last 48 hours)
const HOURS_TO_ANALYZE = 48;

/**
 * Extract error reason from various sources
 */
function extractErrorReason(order) {
  // Try to parse error from raw JSON first
  if (order.raw_json && order.raw_json.message) {
    return order.raw_json.message;
  }

  // Fallback to status
  return order.status || "unknown";
}

/**
 * Categorize order failure based on error message and parameters
 */
function categorizeFailure(order, errorReason) {
  const lowerError = errorReason.toLowerCase();
  const orderType = order.type?.toLowerCase() || "";
  const timeInForce = order.time_in_force?.toLowerCase() || "";
  const extendedHours = order.extended_hours || false;

  // Market orders in extended hours
  if (orderType === "market" && extendedHours) {
    return {
      category: "MARKET_ORDER_EXTENDED_HOURS",
      description: "Market orders not allowed in extended hours",
      severity: "HIGH",
    };
  }

  // Invalid TIF for order type
  if (lowerError.includes("time_in_force") || lowerError.includes("tif")) {
    return {
      category: "INVALID_TIME_IN_FORCE",
      description: "Invalid time_in_force for order type or market session",
      severity: "HIGH",
    };
  }

  // GTC not allowed for certain order types
  if (
    timeInForce === "gtc" &&
    (orderType === "market" || lowerError.includes("gtc"))
  ) {
    return {
      category: "GTC_NOT_ALLOWED",
      description: "GTC (Good-Til-Canceled) not allowed for this order type",
      severity: "HIGH",
    };
  }

  // Price issues
  if (
    lowerError.includes("limit_price") ||
    lowerError.includes("price") ||
    lowerError.includes("stop_price") ||
    lowerError.includes("invalid price")
  ) {
    return {
      category: "INVALID_PRICE",
      description: "Invalid limit or stop price",
      severity: "MEDIUM",
    };
  }

  // Quantity issues
  if (
    lowerError.includes("qty") ||
    lowerError.includes("quantity") ||
    lowerError.includes("notional") ||
    lowerError.includes("fractional")
  ) {
    return {
      category: "INVALID_QUANTITY",
      description: "Invalid order quantity or notional value",
      severity: "MEDIUM",
    };
  }

  // Symbol issues
  if (
    lowerError.includes("symbol") ||
    lowerError.includes("asset") ||
    lowerError.includes("not found") ||
    lowerError.includes("not tradable")
  ) {
    return {
      category: "INVALID_SYMBOL",
      description: "Symbol not found or not tradable",
      severity: "LOW",
    };
  }

  // Insufficient funds
  if (
    lowerError.includes("insufficient") ||
    lowerError.includes("buying power") ||
    lowerError.includes("funds")
  ) {
    return {
      category: "INSUFFICIENT_FUNDS",
      description: "Insufficient buying power",
      severity: "LOW",
    };
  }

  // Market closed
  if (lowerError.includes("market") && lowerError.includes("closed")) {
    return {
      category: "MARKET_CLOSED",
      description: "Market is closed",
      severity: "LOW",
    };
  }

  // Order class issues (bracket, OCO, OTO)
  if (
    lowerError.includes("order_class") ||
    lowerError.includes("bracket") ||
    lowerError.includes("oco") ||
    lowerError.includes("oto")
  ) {
    return {
      category: "INVALID_ORDER_CLASS",
      description: "Invalid order class configuration",
      severity: "HIGH",
    };
  }

  // Generic rejection
  return {
    category: "OTHER_REJECTION",
    description: errorReason,
    severity: "UNKNOWN",
  };
}

/**
 * Format time of day for analysis
 */
function getTimeOfDay(timestamp) {
  const date = new Date(timestamp);
  const hour = date.getHours();

  if (hour >= 4 && hour < 9) return "PRE_MARKET (4am-9:30am ET)";
  if (hour >= 9 && hour < 16) return "REGULAR_HOURS (9:30am-4pm ET)";
  if (hour >= 16 && hour < 20) return "AFTER_HOURS (4pm-8pm ET)";
  return "CLOSED (8pm-4am ET)";
}

/**
 * Main analysis function
 */
async function analyzeOrderFailures() {
  console.log("=".repeat(80));
  console.log("ALPACA ORDER CANCELLATION & REJECTION ANALYSIS");
  console.log("=".repeat(80));
  console.log(`Analyzing orders from the last ${HOURS_TO_ANALYZE} hours\n`);

  try {
    // Query for canceled and rejected orders
    const query = `
      SELECT
        id,
        broker_order_id,
        client_order_id,
        symbol,
        side,
        type,
        time_in_force,
        qty,
        notional,
        limit_price,
        stop_price,
        status,
        extended_hours,
        order_class,
        submitted_at,
        updated_at,
        failed_at,
        canceled_at,
        raw_json,
        trace_id
      FROM orders
      WHERE status IN ('canceled', 'rejected', 'expired', 'stopped', 'suspended')
        AND submitted_at >= NOW() - INTERVAL '${HOURS_TO_ANALYZE} hours'
      ORDER BY submitted_at DESC
    `;

    const result = await pool.query(query);
    const orders = result.rows;

    if (orders.length === 0) {
      console.log(
        "No canceled or rejected orders found in the specified time window."
      );
      return;
    }

    console.log(`Found ${orders.length} failed orders\n`);

    // Categorize all failures
    const categorizedFailures = new Map();
    const symbolFailures = new Map();
    const timeOfDayFailures = new Map();
    const orderTypeFailures = new Map();

    orders.forEach((order) => {
      const errorReason = extractErrorReason(order);
      const category = categorizeFailure(order, errorReason);
      const timeOfDay = getTimeOfDay(order.submitted_at);

      // Track by category
      if (!categorizedFailures.has(category.category)) {
        categorizedFailures.set(category.category, {
          ...category,
          count: 0,
          examples: [],
        });
      }
      const catData = categorizedFailures.get(category.category);
      catData.count++;
      if (catData.examples.length < 3) {
        catData.examples.push({
          symbol: order.symbol,
          orderId: order.broker_order_id,
          type: order.type,
          tif: order.time_in_force,
          extendedHours: order.extended_hours,
          orderClass: order.order_class,
          submittedAt: order.submitted_at,
          error: errorReason,
        });
      }

      // Track by symbol
      if (!symbolFailures.has(order.symbol)) {
        symbolFailures.set(order.symbol, { count: 0, categories: new Set() });
      }
      symbolFailures.get(order.symbol).count++;
      symbolFailures.get(order.symbol).categories.add(category.category);

      // Track by time of day
      if (!timeOfDayFailures.has(timeOfDay)) {
        timeOfDayFailures.set(timeOfDay, { count: 0, categories: new Map() });
      }
      timeOfDayFailures.get(timeOfDay).count++;
      const todCat = timeOfDayFailures.get(timeOfDay).categories;
      todCat.set(category.category, (todCat.get(category.category) || 0) + 1);

      // Track by order type
      const orderTypeKey = `${order.type || "unknown"}/${order.time_in_force || "unknown"}`;
      if (!orderTypeFailures.has(orderTypeKey)) {
        orderTypeFailures.set(orderTypeKey, {
          count: 0,
          categories: new Set(),
        });
      }
      orderTypeFailures.get(orderTypeKey).count++;
      orderTypeFailures.get(orderTypeKey).categories.add(category.category);
    });

    // Print Category Analysis
    console.log("─".repeat(80));
    console.log("1. FAILURE CATEGORIES");
    console.log("─".repeat(80));

    const sortedCategories = Array.from(categorizedFailures.values()).sort(
      (a, b) => b.count - a.count
    );

    sortedCategories.forEach((cat, idx) => {
      const pct = ((cat.count / orders.length) * 100).toFixed(1);
      console.log(
        `\n[${idx + 1}] ${cat.category} (${cat.count} orders, ${pct}%)`
      );
      console.log(`    Description: ${cat.description}`);
      console.log(`    Severity: ${cat.severity}`);
      console.log(`\n    Examples:`);

      cat.examples.forEach((ex, i) => {
        console.log(
          `      ${i + 1}. ${ex.symbol} - ${ex.type}/${ex.tif} (Order: ${ex.orderId})`
        );
        console.log(
          `         Extended Hours: ${ex.extendedHours}, Order Class: ${ex.orderClass || "simple"}`
        );
        console.log(`         Time: ${new Date(ex.submittedAt).toISOString()}`);
        console.log(
          `         Error: ${ex.error.substring(0, 120)}${ex.error.length > 120 ? "..." : ""}`
        );
      });
    });

    // Print Symbol Analysis
    console.log("\n\n" + "─".repeat(80));
    console.log("2. AFFECTED SYMBOLS");
    console.log("─".repeat(80));

    const sortedSymbols = Array.from(symbolFailures.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);

    sortedSymbols.forEach(([symbol, data]) => {
      const categories = Array.from(data.categories).join(", ");
      console.log(
        `${symbol.padEnd(10)} - ${data.count} failures (${categories})`
      );
    });

    // Print Time of Day Analysis
    console.log("\n\n" + "─".repeat(80));
    console.log("3. TIME OF DAY ANALYSIS");
    console.log("─".repeat(80));

    const sortedTimes = Array.from(timeOfDayFailures.entries()).sort(
      (a, b) => b[1].count - a[1].count
    );

    sortedTimes.forEach(([time, data]) => {
      const pct = ((data.count / orders.length) * 100).toFixed(1);
      console.log(`\n${time} - ${data.count} failures (${pct}%)`);

      const sortedCats = Array.from(data.categories.entries()).sort(
        (a, b) => b[1] - a[1]
      );

      sortedCats.forEach(([cat, count]) => {
        console.log(`  - ${cat}: ${count}`);
      });
    });

    // Print Order Type Analysis
    console.log("\n\n" + "─".repeat(80));
    console.log("4. ORDER TYPE / TIME-IN-FORCE COMBINATIONS");
    console.log("─".repeat(80));

    const sortedOrderTypes = Array.from(orderTypeFailures.entries()).sort(
      (a, b) => b[1].count - a[1].count
    );

    sortedOrderTypes.forEach(([type, data]) => {
      const categories = Array.from(data.categories).join(", ");
      console.log(
        `${type.padEnd(20)} - ${data.count} failures (${categories})`
      );
    });

    // Print Recommendations
    console.log("\n\n" + "─".repeat(80));
    console.log("5. RECOMMENDATIONS");
    console.log("─".repeat(80));

    const recommendations = [];

    sortedCategories.forEach((cat) => {
      switch (cat.category) {
        case "MARKET_ORDER_EXTENDED_HOURS":
          recommendations.push({
            priority: "HIGH",
            fix: "Reject market orders during extended hours or auto-convert to limit orders",
          });
          break;
        case "INVALID_TIME_IN_FORCE":
          recommendations.push({
            priority: "HIGH",
            fix: "Validate TIF against order type before submission (e.g., market orders must be DAY, not GTC)",
          });
          break;
        case "GTC_NOT_ALLOWED":
          recommendations.push({
            priority: "HIGH",
            fix: "Auto-adjust market orders from GTC to DAY before submission",
          });
          break;
        case "INVALID_ORDER_CLASS":
          recommendations.push({
            priority: "HIGH",
            fix: "Validate bracket/OCO/OTO orders require TIF=DAY and proper price parameters",
          });
          break;
        case "INVALID_PRICE":
          recommendations.push({
            priority: "MEDIUM",
            fix: "Add price validation against current market price (min tick, reasonable spread)",
          });
          break;
        case "INVALID_QUANTITY":
          recommendations.push({
            priority: "MEDIUM",
            fix: "Validate quantity against asset fractionability and minimum order size",
          });
          break;
        case "INVALID_SYMBOL":
          recommendations.push({
            priority: "LOW",
            fix: "Pre-validate symbols against broker assets table before order submission",
          });
          break;
      }
    });

    recommendations.forEach((rec, idx) => {
      console.log(`\n[${idx + 1}] PRIORITY: ${rec.priority}`);
      console.log(`    Fix: ${rec.fix}`);
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("ANALYSIS COMPLETE");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("Error analyzing orders:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the analysis
analyzeOrderFailures()
  .then(() => {
    console.log("\nAnalysis completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nAnalysis failed:", error);
    process.exit(1);
  });
