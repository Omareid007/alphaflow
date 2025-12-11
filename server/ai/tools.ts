/**
 * Safe AI Tools - Read-only documentation helpers
 * 
 * These tools are SAFE and READ-ONLY. They:
 * - Only read from docs/*.md files
 * - Never place orders or modify data
 * - Never access secrets or PII
 * 
 * @see docs/DOC_ASSISTANT.md for usage
 * @see docs/AGENT_EXECUTION_GUIDE.md Section 14 for governance
 */

import * as fs from "fs";
import * as path from "path";
import { LLMTool, LLMToolCall } from "./llmClient";

const DOCS_DIR = path.join(process.cwd(), "docs");

export const safeTools: LLMTool[] = [
  {
    type: "function",
    function: {
      name: "getMetricDefinition",
      description: "Get the definition, formula, and UI mapping for a financial metric from FINANCIAL_METRICS.md",
      parameters: {
        type: "object",
        properties: {
          metricName: {
            type: "string",
            description: "The name of the metric (e.g., 'Total P&L', 'Unrealized P&L', 'Win Rate')",
          },
        },
        required: ["metricName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getArchitectureSection",
      description: "Get a specific section from ARCHITECTURE.md or ORCHESTRATOR_AND_AGENT_RUNTIME.md",
      parameters: {
        type: "object",
        properties: {
          sectionName: {
            type: "string",
            description: "The section heading or topic to find (e.g., 'orchestrator cycle', 'connectors', 'safety rails')",
          },
        },
        required: ["sectionName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getLessonsLearned",
      description: "Get relevant lessons learned for a specific area from LESSONS_LEARNED.md",
      parameters: {
        type: "object",
        properties: {
          area: {
            type: "string",
            description: "The area to get lessons for",
            enum: [
              "ai_models",
              "connectors",
              "orchestrator",
              "agent_orchestration",
              "metrics",
              "testing",
              "ui",
              "infra",
            ],
          },
        },
        required: ["area"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTestingGuidance",
      description: "Get testing guidance for a specific flow or component from TESTING.md",
      parameters: {
        type: "object",
        properties: {
          flow: {
            type: "string",
            description: "The flow or component to get testing guidance for (e.g., 'trades', 'positions', 'orchestrator')",
          },
        },
        required: ["flow"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getDocSection",
      description: "Read a specific section from any documentation file",
      parameters: {
        type: "object",
        properties: {
          docFile: {
            type: "string",
            description: "The documentation file name (e.g., 'APP_OVERVIEW.md', 'CONNECTORS_AND_INTEGRATIONS.md')",
          },
          sectionHeading: {
            type: "string",
            description: "The section heading to find (optional, returns full doc if not specified)",
          },
        },
        required: ["docFile"],
      },
    },
  },
];

function safeReadDoc(filename: string): string | null {
  try {
    const filePath = path.join(DOCS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function extractSection(content: string, sectionName: string): string | null {
  const lines = content.split("\n");
  const sectionLower = sectionName.toLowerCase();
  
  let inSection = false;
  let sectionLevel = 0;
  const sectionLines: string[] = [];
  
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading = headingMatch[2].toLowerCase();
      
      if (heading.includes(sectionLower)) {
        inSection = true;
        sectionLevel = level;
        sectionLines.push(line);
        continue;
      }
      
      if (inSection && level <= sectionLevel) {
        break;
      }
    }
    
    if (inSection) {
      sectionLines.push(line);
    }
  }
  
  if (sectionLines.length > 0) {
    return sectionLines.join("\n").trim();
  }
  
  return null;
}

export interface ToolResult {
  name: string;
  result: {
    success: boolean;
    content?: string;
    reference?: string;
    error?: string;
  };
}

export async function executeToolCall(toolCall: LLMToolCall): Promise<ToolResult> {
  const { name, arguments: args } = toolCall;
  
  switch (name) {
    case "getMetricDefinition": {
      const metricName = args.metricName as string;
      const content = safeReadDoc("FINANCIAL_METRICS.md");
      
      if (!content) {
        return {
          name,
          result: { success: false, error: "FINANCIAL_METRICS.md not found" },
        };
      }
      
      const section = extractSection(content, metricName);
      if (section) {
        return {
          name,
          result: {
            success: true,
            content: section,
            reference: `docs/FINANCIAL_METRICS.md - ${metricName}`,
          },
        };
      }
      
      const metricLower = metricName.toLowerCase();
      const lines = content.split("\n");
      const relevantLines: string[] = [];
      let contextStart = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(metricLower)) {
          contextStart = Math.max(0, i - 2);
          for (let j = contextStart; j < Math.min(lines.length, i + 10); j++) {
            relevantLines.push(lines[j]);
          }
          break;
        }
      }
      
      if (relevantLines.length > 0) {
        return {
          name,
          result: {
            success: true,
            content: relevantLines.join("\n"),
            reference: `docs/FINANCIAL_METRICS.md - search for "${metricName}"`,
          },
        };
      }
      
      return {
        name,
        result: { success: false, error: `Metric "${metricName}" not found in documentation` },
      };
    }
    
    case "getArchitectureSection": {
      const sectionName = args.sectionName as string;
      
      const archContent = safeReadDoc("ARCHITECTURE.md");
      const orchContent = safeReadDoc("ORCHESTRATOR_AND_AGENT_RUNTIME.md");
      
      let section = archContent ? extractSection(archContent, sectionName) : null;
      let reference = "docs/ARCHITECTURE.md";
      
      if (!section && orchContent) {
        section = extractSection(orchContent, sectionName);
        reference = "docs/ORCHESTRATOR_AND_AGENT_RUNTIME.md";
      }
      
      if (section) {
        return {
          name,
          result: {
            success: true,
            content: section,
            reference: `${reference} - ${sectionName}`,
          },
        };
      }
      
      return {
        name,
        result: { success: false, error: `Section "${sectionName}" not found in architecture docs` },
      };
    }
    
    case "getLessonsLearned": {
      const area = args.area as string;
      const content = safeReadDoc("LESSONS_LEARNED.md");
      
      if (!content) {
        return {
          name,
          result: { success: false, error: "LESSONS_LEARNED.md not found" },
        };
      }
      
      const areaMapping: Record<string, string> = {
        ai_models: "AI Models & Prompting",
        connectors: "Connector & External API",
        orchestrator: "Orchestrator & Agent Runtime",
        agent_orchestration: "Development-Time Agent Orchestration",
        metrics: "Domain-Specific",
        testing: "Testing & QA",
        ui: "Implementation",
        infra: "DevOps",
      };
      
      const sectionName = areaMapping[area] || area;
      const section = extractSection(content, sectionName);
      
      if (section) {
        return {
          name,
          result: {
            success: true,
            content: section,
            reference: `docs/LESSONS_LEARNED.md - ${sectionName}`,
          },
        };
      }
      
      return {
        name,
        result: { success: false, error: `No lessons found for area "${area}"` },
      };
    }
    
    case "getTestingGuidance": {
      const flow = args.flow as string;
      const content = safeReadDoc("TESTING.md");
      
      if (!content) {
        return {
          name,
          result: { success: false, error: "TESTING.md not found" },
        };
      }
      
      const section = extractSection(content, flow);
      if (section) {
        return {
          name,
          result: {
            success: true,
            content: section,
            reference: `docs/TESTING.md - ${flow}`,
          },
        };
      }
      
      const flowLower = flow.toLowerCase();
      const lines = content.split("\n");
      const relevantLines: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(flowLower)) {
          const start = Math.max(0, i - 2);
          const end = Math.min(lines.length, i + 10);
          for (let j = start; j < end; j++) {
            relevantLines.push(lines[j]);
          }
          relevantLines.push("---");
        }
      }
      
      if (relevantLines.length > 0) {
        return {
          name,
          result: {
            success: true,
            content: relevantLines.join("\n"),
            reference: `docs/TESTING.md - search for "${flow}"`,
          },
        };
      }
      
      return {
        name,
        result: { success: false, error: `No testing guidance found for "${flow}"` },
      };
    }
    
    case "getDocSection": {
      const docFile = args.docFile as string;
      const sectionHeading = args.sectionHeading as string | undefined;
      
      const content = safeReadDoc(docFile);
      
      if (!content) {
        return {
          name,
          result: { success: false, error: `Document "${docFile}" not found` },
        };
      }
      
      if (sectionHeading) {
        const section = extractSection(content, sectionHeading);
        if (section) {
          return {
            name,
            result: {
              success: true,
              content: section,
              reference: `docs/${docFile} - ${sectionHeading}`,
            },
          };
        }
        return {
          name,
          result: { success: false, error: `Section "${sectionHeading}" not found in ${docFile}` },
        };
      }
      
      const truncated = content.length > 5000 ? content.substring(0, 5000) + "\n\n[TRUNCATED - document continues...]" : content;
      return {
        name,
        result: {
          success: true,
          content: truncated,
          reference: `docs/${docFile}`,
        },
      };
    }
    
    default:
      return {
        name,
        result: { success: false, error: `Unknown tool: ${name}` },
      };
  }
}

export function getToolNames(): string[] {
  return safeTools.map(t => t.function.name);
}
