# Doc Assistant

> **Purpose**  
> AI-powered documentation helper for developers working on AI Active Trader.
> This is a **DEV-ONLY** tool that reads from docs/*.md files and provides answers.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Setup](#2-setup)
3. [Usage](#3-usage)
4. [Examples](#4-examples)
5. [Limitations](#5-limitations)
6. [Architecture](#6-architecture)

---

## 1. Overview

The Doc Assistant is a command-line tool that uses AI to answer questions about the AI Active Trader system by reading and analyzing the documentation files.

**Key Features:**
- Answers questions about architecture, metrics, testing, and workflows
- Cites source documents and sections
- Uses safe, read-only tools that only access docs/*.md files
- Supports multiple LLM providers (OpenAI, OpenRouter)

**Safety Guarantees:**
- NEVER modifies any system state
- NEVER accesses runtime data or live systems
- NEVER places orders or changes configuration
- ONLY reads from docs/*.md files

---

## 2. Setup

### 2.1 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes* | OpenAI API key for primary provider |
| `AI_PROVIDER` | No | Set to `openrouter` to use OpenRouter instead |
| `OPENROUTER_API_KEY` | If OpenRouter | OpenRouter API key |
| `OPENAI_MODEL` | No | Override default model (default: gpt-4o-mini) |
| `OPENROUTER_MODEL` | No | Override OpenRouter model |

*Either `OPENAI_API_KEY` or `OPENROUTER_API_KEY` must be set.

### 2.2 Verify Setup

Check your LLM provider status:

```bash
npm run docs:ask --status
```

Expected output:
```
LLM Provider Status:
  Provider: openai
  Available: true
  OpenAI Available: true
  OpenRouter Available: false
```

---

## 3. Usage

### 3.1 Basic Usage

```bash
npx tsx tools/doc_assistant/index.ts "your question here"
```

### 3.2 Available Commands

| Command | Description |
|---------|-------------|
| `npx tsx tools/doc_assistant/index.ts "question"` | Ask a question about the docs |
| `npx tsx tools/doc_assistant/index.ts --help` | Show help message |
| `npx tsx tools/doc_assistant/index.ts --status` | Show LLM provider status |
| `npx tsx tools/doc_assistant/index.ts --list-docs` | List available documentation files |

---

## 4. Examples

### 4.1 Metrics Questions

```bash
npx tsx tools/doc_assistant/index.ts "How is Total P&L calculated and mapped to the dashboard?"
```

Output includes:
- Formula from FINANCIAL_METRICS.md
- UI widget mapping
- Related metric definitions

### 4.2 Architecture Questions

```bash
npx tsx tools/doc_assistant/index.ts "What is the orchestrator cycle and how does it work?"
```

Output includes:
- Cycle flow description
- State management details
- Integration points

### 4.3 Lessons Learned

```bash
npx tsx tools/doc_assistant/index.ts "What lessons learned apply to connector development?"
```

Output includes:
- Best practices for connectors
- Common pitfalls to avoid
- Reference to LESSONS_LEARNED.md

### 4.4 Testing Questions

```bash
npx tsx tools/doc_assistant/index.ts "How do I test the trading flow end-to-end?"
```

Output includes:
- Test categories and commands
- Manual test scenarios
- Reference to TESTING.md

---

## 5. Limitations

### 5.1 Scope Limitations

| What It CAN Do | What It CANNOT Do |
|----------------|-------------------|
| Read docs/*.md files | Access runtime data |
| Answer documentation questions | Execute trades |
| Cite sources | Modify configuration |
| Explain architecture | Access secrets or PII |

### 5.2 Accuracy Notes

- Answers are AI-generated and **may contain errors**
- Always verify by reading the referenced documentation files
- The tool only knows what's in the docs - it doesn't see code
- Complex multi-step questions may require multiple runs

### 5.3 Not For Production

This tool is:
- **DEV-ONLY** - not exposed via API or UI
- **Advisory** - answers require human verification
- **Read-only** - cannot modify any system state

---

## 6. Architecture

### 6.1 Components

| Component | Location | Purpose |
|-----------|----------|---------|
| CLI Entry | `tools/doc_assistant/index.ts` | Command-line interface |
| Core Logic | `server/ai/docAssistantCore.ts` | Question processing |
| Safe Tools | `server/ai/tools.ts` | Read-only doc access |
| LLM Client | `server/ai/llmClient.ts` | Provider abstraction |
| OpenAI Client | `server/ai/openaiClient.ts` | OpenAI implementation |
| OpenRouter Client | `server/ai/openrouterClient.ts` | OpenRouter implementation |

### 6.2 Flow

```
User Question
     │
     ▼
┌─────────────┐
│   CLI       │ (tools/doc_assistant/index.ts)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Core       │ (server/ai/docAssistantCore.ts)
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  LLM Call   │────▶│ Safe Tools  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       │                   ▼
       │           ┌─────────────┐
       │           │ docs/*.md   │
       │           └─────────────┘
       ▼
┌─────────────┐
│   Answer    │ + References
└─────────────┘
```

### 6.3 Safe Tools

The following tools are available for the AI to use:

| Tool | Purpose |
|------|---------|
| `getMetricDefinition` | Get metric formula from FINANCIAL_METRICS.md |
| `getArchitectureSection` | Get architecture details |
| `getLessonsLearned` | Get lessons for a specific area |
| `getTestingGuidance` | Get testing guidance for a flow |
| `getDocSection` | Read any section from any doc file |

All tools are **read-only** and **safe** - they only read from docs/*.md files.

---

## Related Documentation

| Document | Relevance |
|----------|-----------|
| `AI_MODELS_AND_PROVIDERS.md` | LLM client architecture |
| `AGENT_EXECUTION_GUIDE.md` | Development workflow |
| `FINANCIAL_METRICS.md` | Metric definitions |
| `TESTING.md` | Testing guidance |

---

*Last Updated: December 2024*
