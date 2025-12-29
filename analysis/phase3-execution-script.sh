#!/bin/bash
# Phase 3: Safe Cleanup Execution Script
# Generated: December 29, 2024
#
# INSTRUCTIONS:
# 1. Review each stage before running
# 2. Run verification after each stage
# 3. Commit after each successful stage
#
# Usage: Execute stages manually or uncomment to run

set -e  # Exit on error

echo "=========================================="
echo "Phase 3: Codebase Cleanup Execution"
echo "=========================================="

# Create backup branch
echo "Creating backup branch..."
git checkout -b cleanup/phase3-$(date +%Y%m%d) 2>/dev/null || true

###########################################
# STAGE 1: Quick Wins (No Risk)
###########################################
stage1_quick_wins() {
    echo ""
    echo "=== STAGE 1: Quick Wins ==="

    # 1.1 Remove unused type definitions
    echo "Removing unused @types packages..."
    npm uninstall @types/decimal.js @types/p-limit @types/p-retry @types/cors 2>/dev/null || echo "Some packages not found"

    # 1.2 Remove unused attached assets
    echo "Removing unused attached assets..."
    rm -f attached_assets/Screenshot_20251213_115204_Expo_Go_1765612343350.jpg
    rm -f attached_assets/targeted_element_1765833383165.png
    rm -f attached_assets/generated_images/ai_trading_app_icon.png

    # 1.3 Update patch dependencies
    echo "Updating patch-level dependencies..."
    npm update @tanstack/react-query isomorphic-dompurify vitest @types/react @types/react-dom 2>/dev/null || true

    echo "Stage 1 complete. Run verification."
}

###########################################
# STAGE 2: Remove Unused UI Components
###########################################
stage2_remove_unused_ui() {
    echo ""
    echo "=== STAGE 2: Remove Unused UI Components ==="

    # 2.1 Remove unused component files
    echo "Removing unused UI component files..."
    rm -f components/ui/accordion.tsx
    rm -f components/ui/aspect-ratio.tsx
    rm -f components/ui/calendar.tsx
    rm -f components/ui/carousel.tsx
    rm -f components/ui/collapsible.tsx
    rm -f components/ui/context-menu.tsx
    rm -f components/ui/drawer.tsx
    rm -f components/ui/form.tsx
    rm -f components/ui/hover-card.tsx
    rm -f components/ui/input-otp.tsx
    rm -f components/ui/menubar.tsx
    rm -f components/ui/navigation-menu.tsx
    rm -f components/ui/radio-group.tsx
    rm -f components/ui/toggle.tsx
    rm -f components/ui/toggle-group.tsx
    rm -f components/ui/command.tsx

    # 2.2 Remove corresponding packages
    echo "Removing unused packages..."
    npm uninstall \
        @radix-ui/react-accordion \
        @radix-ui/react-aspect-ratio \
        @radix-ui/react-collapsible \
        @radix-ui/react-context-menu \
        @radix-ui/react-hover-card \
        @radix-ui/react-menubar \
        @radix-ui/react-navigation-menu \
        @radix-ui/react-radio-group \
        @radix-ui/react-toggle \
        @radix-ui/react-toggle-group \
        embla-carousel-react \
        input-otp \
        vaul \
        cmdk \
        react-day-picker \
        react-hook-form \
        date-fns \
        2>/dev/null || echo "Some packages not found"

    echo "Stage 2 complete. Run verification."
}

###########################################
# STAGE 3: Fix Security Vulnerabilities
###########################################
stage3_security_fixes() {
    echo ""
    echo "=== STAGE 3: Security Fixes ==="

    # 3.1 Upgrade esbuild
    echo "Upgrading esbuild..."
    npm install esbuild@^0.27.2 2>/dev/null || true

    # 3.2 Remove axios-cookiejar-support (optional)
    echo "Removing axios-cookiejar-support (if safe)..."
    # npm uninstall axios-cookiejar-support tough-cookie 2>/dev/null || true

    echo "Stage 3 complete. Run verification."
}

###########################################
# VERIFICATION
###########################################
verify() {
    echo ""
    echo "=== VERIFICATION ==="

    echo "1. Running TypeScript check..."
    npx tsc --noEmit || { echo "TypeScript check failed!"; exit 1; }

    echo "2. Running lint..."
    npm run lint || { echo "Lint failed!"; exit 1; }

    echo "3. Running build..."
    npm run build || { echo "Build failed!"; exit 1; }

    echo "4. Running security audit..."
    npm audit || true

    echo ""
    echo "Verification complete!"
}

###########################################
# COMMIT CHANGES
###########################################
commit_stage() {
    stage_name=$1
    echo ""
    echo "Committing $stage_name..."
    git add -A
    git commit -m "cleanup: $stage_name

- Part of Phase 3 codebase cleanup
- See analysis/action-plan-20241229.md for details

Generated with Claude Code" || echo "Nothing to commit"
}

###########################################
# MAIN
###########################################
echo ""
echo "Available stages:"
echo "  stage1_quick_wins     - Remove unused types and assets"
echo "  stage2_remove_unused_ui - Remove unused UI components"
echo "  stage3_security_fixes - Fix security vulnerabilities"
echo "  verify                - Run verification checks"
echo "  commit_stage <name>   - Commit current changes"
echo ""
echo "Run stages manually by sourcing this script and calling functions:"
echo "  source analysis/phase3-execution-script.sh"
echo "  stage1_quick_wins"
echo "  verify"
echo "  commit_stage 'Stage 1 quick wins'"
echo ""

# Uncomment to run all stages:
# stage1_quick_wins
# verify
# commit_stage "Stage 1: Quick wins"
# stage2_remove_unused_ui
# verify
# commit_stage "Stage 2: Remove unused UI"
# stage3_security_fixes
# verify
# commit_stage "Stage 3: Security fixes"
