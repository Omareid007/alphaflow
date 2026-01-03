# AlphaFlow Rescue Diagnostic Report
Generated: 2026-01-03 15:20 UTC
Initial Size: 2.4GB
Target Size: <200MB

## Executive Summary
- Total Project Size: **2.4GB**
- Health Status: **CRITICAL**
- Primary Issue: **Bloated build caches and git repository (1.9GB combined)**

**Top 3 Space Consumers:**
1. node_modules: 885M (expected, in .gitignore)
2. .next build cache: 784M (should not be this large)
3. .git repository: 369M (massive git pack files)

## 1. Size Analysis

### Largest Directories (Top 20)
| Folder | Size | In Git? | Action Needed |
|--------|------|---------|---------------|
| node_modules/ | 885M | NO (in .gitignore) | KEEP - normal size |
| .next/ | 784M | NO (in .gitignore) | **REMOVE - excessive cache** |
| .git/ | 369M | N/A | **OPTIMIZE - pack too large** |
| mcp-servers/ | 59M | YES | REVIEW - may contain node_modules |
| docs/ | 4.6M | YES | CLEAN - remove clutter files |
| server/ | 3.5M | YES | KEEP - source code |
| server_dist/ | 1.9M | NO (in .gitignore) | REMOVE - build artifact |
| scripts/ | 1.4M | YES | KEEP - source code |
| app/ | 828K | YES | KEEP - source code |
| archive/ | 812K | YES | REVIEW - may be obsolete |
| components/ | 648K | YES | KEEP - source code |
| analysis/ | 516K | YES | REVIEW - may contain old reports |
| tests/ | 468K | YES | KEEP - source code |
| assets/ | 416K | YES | KEEP - project assets |
| lib/ | 404K | YES | KEEP - source code |
| openspec/ | 356K | YES | KEEP - specifications |
| shared/ | 340K | YES | KEEP - source code |
| migrations/ | 308K | YES | KEEP - database migrations |
| contracts/ | 64K | YES | KEEP - project files |
| specs/ | 56K | YES | KEEP - specifications |

### .next Directory Breakdown
| Subdirectory | Size | Issue |
|--------------|------|-------|
| .next/cache/ | 716M | **39 webpack pack files - excessive** |
| .next/standalone/ | 60M | Standalone build output |
| .next/server/ | 4.9M | Server build |
| .next/static/ | 3.0M | Static assets |

### .git Directory Breakdown
| Component | Size | Issue |
|-----------|------|-------|
| .git/objects/ | 369M | **Single pack file is 325M** |
| .git/logs/ | 532K | Normal |
| .git/hooks/ | 64K | Normal |

**Git Statistics:**
- Loose objects: 455 (43.37 MiB)
- Packed objects: 9,486 in 1 pack
- Pack size: **324.49 MiB** (EXCESSIVE)
- Total objects: ~369M

## 2. Build Artifacts (Should NOT be in git)

| Artifact | Size | Tracked in Git? | Status |
|----------|------|-----------------|--------|
| node_modules/ | 885M | ✅ NO (1 file only) | GOOD |
| .next/ | 784M | ✅ NO | GOOD |
| server_dist/ | 1.9M | ✅ NO | GOOD |
| .git/ | 369M | N/A | **NEEDS OPTIMIZATION** |

**Note:** Only 1 file from build artifacts is tracked in git (likely an error, needs investigation).

## 3. Largest Files (>1MB)

| File | Size | Action |
|------|------|--------|
| .git/objects/pack/pack-b19c3f26.pack | 325M | **GC/REPACK** |
| node_modules/@next/swc-linux-x64-musl/*.node | 150M | KEEP (runtime) |
| node_modules/@next/swc-linux-x64-gnu/*.node | 126M | KEEP (runtime) |
| .next/cache/webpack/client-production/0.pack | 92M | **DELETE** |
| .next/cache/webpack/client-development/1.pack | 89M | **DELETE** |
| .next/cache/webpack/client-development/2.pack | 87M | **DELETE** |
| .next/cache/webpack/server-production/0.pack | 80M | **DELETE** |
| .next/cache/webpack/client-development/4.pack | 62M | **DELETE** |
| .next/cache/webpack/server-development/0.pack | 51M | **DELETE** |
| .git/objects/23/87fbdafd*.pack (loose) | 20M | **GC** |
| .git/objects/e4/3af7aa29*.pack (loose) | 19M | **GC** |
| @img/sharp-libvips-linuxmusl-x64/lib/*.so | 17M | KEEP (runtime) |
| @img/sharp-libvips-linux-x64/lib/*.so | 16M | KEEP (runtime) |
| mcp-servers/.../esbuild binaries | 11M each | KEEP (runtime) |

**Total webpack cache files:** 39 pack files in .next/cache/

## 4. Root Directory Audit

Total markdown files in root: **21 files**

### Files to KEEP in root:
- README.md (3.9KB) - Project readme
- CLAUDE.md (5.2KB) - AI assistant instructions
- replit.md (7.9KB) - Replit configuration

### Files to MOVE to docs/:
- IMPORTANT_README_START_HERE.md (8.7KB) → docs/GETTING_STARTED.md
- TESTING.md (9.9KB) → docs/TESTING.md
- START_HERE.md (10KB) → docs/START_HERE.md

### Files to DELETE (AI-Generated Clutter):
**In root (15 files, ~208KB):**
- ALPACA_RATE_LIMITING_IMPLEMENTATION.md (12.3KB)
- ALPACA_RATE_LIMITING_QUICK_REFERENCE.md (3.3KB)
- ANIMATION_INTEGRATION_COMPLETE.md (11.5KB)
- BUNDLE_OPTIMIZATION_SUMMARY.md (5.4KB)
- DEBOUNCING_IMPLEMENTATION_SUMMARY.md (8.5KB)
- DEBOUNCING_QUICK_REFERENCE.md (3.4KB)
- DEBOUNCING_VERIFICATION_CHECKLIST.md (8.2KB)
- FRAMER_MOTION_INTEGRATION.md (8.3KB)
- INTEGRATION_MANIFEST.md (26.4KB)
- OPENSPEC_COMPLETE_SUMMARY.md (11.3KB)
- OPENSPEC_IMPLEMENTATION_PLAN.md (22.9KB)
- OPENSPEC_INTEGRATION_COMPLETE.md (24.7KB)
- RATE_LIMITING_FILES_SUMMARY.md (7.2KB)
- ULTIMATE_INTEGRATION_REPORT.md (23.5KB)
- UX_TRANSFORMATION_COMPLETE.md (25.5KB)

**In docs/generated/ (6 files):**
- docs/generated/DATABASE_FIXES_IMPLEMENTATION_COMPLETE.md
- docs/generated/FREE_LLM_INTEGRATION_COMPLETE.md
- docs/generated/FREE_LLM_SETUP_COMPLETE.md
- docs/generated/OPTIMIZATION_COMPLETE.md
- docs/generated/POSITIONS_EXTRACTION_COMPLETE.md
- docs/generated/WEBHOOKS_EXTRACTION_COMPLETE.md

**In docs/reports/ (4 files):**
- docs/reports/CONSOLE_MIGRATION_COMPLETE.md
- docs/reports/CRITICAL_FIXES_IMPLEMENTATION.md
- docs/reports/POSITION_RECONCILIATION_IMPLEMENTATION.md
- docs/reports/SECTOR_ROTATION_QUICK_IMPLEMENTATION.md

**In docs/ (3 files):**
- docs/ALPACA_ENHANCEMENT_IMPLEMENTATION.md
- docs/DEBOUNCE_IMPLEMENTATION.md
- docs/UX_OVERHAUL_2024_IMPLEMENTATION.md

**Total AI-generated clutter: 28 files**

## 5. Problem Patterns Found

### AI-Generated Clutter
**Pattern:** `*_COMPLETE.md`, `*_IMPLEMENTATION.md`, `*_SUMMARY.md`
**Count:** 28 files across root, docs/, docs/generated/, docs/reports/
**Impact:** ~500KB of redundant documentation
**Action:** DELETE ALL - information already in git history

### Backup/Duplicate Files
**Search results:** No `.bak`, `.old`, or `.backup` files found (only normal "copy" functions in node_modules)
**Status:** ✅ CLEAN

### Excessive Build Caches
**Pattern:** `.next/cache/webpack/**/*.pack`
**Count:** 39 webpack pack files
**Impact:** 716M of the 784M .next directory
**Action:** Remove entire .next/cache/ directory

### Large Git Objects
**Pattern:** Loose objects >10MB in `.git/objects/`
**Count:** 2 loose objects (20M + 19M)
**Impact:** Should be packed or pruned
**Action:** Run `git gc --aggressive --prune=now`

## 6. Recommended Actions (Priority Order)

### IMMEDIATE (Will save most space):

**1. Clean .next build cache (saves ~784M)**
```bash
rm -rf .next/
npm run build  # Rebuild fresh
```

**2. Remove server_dist if present (saves ~1.9M)**
```bash
rm -rf server_dist/
```

**3. Optimize git repository (saves ~100-150M estimated)**
```bash
git gc --aggressive --prune=now
git repack -Ad
git prune
```

**4. Delete AI-generated clutter files (saves ~500KB, improves clarity)**
```bash
# Root directory cleanup
rm -f ALPACA_RATE_LIMITING_IMPLEMENTATION.md
rm -f ALPACA_RATE_LIMITING_QUICK_REFERENCE.md
rm -f ANIMATION_INTEGRATION_COMPLETE.md
rm -f BUNDLE_OPTIMIZATION_SUMMARY.md
rm -f DEBOUNCING_IMPLEMENTATION_SUMMARY.md
rm -f DEBOUNCING_QUICK_REFERENCE.md
rm -f DEBOUNCING_VERIFICATION_CHECKLIST.md
rm -f FRAMER_MOTION_INTEGRATION.md
rm -f INTEGRATION_MANIFEST.md
rm -f OPENSPEC_COMPLETE_SUMMARY.md
rm -f OPENSPEC_IMPLEMENTATION_PLAN.md
rm -f OPENSPEC_INTEGRATION_COMPLETE.md
rm -f RATE_LIMITING_FILES_SUMMARY.md
rm -f ULTIMATE_INTEGRATION_REPORT.md
rm -f UX_TRANSFORMATION_COMPLETE.md

# Subdirectory cleanup
rm -rf docs/generated/
rm -f docs/ALPACA_ENHANCEMENT_IMPLEMENTATION.md
rm -f docs/DEBOUNCE_IMPLEMENTATION.md
rm -f docs/UX_OVERHAUL_2024_IMPLEMENTATION.md
rm -f docs/reports/CONSOLE_MIGRATION_COMPLETE.md
rm -f docs/reports/CRITICAL_FIXES_IMPLEMENTATION.md
rm -f docs/reports/POSITION_RECONCILIATION_IMPLEMENTATION.md
rm -f docs/reports/SECTOR_ROTATION_QUICK_IMPLEMENTATION.md
```

### HIGH PRIORITY:

**5. Reorganize root documentation (saves ~28KB, improves structure)**
```bash
# Move useful docs to proper location
mv IMPORTANT_README_START_HERE.md docs/GETTING_STARTED.md
mv TESTING.md docs/TESTING.md
mv START_HERE.md docs/START_HERE.md
```

**6. Review mcp-servers directory (potential 10-20M savings)**
```bash
# Check for nested node_modules
find mcp-servers/ -name "node_modules" -type d
# If found, verify they're needed or can share deps with root
```

**7. Review archive/ directory (potential 812KB savings)**
```bash
# Determine if archive/ is still needed
ls -lh archive/
# If obsolete, move to git history
```

### MEDIUM PRIORITY:

**8. Audit analysis/ directory (potential savings)**
```bash
# Check for old or redundant analysis reports
ls -lh analysis/
```

**9. Create .gitattributes for LFS consideration (future)**
```bash
# For large binary files if added in future
echo "*.pack filter=lfs diff=lfs merge=lfs -text" >> .gitattributes
echo "*.node filter=lfs diff=lfs merge=lfs -text" >> .gitattributes
```

## 7. Estimated Impact

### Space Recovery Breakdown:
| Action | Space Saved | Difficulty |
|--------|-------------|------------|
| Remove .next/ | 784M | Easy |
| Git gc/repack | 100-150M | Easy |
| Remove server_dist/ | 1.9M | Easy |
| Delete AI clutter | 500KB | Easy |
| Reorganize docs | 28KB | Easy |
| Review mcp-servers/ | 10-20M | Medium |
| Review archive/ | 812KB | Medium |
| **TOTAL ESTIMATED** | **~900M-950M** | - |

### Expected Results:
- **Current size:** 2.4GB
- **After cleanup:** ~1.5GB
- **After git optimization:** ~1.3-1.4GB
- **Space recovered:** ~1.0-1.1GB (42-46% reduction)

### To Reach <200MB Target:
**Note:** The <200MB target is **UNREALISTIC** for a production project with:
- 81 npm dependencies (node_modules: 885M - not tracked in git)
- Full TypeScript/Next.js build toolchain
- 152K lines of code

**Realistic git repository size after cleanup:** ~100-150MB (excluding node_modules)

**Breakdown of unavoidable space:**
- node_modules/: 885M (not in git, required for development)
- Source code: ~15-20M
- Git objects (optimized): ~100-150M
- **Total workspace:** ~1.0-1.1GB (minimum realistic size)

## 8. Additional Observations

### Positive Findings:
✅ .gitignore is properly configured for build artifacts
✅ No stray node_modules tracked in git
✅ No backup file clutter (.bak, .old, .backup)
✅ Source code directories are reasonable sizes

### Concerns:
⚠️ Git pack file is unusually large (325M) - may contain large files from history
⚠️ .next/cache has 39 webpack pack files - Next.js cache not being cleaned
⚠️ 28 AI-generated documentation files add clutter
⚠️ mcp-servers/ (59M) may contain nested node_modules

### Recommended Follow-ups:
1. Investigate what's in the 325M git pack (may be old large files)
2. Set up pre-commit hook to prevent accidental large file commits
3. Configure Next.js cache cleanup in build scripts
4. Add .claude/rules/ guideline to prevent AI-generated clutter files

## 9. Git Repository Health

### Current Stats:
- Total objects: 9,941 (455 loose + 9,486 packed)
- Loose objects: 43.37 MiB
- Packed objects: 324.49 MiB
- **Total git size: 369M**

### Largest Objects (Loose):
- .git/objects/23/87fbdafd* (20M)
- .git/objects/e4/3af7aa29* (19M)

### Recommended Git Commands:
```bash
# 1. Find largest files in git history
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  sed -n 's/^blob //p' | \
  sort --numeric-sort --key=2 --reverse | \
  head -20

# 2. Aggressive cleanup
git gc --aggressive --prune=now

# 3. Repack efficiently
git repack -Ad

# 4. Verify improvements
git count-objects -vH
```

## 10. COMPLETION CRITERIA

✅ All 10 diagnostic commands executed
✅ Report created at docs/RESCUE_DIAGNOSTIC.md
✅ No files modified (except creating this report)
✅ Comprehensive analysis provided
✅ Action plan with commands ready

## NEXT STEPS

**Recommended First Action:**
```bash
# Safe, reversible, saves ~784M immediately
rm -rf .next/
npm run build
```

**Then proceed with:**
1. Git garbage collection (saves 100-150M)
2. Delete AI-generated clutter files (improves clarity)
3. Review mcp-servers/ for nested dependencies

---

**Report Status:** ✅ COMPLETE
**Generated By:** Claude Code (Stage 1 Diagnostic)
**Timestamp:** 2026-01-03 15:20 UTC
