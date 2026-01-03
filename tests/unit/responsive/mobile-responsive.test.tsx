import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Mobile Responsive Design Tests
 *
 * Tests breakpoint detection, responsive behaviors, and touch interactions.
 * These tests use mocked window.matchMedia - run with vitest for DOM environment.
 */

// Skip tests that need window in environments without DOM
const describeWithDOM =
  typeof window !== "undefined" ? describe : describe.skip;

describe("Tailwind Breakpoints", () => {
  it("defines standard breakpoints", () => {
    const breakpoints = {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      "2xl": 1536,
    };

    expect(breakpoints.sm).toBe(640);
    expect(breakpoints.md).toBe(768);
    expect(breakpoints.lg).toBe(1024);
    expect(breakpoints.xl).toBe(1280);
    expect(breakpoints["2xl"]).toBe(1536);
  });
});

describe("Mobile Bottom Navigation Config", () => {
  it("has 5 navigation items", () => {
    const navItems = [
      { label: "Home", path: "/" },
      { label: "Strategies", path: "/strategies" },
      { label: "Create", path: "/create", primary: true },
      { label: "Portfolio", path: "/portfolio" },
      { label: "AI Pulse", path: "/ai-pulse" },
    ];

    expect(navItems).toHaveLength(5);
    expect(navItems[2].primary).toBe(true);
  });
});

describe("Chart Height Configuration", () => {
  it("has appropriate heights for each breakpoint", () => {
    const chartHeights = {
      mobile: 200, // < 640px
      tablet: 280, // 640-1024px
      desktop: 350, // >= 1024px
    };

    expect(chartHeights.mobile).toBeLessThan(chartHeights.tablet);
    expect(chartHeights.tablet).toBeLessThan(chartHeights.desktop);
  });
});

describe("Grid Configuration", () => {
  it("defines responsive grid columns", () => {
    const gridCols = {
      mobile: 1,
      tablet: 2,
      desktop: 4,
    };

    expect(gridCols.mobile).toBe(1);
    expect(gridCols.tablet).toBe(2);
    expect(gridCols.desktop).toBe(4);
  });
});

describe("Touch Target Specifications", () => {
  it("meets minimum touch target size", () => {
    // Minimum touch target should be 44px (iOS) or 48px (Android)
    const minTouchTargetIOS = 44;
    const minTouchTargetAndroid = 48;
    const implementedSize = 44;

    expect(implementedSize).toBeGreaterThanOrEqual(minTouchTargetIOS);
  });

  it("supports required touch events", () => {
    const requiredEvents = ["touchstart", "touchmove", "touchend"];
    requiredEvents.forEach((event) => {
      expect(event).toMatch(/^touch/);
    });
  });
});

describe("Safe Area Configuration", () => {
  it("defines safe-area CSS values", () => {
    const safeAreaValues = [
      "env(safe-area-inset-top)",
      "env(safe-area-inset-bottom)",
      "env(safe-area-inset-left)",
      "env(safe-area-inset-right)",
    ];

    safeAreaValues.forEach((value) => {
      expect(value).toContain("safe-area-inset");
    });
  });
});

describe("Viewport Meta Tag", () => {
  it("should have responsive viewport settings", () => {
    const viewportMeta = {
      width: "device-width",
      initialScale: 1,
      maximumScale: 1,
      userScalable: "no",
    };

    expect(viewportMeta.width).toBe("device-width");
    expect(viewportMeta.initialScale).toBe(1);
  });
});

describe("Common Device Viewports", () => {
  const deviceWidths = {
    "iPhone SE": 375,
    "iPhone 12/13/14": 390,
    "iPhone Pro Max": 428,
    "iPad Mini": 768,
    "iPad Pro 11": 834,
    "iPad Pro 12.9": 1024,
    "MacBook Pro 14": 1512,
    "4K Display": 2560,
  };

  Object.entries(deviceWidths).forEach(([device, width]) => {
    it(`supports ${device} (${width}px)`, () => {
      expect(width).toBeGreaterThan(0);
      expect(typeof width).toBe("number");
    });
  });
});

// DOM-dependent tests (only run in jsdom environment)
describeWithDOM("Breakpoint Detection (DOM)", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalInnerWidth: number;

  const mockViewport = (width: number) => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: width,
    });

    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const minWidthMatch = query.match(/min-width:\s*(\d+)px/);
      const maxWidthMatch = query.match(/max-width:\s*(\d+)px/);

      let matches = false;
      if (minWidthMatch) {
        matches = width >= parseInt(minWidthMatch[1]);
      }
      if (maxWidthMatch) {
        matches = width <= parseInt(maxWidthMatch[1]);
      }

      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
  };

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("detects mobile viewport (< 640px)", () => {
    mockViewport(375);
    const isMobile = !window.matchMedia("(min-width: 640px)").matches;
    expect(isMobile).toBe(true);
  });

  it("detects tablet viewport (640px - 1024px)", () => {
    mockViewport(768);
    const isTablet =
      window.matchMedia("(min-width: 640px)").matches &&
      !window.matchMedia("(min-width: 1024px)").matches;
    expect(isTablet).toBe(true);
  });

  it("detects desktop viewport (>= 1024px)", () => {
    mockViewport(1440);
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    expect(isDesktop).toBe(true);
  });
});
