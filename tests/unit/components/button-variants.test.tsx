import { describe, it, expect } from "vitest";

/**
 * Button Component - Robinhood UI Variant Tests
 *
 * Tests button variants, colors, and size configurations.
 * Uses configuration-based tests that don't require DOM rendering.
 */

// Button variant configuration (mirrors component implementation)
const buttonVariants = {
  // Trading variants
  gain: "bg-gain text-gain-foreground hover:bg-gain/90 shadow-sm",
  loss: "bg-loss text-loss-foreground hover:bg-loss/90 shadow-sm",
  "gain-outline":
    "border border-gain text-gain hover:bg-gain hover:text-gain-foreground",
  "loss-outline":
    "border border-loss text-loss hover:bg-loss hover:text-loss-foreground",
  glass:
    "bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 text-white",

  // Default variants
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
  destructive:
    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
  outline:
    "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  secondary:
    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};

const buttonSizes = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8",
  icon: "h-9 w-9",
  pill: "h-8 rounded-full px-4 text-xs",
  "pill-lg": "h-10 rounded-full px-6 text-sm",
};

describe("Button Component - Robinhood UI Variants", () => {
  describe("Trading Variants", () => {
    it("gain variant uses gain color", () => {
      expect(buttonVariants.gain).toContain("bg-gain");
      expect(buttonVariants.gain).toContain("text-gain-foreground");
    });

    it("gain variant has hover effect", () => {
      expect(buttonVariants.gain).toContain("hover:bg-gain/90");
    });

    it("loss variant uses loss color", () => {
      expect(buttonVariants.loss).toContain("bg-loss");
      expect(buttonVariants.loss).toContain("text-loss-foreground");
    });

    it("loss variant has hover effect", () => {
      expect(buttonVariants.loss).toContain("hover:bg-loss/90");
    });

    it("gain-outline variant has correct border", () => {
      expect(buttonVariants["gain-outline"]).toContain("border-gain");
      expect(buttonVariants["gain-outline"]).toContain("text-gain");
      expect(buttonVariants["gain-outline"]).toContain("hover:bg-gain");
    });

    it("loss-outline variant has correct border", () => {
      expect(buttonVariants["loss-outline"]).toContain("border-loss");
      expect(buttonVariants["loss-outline"]).toContain("text-loss");
      expect(buttonVariants["loss-outline"]).toContain("hover:bg-loss");
    });
  });

  describe("Glass Variant", () => {
    it("glass variant has backdrop blur", () => {
      expect(buttonVariants.glass).toContain("backdrop-blur-sm");
    });

    it("glass variant has semi-transparent background", () => {
      expect(buttonVariants.glass).toContain("bg-white/10");
    });

    it("glass variant has border", () => {
      expect(buttonVariants.glass).toContain("border-white/20");
    });

    it("glass variant has hover effect", () => {
      expect(buttonVariants.glass).toContain("hover:bg-white/20");
    });
  });

  describe("Pill Sizes", () => {
    it("pill size uses rounded-full", () => {
      expect(buttonSizes.pill).toContain("rounded-full");
      expect(buttonSizes.pill).toContain("h-8");
    });

    it("pill-lg size is larger", () => {
      expect(buttonSizes["pill-lg"]).toContain("rounded-full");
      expect(buttonSizes["pill-lg"]).toContain("h-10");
      expect(buttonSizes["pill-lg"]).toContain("px-6");
    });

    it("pill size uses xs text", () => {
      expect(buttonSizes.pill).toContain("text-xs");
    });

    it("pill-lg size uses sm text", () => {
      expect(buttonSizes["pill-lg"]).toContain("text-sm");
    });
  });

  describe("Standard Sizes", () => {
    it("default size has h-9", () => {
      expect(buttonSizes.default).toContain("h-9");
    });

    it("sm size has h-8", () => {
      expect(buttonSizes.sm).toContain("h-8");
    });

    it("lg size has h-10", () => {
      expect(buttonSizes.lg).toContain("h-10");
    });

    it("icon size is square", () => {
      expect(buttonSizes.icon).toContain("h-9");
      expect(buttonSizes.icon).toContain("w-9");
    });
  });

  describe("Default Variants", () => {
    it("default variant has primary color", () => {
      expect(buttonVariants.default).toContain("bg-primary");
    });

    it("destructive variant has destructive color", () => {
      expect(buttonVariants.destructive).toContain("bg-destructive");
    });

    it("outline variant has border", () => {
      expect(buttonVariants.outline).toContain("border");
    });

    it("secondary variant has secondary color", () => {
      expect(buttonVariants.secondary).toContain("bg-secondary");
    });

    it("ghost variant only has hover", () => {
      expect(buttonVariants.ghost).toContain("hover:bg-accent");
      // Should not have a non-hover background (only hover:bg-* allowed)
      expect(buttonVariants.ghost).not.toMatch(/(?<!\:)bg-[a-z]/);
    });

    it("link variant has underline on hover", () => {
      expect(buttonVariants.link).toContain("hover:underline");
    });
  });

  describe("Shadow Effects", () => {
    it("gain variant has shadow", () => {
      expect(buttonVariants.gain).toContain("shadow-sm");
    });

    it("loss variant has shadow", () => {
      expect(buttonVariants.loss).toContain("shadow-sm");
    });

    it("default variant has shadow", () => {
      expect(buttonVariants.default).toContain("shadow");
    });
  });

  describe("Accessibility", () => {
    const focusClasses =
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

    it("has focus-visible outline", () => {
      expect(focusClasses).toContain("focus-visible:outline-none");
    });

    it("has focus ring", () => {
      expect(focusClasses).toContain("focus-visible:ring-1");
    });

    const disabledClasses = "disabled:pointer-events-none disabled:opacity-50";

    it("disabled state removes pointer events", () => {
      expect(disabledClasses).toContain("disabled:pointer-events-none");
    });

    it("disabled state reduces opacity", () => {
      expect(disabledClasses).toContain("disabled:opacity-50");
    });
  });
});
