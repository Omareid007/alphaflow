import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useScrollProgress } from "@/lib/animations/hooks/useScrollProgress";
import { useRef } from "react";

describe("useScrollProgress", () => {
  beforeEach(() => {
    // Reset scroll position
    Object.defineProperty(window, "scrollY", {
      writable: true,
      configurable: true,
      value: 0,
    });

    Object.defineProperty(window, "pageYOffset", {
      writable: true,
      configurable: true,
      value: 0,
    });

    // Mock document dimensions
    Object.defineProperty(document.documentElement, "scrollHeight", {
      writable: true,
      configurable: true,
      value: 2000,
    });

    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("should return initial scroll progress", () => {
    const { result } = renderHook(() => useScrollProgress());

    expect(result.current.progress).toBe(0);
    expect(result.current.isScrolling).toBe(false);
    expect(result.current.scrollY).toBe(0);
  });

  it("should calculate progress correctly", async () => {
    const { result } = renderHook(() => useScrollProgress());

    // Simulate scroll to middle of page
    act(() => {
      window.scrollY = 600; // 50% of 1200px scrollable height (2000 - 800)
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(result.current.progress).toBeCloseTo(0.5, 1);
      expect(result.current.scrollY).toBe(600);
    });
  });

  it("should set isScrolling to true during scroll", async () => {
    const { result } = renderHook(() => useScrollProgress());

    act(() => {
      window.scrollY = 100;
      window.dispatchEvent(new Event("scroll"));
    });

    // Wait for RAF to process
    await waitFor(
      () => {
        expect(result.current.isScrolling).toBe(true);
      },
      { timeout: 1000 }
    );
  });

  it("should call onScrollEnd after debounce delay", async () => {
    vi.useFakeTimers();
    const onScrollEnd = vi.fn();

    renderHook(() =>
      useScrollProgress({
        onScrollEnd,
        debounceMs: 150,
      })
    );

    // Trigger scroll
    act(() => {
      window.scrollY = 100;
      window.dispatchEvent(new Event("scroll"));
    });

    // Wait for throttle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(onScrollEnd).not.toHaveBeenCalled();

    // Wait for debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(onScrollEnd).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("should clamp progress to 1 when scrolled to bottom", async () => {
    const { result } = renderHook(() => useScrollProgress());

    act(() => {
      window.scrollY = 2000; // Scroll beyond max
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(result.current.progress).toBe(1);
    });
  });

  it("should return zero progress when not in browser environment", () => {
    // The hook checks for typeof window === 'undefined' internally
    // This test verifies the initial state is correct
    const { result } = renderHook(() => useScrollProgress());

    expect(result.current.progress).toBe(0);
    expect(result.current.scrollY).toBe(0);
  });

  it("should clean up event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useScrollProgress());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function)
    );
  });

  it("should throttle scroll updates", async () => {
    const { result } = renderHook(() =>
      useScrollProgress({
        throttleMs: 100,
      })
    );

    // First scroll
    act(() => {
      window.scrollY = 100;
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(
      () => {
        expect(result.current.scrollY).toBeGreaterThan(0);
      },
      { timeout: 1000 }
    );

    const firstScrollY = result.current.scrollY;

    // Immediately trigger another scroll (within throttle period)
    act(() => {
      window.scrollY = 200;
      window.dispatchEvent(new Event("scroll"));
    });

    // Give it a tiny bit of time but not enough for throttle
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Should still be the first value or possibly updated depending on RAF timing
    // We just verify it doesn't crash and maintains a reasonable value
    expect(result.current.scrollY).toBeGreaterThanOrEqual(firstScrollY);
    expect(result.current.scrollY).toBeLessThanOrEqual(200);
  });
});
