/**
 * @fileoverview Debounce and throttle utilities for the AlphaFlow trading platform.
 * Provides generic, type-safe implementations with support for leading/trailing edge
 * execution, cancel, and flush methods.
 * @module lib/utils/debounce
 */

/**
 * Options for configuring debounce behavior
 */
export interface DebounceOptions {
  /**
   * Execute on the leading edge of the timeout.
   * If true, the function is invoked immediately on the first call.
   * @default false
   */
  leading?: boolean;

  /**
   * Execute on the trailing edge of the timeout.
   * If true, the function is invoked after the delay period.
   * @default true
   */
  trailing?: boolean;
}

/**
 * A debounced function wrapper with cancel and flush capabilities.
 * @template T - The type of the original function
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  /**
   * Call the debounced function
   */
  (...args: Parameters<T>): void;

  /**
   * Cancel any pending invocation
   */
  cancel: () => void;

  /**
   * Immediately invoke any pending invocation
   * @returns The result of the invoked function, or undefined if nothing was pending
   */
  flush: () => ReturnType<T> | undefined;

  /**
   * Check if there is a pending invocation
   * @returns True if there is a pending invocation
   */
  pending: () => boolean;
}

/**
 * Creates a debounced version of a function that delays invoking the function
 * until after `delay` milliseconds have elapsed since the last time it was invoked.
 *
 * @template T - The type of the function to debounce
 * @param fn - The function to debounce
 * @param delay - The number of milliseconds to delay (default: 300)
 * @param options - Configuration options for leading/trailing edge execution
 * @returns A debounced function with cancel and flush methods
 *
 * @example
 * // Basic usage - trailing edge (default)
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching for:', query);
 * }, 300);
 *
 * debouncedSearch('a');
 * debouncedSearch('ab');
 * debouncedSearch('abc'); // Only this call executes after 300ms
 *
 * @example
 * // Leading edge execution
 * const debouncedSave = debounce(
 *   (data: FormData) => saveToServer(data),
 *   500,
 *   { leading: true, trailing: false }
 * );
 *
 * debouncedSave(formData); // Executes immediately
 * debouncedSave(formData); // Ignored within 500ms window
 *
 * @example
 * // With cancel and flush
 * const debouncedValidate = debounce(validateForm, 200);
 *
 * debouncedValidate(formData);
 * debouncedValidate.cancel(); // Cancel pending validation
 *
 * debouncedValidate(formData);
 * debouncedValidate.flush(); // Execute immediately
 *
 * @example
 * // Form input validation
 * const validateEmail = debounce((email: string) => {
 *   return validateEmailFormat(email);
 * }, 300);
 *
 * inputElement.addEventListener('input', (e) => {
 *   validateEmail((e.target as HTMLInputElement).value);
 * });
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300,
  options: DebounceOptions = {}
): DebouncedFunction<T> {
  const { leading = false, trailing = true } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;
  let result: ReturnType<T> | undefined;
  let lastCallTime: number | undefined;
  let lastInvokeTime = 0;

  // Ensure at least one of leading or trailing is true
  const shouldInvokeLeading = leading;
  const shouldInvokeTrailing = trailing || !leading;

  function invokeFunc(time: number): ReturnType<T> {
    const args = lastArgs!;
    const thisArg = lastThis;

    lastArgs = null;
    lastThis = null;
    lastInvokeTime = time;
    result = fn.apply(thisArg, args) as ReturnType<T>;
    return result as ReturnType<T>;
  }

  function leadingEdge(time: number): void {
    lastInvokeTime = time;

    // Start the timer for the trailing edge
    timeoutId = setTimeout(timerExpired, delay);

    // Invoke the leading edge
    if (shouldInvokeLeading) {
      invokeFunc(time);
    }
  }

  function remainingWait(time: number): number {
    const timeSinceLastCall = time - (lastCallTime ?? 0);
    const timeWaiting = delay - timeSinceLastCall;
    return timeWaiting;
  }

  function shouldInvoke(time: number): boolean {
    const timeSinceLastCall = time - (lastCallTime ?? 0);
    const timeSinceLastInvoke = time - lastInvokeTime;

    // First call, or delay has passed, or system time went backwards
    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      timeSinceLastInvoke >= delay
    );
  }

  function timerExpired(): void {
    const time = Date.now();

    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }

    // Restart the timer
    timeoutId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time: number): void {
    timeoutId = null;

    // Only invoke if we have lastArgs (meaning debounced was called)
    if (shouldInvokeTrailing && lastArgs) {
      invokeFunc(time);
    }

    lastArgs = null;
    lastThis = null;
  }

  function cancel(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    lastInvokeTime = 0;
    lastArgs = null;
    lastCallTime = undefined;
    lastThis = null;
    timeoutId = null;
  }

  function flush(): ReturnType<T> | undefined {
    if (timeoutId === null) {
      return result;
    }

    const time = Date.now();
    trailingEdge(time);
    cancel();
    return result;
  }

  function pending(): boolean {
    return timeoutId !== null;
  }

  function debounced(this: unknown, ...args: Parameters<T>): void {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        leadingEdge(time);
        return;
      }
    }

    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, delay);
    }
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;

  return debounced;
}

/**
 * Options for configuring throttle behavior
 */
export interface ThrottleOptions {
  /**
   * Execute on the leading edge.
   * @default true
   */
  leading?: boolean;

  /**
   * Execute on the trailing edge.
   * @default true
   */
  trailing?: boolean;
}

/**
 * Creates a throttled version of a function that only invokes the function
 * at most once per `limit` milliseconds.
 *
 * @template T - The type of the function to throttle
 * @param fn - The function to throttle
 * @param limit - The number of milliseconds to wait between invocations (default: 300)
 * @param options - Configuration options for leading/trailing edge execution
 * @returns A throttled function with cancel and flush methods
 *
 * @example
 * // Basic usage - invokes at most once per 300ms
 * const throttledScroll = throttle((e: Event) => {
 *   console.log('Scroll position:', window.scrollY);
 * }, 300);
 *
 * window.addEventListener('scroll', throttledScroll);
 *
 * @example
 * // Trading price updates - rate limit API calls
 * const throttledPriceUpdate = throttle(
 *   (symbol: string, price: number) => updatePriceDisplay(symbol, price),
 *   100
 * );
 *
 * @example
 * // With options
 * const throttledResize = throttle(
 *   () => recalculateLayout(),
 *   200,
 *   { leading: true, trailing: true }
 * );
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number = 300,
  options: ThrottleOptions = {}
): DebouncedFunction<T> {
  const { leading = true, trailing = true } = options;

  // Throttle is essentially debounce with leading edge and maxWait
  return debounce(fn, limit, { leading, trailing });
}
