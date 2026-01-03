/**
 * Test Email Service with Brevo Provider
 *
 * Usage: npx tsx scripts/test-email-service.ts
 */

import dotenv from "dotenv";
dotenv.config();

import {
  isEmailConfigured,
  getEmailServiceStatus,
  sendEmail,
} from "../server/lib/email-service";
import {
  sendOrderFilledEmail,
  sendLossAlertEmail,
  sendCircuitBreakerEmail,
} from "../server/lib/notification-service";

async function main() {
  console.log("=== Email Service Test ===\n");

  // Check configuration
  const status = getEmailServiceStatus();
  console.log("Email Service Status:");
  console.log(JSON.stringify(status, null, 2));
  console.log();

  if (!isEmailConfigured()) {
    console.error("ERROR: No email provider configured!");
    console.log("Set BREVO_API_KEY or SENDGRID_API_KEY in .env");
    process.exit(1);
  }

  console.log(`Active provider: ${status.activeProvider}`);
  console.log();

  // Test email
  const testEmail = process.argv[2] || "test@example.com";
  console.log(`Sending test email to: ${testEmail}`);
  console.log();

  const result = await sendEmail({
    to: testEmail,
    from: "noreply@alphaflow.app",
    subject: "AlphaFlow - Email Service Test",
    text: "This is a test email from AlphaFlow trading platform. If you received this, the email service is working correctly!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #22c55e;">AlphaFlow Email Service Test</h2>
        <p>This is a test email from AlphaFlow trading platform.</p>
        <p style="color: #22c55e; font-weight: bold;">If you received this, the email service is working correctly!</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          Provider: ${status.activeProvider}<br>
          Sent: ${new Date().toISOString()}
        </p>
      </div>
    `,
  });

  console.log("Result:");
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log("\n✅ Email sent successfully!");
  } else {
    console.log("\n❌ Email failed to send");
    process.exit(1);
  }

  // Test template integration
  console.log("\n=== Testing Email Templates ===\n");

  // Test 1: Order Filled Email
  console.log("1. Testing Order Filled Email...");
  await sendOrderFilledEmail(testEmail, {
    symbol: "AAPL",
    side: "buy",
    qty: 10,
    price: 175.5,
    totalValue: 1755.0,
    timestamp: new Date(),
  });
  console.log("   ✅ Order filled email sent\n");

  // Test 2: Large Loss Alert Email
  console.log("2. Testing Large Loss Alert Email...");
  await sendLossAlertEmail(testEmail, {
    symbol: "TSLA",
    unrealizedPL: -250.0,
    percentLoss: -7.5,
    currentPrice: 245.0,
    avgEntryPrice: 265.0,
  });
  console.log("   ✅ Loss alert email sent\n");

  // Test 3: Circuit Breaker Email
  console.log("3. Testing Circuit Breaker Email...");
  await sendCircuitBreakerEmail(testEmail, {
    reason: "Portfolio loss exceeded 10% threshold",
    triggeredAt: new Date(),
    estimatedRecovery: new Date(Date.now() + 3600000), // 1 hour from now
  });
  console.log("   ✅ Circuit breaker email sent\n");

  console.log("=== All Template Tests Complete ===");
  console.log("\nCheck your inbox at:", testEmail);
  console.log("You should have received 4 emails:");
  console.log("  1. Basic test email");
  console.log("  2. Order filled notification (AAPL purchase)");
  console.log("  3. Large loss alert (TSLA position)");
  console.log("  4. Circuit breaker alert");
}

main().catch(console.error);
