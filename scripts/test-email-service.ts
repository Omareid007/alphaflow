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
}

main().catch(console.error);
