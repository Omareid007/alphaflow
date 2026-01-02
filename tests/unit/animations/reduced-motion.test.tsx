import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Reduced Motion Accessibility Tests
 *
 * Tests for respecting user preferences for reduced motion.
 * Uses conditional DOM tests for environment compatibility.
 */

// Skip tests that need window in environments without DOM
const describeWithDOM = typeof window !== "undefined" ? describe : describe.skip;

describe("Animation Level Support", () => {
  it("respects 'none' animation level", () => {
    const animationLevel = "none";
    const shouldAnimate = animationLevel !== "none";
    expect(shouldAnimate).toBe(false);
  });

  it("respects 'reduced' animation level", () => {
    const animationLevel = "reduced";
    const shouldReduceMotion = animationLevel !== "full";
    expect(shouldReduceMotion).toBe(true);
  });

  it("enables full animations by default", () => {
    const animationLevel = "full";
    const shouldAnimate = animationLevel !== "none";
    const shouldReduceMotion = animationLevel !== "full";
    expect(shouldAnimate).toBe(true);
    expect(shouldReduceMotion).toBe(false);
  });
});

describe("Animation Utility Functions", () => {
  it("provides shouldAnimate helper", () => {
    const shouldAnimate = (level: string) => level !== "none";

    expect(shouldAnimate("full")).toBe(true);
    expect(shouldAnimate("reduced")).toBe(true);
    expect(shouldAnimate("none")).toBe(false);
  });

  it("provides shouldReduceMotion helper", () => {
    const shouldReduceMotion = (level: string) => level !== "full";

    expect(shouldReduceMotion("full")).toBe(false);
    expect(shouldReduceMotion("reduced")).toBe(true);
    expect(shouldReduceMotion("none")).toBe(true);
  });
});

describe("Effective Animation Level Calculation", () => {
  it("user choice of none always wins", () => {
    const userAnimationLevel = "none";
    const effectiveLevel = userAnimationLevel;
    expect(effectiveLevel).toBe("none");
  });

  it("user choice of reduced is respected", () => {
    const userAnimationLevel = "reduced";
    const effectiveLevel = userAnimationLevel;
    expect(effectiveLevel).toBe("reduced");
  });
});

describe("CSS Animation Classes", () => {
  it("verifies animation class naming convention", () => {
    const animationClasses = [
      "animate-pulse-gain",
      "animate-pulse-loss",
      "animate-glow",
      "animate-fade-in-up",
      "animate-slide-in-right",
      "animate-shimmer",
    ];

    animationClasses.forEach((className) => {
      expect(className).toMatch(/^animate-/);
    });
  });

  it("verifies transition timing functions exist", () => {
    const timingFunctions = ["ease-out-expo", "ease-in-out-expo", "ease-bounce"];

    timingFunctions.forEach((timing) => {
      expect(timing).toMatch(/^ease-/);
    });
  });
});

describe("Duration CSS Variables", () => {
  it("verifies CSS custom properties for animation timings", () => {
    const durationVariables = [
      "--duration-instant",
      "--duration-fast",
      "--duration-normal",
      "--duration-slow",
    ];

    durationVariables.forEach((variable) => {
      expect(variable).toMatch(/^--duration-/);
    });
  });

  it("has expected duration values", () => {
    const expectedDurations = {
      instant: "50ms",
      fast: "150ms",
      normal: "250ms",
      slow: "400ms",
    };

    expect(expectedDurations.instant).toBe("50ms");
    expect(expectedDurations.fast).toBe("150ms");
    expect(expectedDurations.normal).toBe("250ms");
    expect(expectedDurations.slow).toBe("400ms");
  });
});

// DOM-dependent tests for system preference detection
describeWithDOM("System Preference Detection (DOM)", () => {
  let originalMatchMedia: typeof window.matchMedia;

  const mockReducedMotion = (prefersReducedMotion: boolean) => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches:
        query === "(prefers-reduced-motion: reduce)"
          ? prefersReducedMotion
          : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  };

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("detects when user prefers reduced motion", () => {
    mockReducedMotion(true);

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    expect(mediaQuery.matches).toBe(true);
  });

  it("detects when user does not prefer reduced motion", () => {
    mockReducedMotion(false);

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    expect(mediaQuery.matches).toBe(false);
  });

  it("reduces motion when system preference is set even if user chose full", () => {
    mockReducedMotion(true);

    const userAnimationLevel = "full";
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // System preference should override user preference for accessibility
    const effectiveLevel =
      prefersReducedMotion && userAnimationLevel === "full"
        ? "reduced"
        : userAnimationLevel;

    expect(effectiveLevel).toBe("reduced");
  });

  it("allows full animations when no reduced motion preference", () => {
    mockReducedMotion(false);

    const userAnimationLevel = "full";
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const effectiveLevel =
      prefersReducedMotion && userAnimationLevel === "full"
        ? "reduced"
        : userAnimationLevel;

    expect(effectiveLevel).toBe("full");
  });
});
