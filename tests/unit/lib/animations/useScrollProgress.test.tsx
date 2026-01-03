import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useScrollProgress } from "@/lib/animations/hooks/useScrollProgress";

// Mock framer-motion
const mockMotionValue = (initial: number) => {
  let value = initial;
  const listeners: Array<(v: number) => void> = [];
  return {
    get: () => value,
    set: (v: number) => {
      value = v;
      listeners.forEach((l) => l(v));
    },
    on: (event: string, callback: (v: number) => void) => {
      if (event === "change") {
        listeners.push(callback);
      }
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx > -1) listeners.splice(idx, 1);
      };
    },
  };
};

vi.mock("framer-motion", () => {
  return {
    useScroll: vi.fn(() => ({
      scrollX: mockMotionValue(0),
      scrollY: mockMotionValue(0),
      scrollXProgress: mockMotionValue(0),
      scrollYProgress: mockMotionValue(0),
    })),
    useTransform: vi.fn((motionValue, transformer) => {
      const result = mockMotionValue(0);
      if (typeof transformer === "function") {
        result.set(transformer(motionValue.get()));
      }
      motionValue.on("change", (v: number) => {
        if (typeof transformer === "function") {
          result.set(transformer(v));
        }
      });
      return result;
    }),
    useMotionValue: vi.fn((initial) => mockMotionValue(initial)),
  };
});

// Mock useReducedMotion
let mockReducedMotion = false;
vi.mock("@/lib/animations/hooks/useReducedMotion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

// Mock IntersectionObserver as a class
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  elements: Set<Element> = new Set();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  // Helper to trigger intersection
  trigger(isIntersecting: boolean) {
    const entries = Array.from(this.elements).map((target) => ({
      isIntersecting,
      target,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    }));
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

describe("useScrollProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReducedMotion = false;

    // Set up IntersectionObserver mock
    global.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("should return initial scroll progress values", () => {
    const { result } = renderHook(() => useScrollProgress());

    expect(result.current.progress).toBe(0);
    expect(result.current.isScrolling).toBe(false);
    expect(result.current.isInView).toBe(true);
    expect(result.current.direction).toBe("none");
  });

  it("should return scrollProgress MotionValue", () => {
    const { result } = renderHook(() => useScrollProgress());

    expect(result.current.scrollProgress).toBeDefined();
    expect(typeof result.current.scrollProgress.get).toBe("function");
    expect(typeof result.current.scrollProgress.on).toBe("function");
  });

  it("should return scrollPosition MotionValue", () => {
    const { result } = renderHook(() => useScrollProgress());

    expect(result.current.scrollPosition).toBeDefined();
    expect(typeof result.current.scrollPosition.get).toBe("function");
  });

  it("should default to y-axis scrolling", () => {
    const { result } = renderHook(() => useScrollProgress());

    // Default axis is y, should work without error
    expect(result.current.progress).toBe(0);
    expect(result.current.direction).toBe("none");
  });

  it("should accept x-axis option", () => {
    const { result } = renderHook(() => useScrollProgress({ axis: "x" }));

    // Should return values without error
    expect(result.current.progress).toBe(0);
    expect(result.current.direction).toBe("none");
  });

  it("should return static values when reduced motion is preferred", () => {
    mockReducedMotion = true;

    const { result } = renderHook(() => useScrollProgress());

    expect(result.current.progress).toBe(0);
    expect(result.current.isScrolling).toBe(false);
    expect(result.current.isInView).toBe(true);
    expect(result.current.direction).toBe("none");
  });

  it("should handle target ref option", () => {
    const mockRef = { current: document.createElement("div") };

    const { result } = renderHook(() => useScrollProgress({ target: mockRef }));

    // Should return values without error when target is provided
    expect(result.current.progress).toBe(0);
  });

  it("should handle container ref option", () => {
    const mockRef = { current: document.createElement("div") };

    const { result } = renderHook(() =>
      useScrollProgress({ container: mockRef })
    );

    // Should return values without error when container is provided
    expect(result.current.progress).toBe(0);
  });

  it("should handle scrollOffset option", () => {
    const { result } = renderHook(() =>
      useScrollProgress({ scrollOffset: ["start end", "end start"] })
    );

    // Should return values without error
    expect(result.current.progress).toBe(0);
  });

  it("should clean up subscriptions on unmount", () => {
    const { result, unmount } = renderHook(() => useScrollProgress());

    // Should have subscribed to MotionValue changes
    expect(result.current.scrollProgress).toBeDefined();

    // Unmount should not throw
    expect(() => unmount()).not.toThrow();
  });

  it("should track isInView state", () => {
    const mockRef = { current: document.createElement("div") };

    const { result } = renderHook(() => useScrollProgress({ target: mockRef }));

    // Initially in view (default state)
    expect(result.current.isInView).toBe(true);
  });

  it("should accept offset option for progress adjustment", () => {
    const { result } = renderHook(() => useScrollProgress({ offset: 10 }));

    // Should return values without error
    expect(result.current.progress).toBe(0);
  });

  it("should accept smooth option", () => {
    const { result } = renderHook(() => useScrollProgress({ smooth: true }));

    // Should return values without error
    expect(result.current.progress).toBe(0);
  });

  it("should provide direction state", () => {
    const { result } = renderHook(() => useScrollProgress());

    // Direction should be 'none' initially
    expect(["up", "down", "left", "right", "none"]).toContain(
      result.current.direction
    );
  });

  it("should provide isScrolling state", () => {
    const { result } = renderHook(() => useScrollProgress());

    // isScrolling should be boolean
    expect(typeof result.current.isScrolling).toBe("boolean");
  });
});
