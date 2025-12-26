/**
 * Test LLM fallback system and provider availability
 */

import { log } from "../server/utils/logger";

async function testProviders() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           LLM PROVIDER AVAILABILITY TEST                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Check environment variables
  const envKeys = [
    "AI_INTEGRATIONS_OPENAI_API_KEY",
    "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
    "AI_INTEGRATIONS_OPENROUTER_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "CLAUDE_API_KEY",
    "ANTHROPIC_API_KEY",
    "GROQ_API_KEY",
    "TOGETHER_API_KEY",
    "AIMLAPI_KEY",
  ];

  console.log("=== Environment Variables ===\n");
  for (const key of envKeys) {
    const value = process.env[key];
    const status = value ? "✓ SET" : "✗ NOT SET";
    console.log(`  ${status.padEnd(12)} ${key}`);
  }

  // Test provider clients
  console.log("\n=== Provider Availability ===\n");

  try {
    const { openaiClient } = await import("../server/ai/openaiClient");
    console.log(`  OpenAI:      ${openaiClient.isAvailable() ? "✓ Available" : "✗ Not Available"}`);
  } catch (e) {
    console.log(`  OpenAI:      ✗ Import Error: ${e}`);
  }

  try {
    const { claudeClient } = await import("../server/ai/claudeClient");
    console.log(`  Claude:      ${claudeClient.isAvailable() ? "✓ Available" : "✗ Not Available"}`);
  } catch (e) {
    console.log(`  Claude:      ✗ Import Error: ${e}`);
  }

  try {
    const { openrouterClient } = await import("../server/ai/openrouterClient");
    console.log(`  OpenRouter:  ${openrouterClient.isAvailable() ? "✓ Available" : "✗ Not Available"}`);
  } catch (e) {
    console.log(`  OpenRouter:  ✗ Import Error: ${e}`);
  }

  try {
    const { groqClient } = await import("../server/ai/groqClient");
    console.log(`  Groq:        ${groqClient.isAvailable() ? "✓ Available" : "✗ Not Available"}`);
  } catch (e) {
    console.log(`  Groq:        ✗ Import Error: ${e}`);
  }

  try {
    const { togetherClient } = await import("../server/ai/togetherClient");
    console.log(`  Together:    ${togetherClient.isAvailable() ? "✓ Available" : "✗ Not Available"}`);
  } catch (e) {
    console.log(`  Together:    ✗ Import Error: ${e}`);
  }

  try {
    const { aimlClient } = await import("../server/ai/aimlClient");
    console.log(`  AIML API:    ${aimlClient.isAvailable() ? "✓ Available" : "✗ Not Available"}`);
  } catch (e) {
    console.log(`  AIML API:    ✗ Import Error: ${e}`);
  }

  // Test a simple LLM call through the gateway
  console.log("\n=== Testing LLM Gateway ===\n");

  try {
    const { callLLM, generateTraceId } = await import("../server/ai/llmGateway");

    console.log("  Sending test request to LLM Gateway...");

    const response = await callLLM({
      role: "market_news_summarizer",
      criticality: "low",
      purpose: "Test fallback system",
      traceId: generateTraceId(),
      messages: [
        { role: "user", content: "Say 'test successful' in 3 words or less." }
      ],
      maxTokens: 20,
      temperature: 0.1,
    });

    console.log(`\n  ✓ Response received!`);
    console.log(`    Provider: ${response.provider}`);
    console.log(`    Model: ${response.model}`);
    console.log(`    Text: ${response.text?.slice(0, 50)}...`);
    console.log(`    Fallback Used: ${response.fallbackUsed}`);
    if (response.fallbackReason) {
      console.log(`    Fallback Reason: ${response.fallbackReason}`);
    }
    console.log(`    Latency: ${response.latencyMs}ms`);
    console.log(`    Estimated Cost: $${response.estimatedCost.toFixed(6)}`);

  } catch (error) {
    console.log(`\n  ✗ LLM Gateway Error: ${(error as Error).message}`);
  }

  console.log("\n" + "═".repeat(60) + "\n");
}

testProviders().catch(console.error);
