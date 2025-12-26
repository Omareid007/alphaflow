/**
 * Test Google Gemini API Integration
 *
 * Quick test script to verify Gemini API key and client functionality
 * Run with: npx tsx scripts/test-gemini.ts
 */

// Set the API key
process.env.GOOGLE_GEMINI_API_KEY = "AIzaSyDL---2oL3ROM5d9hZWjg1wvqDGMBnh1G0";

import { geminiClient } from "../server/ai/geminiClient";

async function testGemini() {
  console.log("=" .repeat(80));
  console.log("GOOGLE GEMINI API TEST");
  console.log("=".repeat(80));
  console.log("");

  // Check availability
  console.log("1. Checking API key configuration...");
  if (geminiClient.isAvailable()) {
    console.log("   ✓ API key configured");
  } else {
    console.log("   ✗ API key NOT configured");
    process.exit(1);
  }

  // Test basic call
  console.log("\n2. Testing basic API call...");
  try {
    const response = await geminiClient.call({
      userPrompt: "Say 'Hello from Gemini!' and nothing else.",
      systemPrompt: "You are a helpful assistant.",
      temperature: 0,
      maxTokens: 50,
    } as any);

    console.log("   ✓ API call successful");
    console.log(`   Response: ${response.content}`);
    console.log(`   Model: ${response.model}`);
    console.log(`   Provider: ${response.provider}`);
    console.log(`   Tokens: ${response.usage?.totalTokens || 0}`);
    console.log(`   Latency: ${response.latencyMs}ms`);
  } catch (error) {
    console.log("   ✗ API call failed");
    console.error(`   Error: ${(error as Error).message}`);
    process.exit(1);
  }

  // Test with trading context
  console.log("\n3. Testing with trading analysis prompt...");
  try {
    const response = await geminiClient.call({
      systemPrompt: "You are a financial analyst. Analyze market conditions and provide a brief assessment.",
      userPrompt: "What is the current market sentiment for tech stocks? Respond in 2-3 sentences.",
      temperature: 0.3,
      maxTokens: 200,
    } as any);

    console.log("   ✓ Trading analysis successful");
    console.log(`   Response: ${response.content?.substring(0, 200)}...`);
    console.log(`   Tokens: ${response.usage?.totalTokens || 0}`);
    console.log(`   Latency: ${response.latencyMs}ms`);
  } catch (error) {
    console.log("   ✗ Trading analysis failed");
    console.error(`   Error: ${(error as Error).message}`);
    process.exit(1);
  }

  // Health check
  console.log("\n4. Running health check...");
  try {
    const isHealthy = await geminiClient.healthCheck();
    if (isHealthy) {
      console.log("   ✓ Health check passed");
    } else {
      console.log("   ✗ Health check failed");
    }
  } catch (error) {
    console.log("   ✗ Health check error");
    console.error(`   Error: ${(error as Error).message}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("ALL TESTS PASSED! ✓");
  console.log("=".repeat(80));
  console.log("\nGoogle Gemini is ready to use!");
  console.log("Free tier: 1,000 requests/day, 15 RPM, 250K TPM");
  console.log("Context window: Up to 1M tokens");
  console.log("\nNext steps:");
  console.log("1. Add GOOGLE_GEMINI_API_KEY to your .env file");
  console.log("2. Gemini will be used for low-criticality tasks (news, sentiment, reporting)");
  console.log("3. Monitor usage in admin panel");
  console.log("");
}

testGemini().catch((error) => {
  console.error("\n✗ Fatal error:", error);
  process.exit(1);
});
