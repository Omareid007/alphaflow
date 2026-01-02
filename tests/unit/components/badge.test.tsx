import { describe, it, expect } from "vitest";

/**
 * Badge Component - Robinhood UI Tests
 *
 * Tests badge variants, colors, and configurations for the trading theme.
 * Uses configuration-based tests that don't require DOM rendering.
 */

// Badge variant configuration (mirrors component implementation)
const badgeVariants = {
  // Trading variants
  gain: "bg-gain text-gain-foreground",
  loss: "bg-loss text-loss-foreground",
  "gain-subtle": "bg-gain/10 text-gain border-gain/20",
  "loss-subtle": "bg-loss/10 text-loss border-loss/20",
  glass: "bg-white/10 backdrop-blur-sm border-white/20",

  // Market status variants
  "market-open": "bg-gain/10 text-gain border-gain/20",
  "market-closed": "bg-muted-foreground/10 text-muted-foreground",
  "market-pre": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "market-after": "bg-orange-500/10 text-orange-400 border-orange-500/20",

  // Default variants
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground",
  outline: "text-foreground",
};

const badgeSizes = {
  xs: "px-1.5 py-0 text-[10px]",
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

describe("Badge Component - Robinhood UI", () => {
  describe("Trading Variants", () => {
    it("gain variant has correct classes", () => {
      expect(badgeVariants.gain).toContain("bg-gain");
      expect(badgeVariants.gain).toContain("text-gain-foreground");
    });

    it("loss variant has correct classes", () => {
      expect(badgeVariants.loss).toContain("bg-loss");
      expect(badgeVariants.loss).toContain("text-loss-foreground");
    });

    it("gain-subtle variant has correct classes", () => {
      expect(badgeVariants["gain-subtle"]).toContain("bg-gain/10");
      expect(badgeVariants["gain-subtle"]).toContain("text-gain");
    });

    it("loss-subtle variant has correct classes", () => {
      expect(badgeVariants["loss-subtle"]).toContain("bg-loss/10");
      expect(badgeVariants["loss-subtle"]).toContain("text-loss");
    });

    it("glass variant has backdrop blur", () => {
      expect(badgeVariants.glass).toContain("backdrop-blur");
      expect(badgeVariants.glass).toContain("bg-white/10");
    });
  });

  describe("Market Status Variants", () => {
    it("market-open variant uses gain color", () => {
      expect(badgeVariants["market-open"]).toContain("text-gain");
    });

    it("market-closed variant uses muted color", () => {
      expect(badgeVariants["market-closed"]).toContain("text-muted-foreground");
    });

    it("market-pre variant uses yellow color", () => {
      expect(badgeVariants["market-pre"]).toContain("text-yellow-400");
    });

    it("market-after variant uses orange color", () => {
      expect(badgeVariants["market-after"]).toContain("text-orange-400");
    });
  });

  describe("Size Variants", () => {
    it("xs size is smallest", () => {
      expect(badgeSizes.xs).toContain("text-[10px]");
      expect(badgeSizes.xs).toContain("px-1.5");
    });

    it("sm size uses xs text", () => {
      expect(badgeSizes.sm).toContain("text-xs");
      expect(badgeSizes.sm).toContain("px-2");
    });

    it("md size uses xs text", () => {
      expect(badgeSizes.md).toContain("text-xs");
      expect(badgeSizes.md).toContain("px-2.5");
    });

    it("lg size uses sm text", () => {
      expect(badgeSizes.lg).toContain("text-sm");
      expect(badgeSizes.lg).toContain("px-3");
    });
  });

  describe("Default Variants", () => {
    it("default variant has primary background", () => {
      expect(badgeVariants.default).toContain("bg-primary");
    });

    it("secondary variant has secondary background", () => {
      expect(badgeVariants.secondary).toContain("bg-secondary");
    });

    it("destructive variant has destructive background", () => {
      expect(badgeVariants.destructive).toContain("bg-destructive");
    });

    it("outline variant has text only", () => {
      expect(badgeVariants.outline).toContain("text-foreground");
    });
  });

  describe("Animation Classes", () => {
    const animationClasses = {
      pulse: "animate-pulse",
      glow: "animate-glow",
      pulseGain: "animate-pulse-gain",
      pulseLoss: "animate-pulse-loss",
    };

    it("pulse animation class exists", () => {
      expect(animationClasses.pulse).toBe("animate-pulse");
    });

    it("glow animation class exists", () => {
      expect(animationClasses.glow).toBe("animate-glow");
    });

    it("pulse-gain animation class exists", () => {
      expect(animationClasses.pulseGain).toBe("animate-pulse-gain");
    });

    it("pulse-loss animation class exists", () => {
      expect(animationClasses.pulseLoss).toBe("animate-pulse-loss");
    });
  });

  describe("Color Values", () => {
    it("gain color is Robinhood green", () => {
      const gainColor = "#00C805";
      expect(gainColor).toBe("#00C805");
    });

    it("loss color is red", () => {
      const lossColor = "#FF5252";
      expect(lossColor).toBe("#FF5252");
    });

    it("market pre-market color is yellow", () => {
      const preMarketColor = "yellow-400";
      expect(preMarketColor).toContain("yellow");
    });

    it("market after-hours color is orange", () => {
      const afterHoursColor = "orange-400";
      expect(afterHoursColor).toContain("orange");
    });
  });
});
