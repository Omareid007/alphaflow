/**
 * Doc Assistant Core - AI-powered documentation helper
 * 
 * This module provides AI-assisted answers to questions about the system
 * using ONLY the safe, read-only tools that access docs/*.md files.
 * 
 * SAFETY: This is PURELY read-only and must NEVER:
 * - Call trading or connector code
 * - Modify any system state
 * - Access secrets or PII
 * 
 * @see docs/DOC_ASSISTANT.md for usage
 * @see docs/AGENT_EXECUTION_GUIDE.md Section 14 for governance
 */

import { llm, LLMRequest, LLMMessage, LLMResponse } from "./index";
import { safeTools, executeToolCall, ToolResult } from "./tools";

const SYSTEM_PROMPT = `You are a documentation and architecture assistant for the AI Active Trader application.

Your role is to answer questions by using ONLY the safe tools provided to read from docs/*.md files.

RULES:
1. You ONLY answer questions using information from the documentation files
2. You do NOT execute trades, modify data, or access any runtime systems
3. You do NOT make up information - if a tool returns no results, say so
4. You ALWAYS cite the source document and section in your answers
5. If asked about something not in the docs, suggest what docs might help

AVAILABLE DOCUMENTATION:
- APP_OVERVIEW.md - System overview and features
- ARCHITECTURE.md - Technical architecture
- FINANCIAL_METRICS.md - P&L formulas and metric definitions
- TESTING.md - Testing strategy and commands
- OBSERVABILITY.md - Logging and monitoring
- LESSONS_LEARNED.md - Best practices and lessons
- AGENT_EXECUTION_GUIDE.md - Development workflow and governance
- AI_MODELS_AND_PROVIDERS.md - AI integration patterns
- CONNECTORS_AND_INTEGRATIONS.md - External API integrations
- ORCHESTRATOR_AND_AGENT_RUNTIME.md - Trading orchestrator details

Be concise and cite your sources. If you need to use multiple tools to answer, do so.`;

interface DocAssistantResult {
  answer: string;
  references: string[];
  toolsUsed: string[];
  tokensUsed?: number;
}

export async function askDocAssistant(question: string): Promise<DocAssistantResult> {
  const messages: LLMMessage[] = [
    { role: "user", content: question },
  ];
  
  const references: string[] = [];
  const toolsUsed: string[] = [];
  let totalTokens = 0;
  
  const maxIterations = 5;
  let iterations = 0;
  
  while (iterations < maxIterations) {
    iterations++;
    
    const request: LLMRequest = {
      system: SYSTEM_PROMPT,
      messages,
      tools: safeTools,
      toolChoice: "auto",
      maxTokens: 1500,
      temperature: 0.2,
    };
    
    let response: LLMResponse;
    try {
      response = await llm.call(request);
    } catch (error) {
      return {
        answer: `Error calling AI: ${String(error)}. Please check your API configuration.`,
        references: [],
        toolsUsed: [],
      };
    }
    
    if (response.tokensUsed) {
      totalTokens += response.tokensUsed;
    }
    
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return {
        answer: response.text || "I couldn't find an answer to your question.",
        references,
        toolsUsed,
        tokensUsed: totalTokens,
      };
    }
    
    messages.push({
      role: "assistant",
      content: response.text || "",
    });
    
    for (const toolCall of response.toolCalls) {
      toolsUsed.push(toolCall.name);
      
      const result: ToolResult = await executeToolCall(toolCall);
      
      if (result.result.success && result.result.reference) {
        references.push(result.result.reference);
      }
      
      messages.push({
        role: "tool",
        content: JSON.stringify(result.result),
        tool_call_id: toolCall.id,
        name: toolCall.name,
      });
    }
  }
  
  return {
    answer: "I reached the maximum number of tool calls without finding a complete answer. Please try a more specific question.",
    references,
    toolsUsed,
    tokensUsed: totalTokens,
  };
}

export async function listAvailableDocs(): Promise<string[]> {
  const fs = await import("fs");
  const path = await import("path");
  
  const docsDir = path.join(process.cwd(), "docs");
  
  try {
    const files = fs.readdirSync(docsDir);
    return files.filter(f => f.endsWith(".md"));
  } catch {
    return [];
  }
}
