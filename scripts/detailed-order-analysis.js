/**
 * Detailed Alpaca Order Analysis with Raw JSON Inspection
 */

const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function detailedAnalysis() {
  console.log('='.repeat(80));
  console.log('DETAILED ORDER ANALYSIS - RAW JSON INSPECTION');
  console.log('='.repeat(80));

  try {
    // Get all failed orders with raw JSON
    const query = `
      SELECT
        id,
        broker_order_id,
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
        raw_json
      FROM orders
      WHERE status IN ('canceled', 'rejected', 'expired', 'stopped', 'suspended')
        AND submitted_at >= NOW() - INTERVAL '48 hours'
      ORDER BY submitted_at DESC
      LIMIT 20
    `;

    const result = await pool.query(query);
    const orders = result.rows;

    console.log(`\nFound ${orders.length} orders to inspect (showing first 20)\n`);

    // Inspect each order in detail
    orders.forEach((order, idx) => {
      console.log('─'.repeat(80));
      console.log(`ORDER ${idx + 1}: ${order.symbol}`);
      console.log('─'.repeat(80));
      console.log(`Status:          ${order.status}`);
      console.log(`Order ID:        ${order.broker_order_id}`);
      console.log(`Type:            ${order.type} / ${order.time_in_force}`);
      console.log(`Side:            ${order.side}`);
      console.log(`Quantity:        ${order.qty || 'N/A'}`);
      console.log(`Notional:        ${order.notional || 'N/A'}`);
      console.log(`Limit Price:     ${order.limit_price || 'N/A'}`);
      console.log(`Stop Price:      ${order.stop_price || 'N/A'}`);
      console.log(`Extended Hours:  ${order.extended_hours}`);
      console.log(`Order Class:     ${order.order_class || 'simple'}`);
      console.log(`Submitted At:    ${order.submitted_at}`);
      console.log(`Failed At:       ${order.failed_at || 'N/A'}`);
      console.log(`Canceled At:     ${order.canceled_at || 'N/A'}`);

      if (order.raw_json) {
        console.log('\nRaw JSON Fields:');
        // Pretty print key fields from raw JSON
        const keys = Object.keys(order.raw_json);
        keys.forEach(key => {
          const value = order.raw_json[key];
          if (typeof value === 'object' && value !== null) {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          } else if (value !== null && value !== undefined && value !== '') {
            console.log(`  ${key}: ${value}`);
          }
        });
      } else {
        console.log('\nNo raw JSON available');
      }
      console.log('');
    });

    // Now check for any rejected orders specifically
    console.log('\n\n' + '='.repeat(80));
    console.log('CHECKING FOR ACTUAL REJECTIONS (status = rejected)');
    console.log('='.repeat(80));

    const rejectedQuery = `
      SELECT
        COUNT(*) as total,
        status
      FROM orders
      WHERE submitted_at >= NOW() - INTERVAL '7 days'
      GROUP BY status
      ORDER BY total DESC
    `;

    const statusResult = await pool.query(rejectedQuery);
    console.log('\nOrder Status Distribution (Last 7 Days):\n');
    statusResult.rows.forEach(row => {
      console.log(`  ${row.status.padEnd(20)} - ${row.total} orders`);
    });

    // Check work items for order failures
    console.log('\n\n' + '='.repeat(80));
    console.log('CHECKING WORK ITEMS FOR ORDER SUBMISSION ERRORS');
    console.log('='.repeat(80));

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
        updated_at
      FROM work_items
      WHERE type IN ('ORDER_SUBMIT', 'ORDER_CANCEL')
        AND status IN ('FAILED', 'DEAD_LETTER')
        AND created_at >= NOW() - INTERVAL '48 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const workItemResult = await pool.query(workItemQuery);
    console.log(`\nFound ${workItemResult.rows.length} failed work items:\n`);

    workItemResult.rows.forEach((wi, idx) => {
      console.log(`[${idx + 1}] ${wi.type} - ${wi.status}`);
      console.log(`    Symbol: ${wi.symbol || 'N/A'}`);
      console.log(`    Created: ${wi.created_at}`);
      console.log(`    Error: ${wi.last_error || 'No error message'}`);
      if (wi.payload) {
        try {
          const payload = typeof wi.payload === 'string' ? JSON.parse(wi.payload) : wi.payload;
          console.log(`    Payload: ${JSON.stringify(payload, null, 2).substring(0, 200)}...`);
        } catch (e) {
          console.log(`    Payload: ${wi.payload.substring(0, 100)}...`);
        }
      }
      console.log('');
    });

    // Check for orders with error patterns in raw_json
    console.log('\n\n' + '='.repeat(80));
    console.log('CHECKING FOR ERROR PATTERNS IN RAW JSON');
    console.log('='.repeat(80));

    const errorPatternQuery = `
      SELECT
        symbol,
        status,
        type,
        time_in_force,
        extended_hours,
        order_class,
        raw_json->>'message' as error_message,
        raw_json->>'code' as error_code,
        COUNT(*) as occurrences
      FROM orders
      WHERE submitted_at >= NOW() - INTERVAL '48 hours'
        AND status IN ('canceled', 'rejected', 'expired', 'stopped', 'suspended')
        AND raw_json IS NOT NULL
      GROUP BY symbol, status, type, time_in_force, extended_hours, order_class,
               raw_json->>'message', raw_json->>'code'
      ORDER BY occurrences DESC
      LIMIT 10
    `;

    const errorPatternResult = await pool.query(errorPatternQuery);
    console.log(`\nTop Error Patterns:\n`);

    if (errorPatternResult.rows.length > 0) {
      errorPatternResult.rows.forEach((row, idx) => {
        console.log(`[${idx + 1}] ${row.occurrences} occurrences`);
        console.log(`    Symbol: ${row.symbol}`);
        console.log(`    Status: ${row.status}`);
        console.log(`    Order Type: ${row.type}/${row.time_in_force}`);
        console.log(`    Extended Hours: ${row.extended_hours}`);
        console.log(`    Order Class: ${row.order_class || 'simple'}`);
        console.log(`    Error Code: ${row.error_code || 'N/A'}`);
        console.log(`    Error Message: ${row.error_message || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('No error patterns found in raw JSON');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

detailedAnalysis()
  .then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));
    process.exit(0);
  })
  .catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
