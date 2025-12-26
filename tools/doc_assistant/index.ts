#!/usr/bin/env tsx
/**
 * Doc Assistant CLI - Dev-only documentation Q&A tool
 * 
 * Usage:
 *   npm run docs:ask "How is Total P&L calculated?"
 *   npx tsx tools/doc_assistant/index.ts "What is the orchestrator cycle?"
 * 
 * SAFETY: This is DEV-ONLY and reads ONLY from docs/*.md files.
 * It does NOT modify any system state or access runtime data.
 * 
 * @see docs/DOC_ASSISTANT.md for full documentation
 */

import { askDocAssistant, listAvailableDocs } from "../../server/ai/docAssistantCore";
import { getLLMStatus } from "../../server/ai/index";

const HELP_TEXT = `
Doc Assistant - AI-powered documentation helper

Usage:
  npm run docs:ask "your question here"
  npx tsx tools/doc_assistant/index.ts "your question here"

Examples:
  npm run docs:ask "How is Total P&L calculated and mapped to the dashboard?"
  npm run docs:ask "What are the safety rails in the orchestrator?"
  npm run docs:ask "What lessons learned apply to connectors?"
  npm run docs:ask "How do I test the trading flow?"

Options:
  --help, -h     Show this help message
  --status       Show LLM provider status
  --list-docs    List available documentation files

Environment:
  OPENAI_API_KEY      Required for OpenAI provider
  AI_PROVIDER         Set to "openrouter" to use OpenRouter instead
  OPENROUTER_API_KEY  Required if AI_PROVIDER=openrouter

Note: This is a DEV-ONLY tool. It reads ONLY from docs/*.md files
and does NOT modify any system state or access runtime data.
`;

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  
  if (args.includes("--status")) {
    const status = getLLMStatus();
    console.log("\nLLM Provider Status:");
    console.log(`  Provider: ${status.provider}`);
    console.log(`  Available: ${status.available}`);
    console.log(`  OpenAI Available: ${status.providers.openai}`);
    console.log(`  OpenRouter Available: ${status.providers.openrouter}`);
    process.exit(0);
  }
  
  if (args.includes("--list-docs")) {
    const docs = await listAvailableDocs();
    console.log("\nAvailable Documentation:");
    docs.forEach(doc => console.log(`  - ${doc}`));
    process.exit(0);
  }
  
  const question = args.join(" ").trim();
  
  if (!question) {
    console.error("Error: Please provide a question.");
    console.log('Usage: npm run docs:ask "your question here"');
    process.exit(1);
  }
  
  const status = getLLMStatus();
  if (!status.available) {
    console.error("\nError: No LLM provider available.");
    console.error("Please set OPENAI_API_KEY or configure OpenRouter.");
    console.log("\nRun 'npm run docs:ask --status' to check provider status.");
    process.exit(1);
  }
  
  console.log(`\nUsing LLM provider: ${status.provider}`);
  console.log(`\nQuestion: ${question}\n`);
  console.log("Searching documentation...\n");
  
  try {
    const result = await askDocAssistant(question);
    
    console.log("─".repeat(60));
    console.log("\nAnswer:\n");
    console.log(result.answer);
    
    if (result.references.length > 0) {
      console.log("\n─".repeat(60));
      console.log("\nReferences:");
      const uniqueRefs = [...new Set(result.references)];
      uniqueRefs.forEach(ref => console.log(`  - ${ref}`));
    }
    
    if (result.toolsUsed.length > 0) {
      console.log("\n─".repeat(60));
      console.log("\nTools used:");
      const toolCounts = result.toolsUsed.reduce((acc, tool) => {
        acc[tool] = (acc[tool] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      Object.entries(toolCounts).forEach(([tool, count]) => {
        console.log(`  - ${tool}: ${count} call(s)`);
      });
    }
    
    if (result.tokensUsed) {
      console.log(`\nTokens used: ${result.tokensUsed}`);
    }
    
    console.log("\n" + "─".repeat(60));
    console.log("\nNote: This is AI-generated. Always verify by reading the referenced files.");
    
  } catch (error) {
    console.error("\nError:", String(error));
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
