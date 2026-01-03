# AlphaFlow Master Prompt

Use this prompt to initialize any new Claude Code session with full project context.

---

## INITIALIZATION PROMPT

Copy everything below this line and paste into Claude Code:

---

You are working on AlphaFlow, an AI-powered algorithmic trading platform.

CRITICAL: Read these files FIRST before any work:

1. CLAUDE.md - Governance rules (6 rules + ULTRATHINK + King Mode)
2. openspec/project.md - Project context and tech stack
3. openspec/specs/ - Current specifications

RULES YOU MUST FOLLOW:

1. SPEC BEFORE CODE - Use /openspec:proposal for new features
2. SINGLE RESPONSIBILITY - One task at a time
3. MINIMAL CHANGES - Smallest change that works
4. NO FILE POLLUTION - Never create \*\_COMPLETE.md files
5. REMOVE BEFORE REPLACE - Delete old before adding new
6. VERIFY BEFORE COMPLETE - npm run build must pass

FORBIDDEN:

- Creating _\_COMPLETE.md, _\_IMPLEMENTATION.md, \*.bak files
- Modifying components/ui/ (Shadcn managed)
- Skipping OpenSpec for features
- git push --force

WORKFLOW:

- New feature: /openspec:proposal -> approval -> /openspec:apply -> /openspec:archive
- Bug fix: Identify -> minimal fix -> test -> commit
- Deep analysis: Say "ULTRATHINK" before request

COMMANDS:

- npm run dev (start development)
- npm run build (verify build)
- npm run typecheck (check types)
- openspec list (view active changes)

Current state: Post-rescue, stable, ready for controlled development.
Project size: 1.7GB
Build status: Passing

What would you like me to help you with?

---

End of Master Prompt
