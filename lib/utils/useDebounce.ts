/**
 * @fileoverview React hooks for debouncing values and callbacks.
 * Provides type-safe, cleanup-aware debouncing utilities for React 18+ and Next.js 14+.
 * @module lib/utils/useDebounce
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  debounce,
  type DebounceOptions,
  type DebouncedFunction,
} from "./debounce";

/**
 * Hook to debounce a value. Useful for search inputs, form validation,
 * and any scenario where you want to delay processing of rapidly changing values.
 *
 * @template T - The type of the value to debounce
 * @param value - The value to debounce
 * @param delay - The number of milliseconds to delay (default: 300)
 * @returns The debounced value
 *
 * @example
 * // Search input with API call
 * function SearchComponent() {
 *   const [searchTerm, setSearchTerm] = useState('');
 *   const debouncedSearch = useDebounce(searchTerm, 300);
 *
 *   useEffect(() => {
 *     if (debouncedSearch) {
 *       // Only called 300ms after user stops typing
 *       searchAPI(debouncedSearch);
 *     }
 *   }, [debouncedSearch]);
 *
 *   return (
 *     <input
 *       value={searchTerm}
 *       onChange={(e) => setSearchTerm(e.target.value)}
 *       placeholder="Search..."
 *     />
 *   );
 * }
 *
 * @example
 * // Form validation
 * function EmailInput() {
 *   const [email, setEmail] = useState('');
 *   const debouncedEmail = useDebounce(email, 500);
 *   const [isValid, setIsValid] = useState<boolean | null>(null);
 *
 *   useEffect(() => {
 *     if (debouncedEmail) {
 *       setIsValid(validateEmail(debouncedEmail));
 *     }
 *   }, [debouncedEmail]);
 *
 *   return (
 *     <div>
 *       <input
 *         type="email"
 *         value={email}
 *         onChange={(e) => setEmail(e.target.value)}
 *       />
 *       {isValid === false && <span>Invalid email</span>}
 *     </div>
 *   );
 * }
 *
 * @example
 * // Trading symbol lookup
 * function SymbolSearch() {
 *   const [symbol, setSymbol] = useState('');
 *   const debouncedSymbol = useDebounce(symbol.toUpperCase(), 200);
 *
 *   const { data: quote } = useQuery({
 *     queryKey: ['quote', debouncedSymbol],
 *     queryFn: () => fetchQuote(debouncedSymbol),
 *     enabled: debouncedSymbol.length >= 1,
 *   });
 *
 *   return <input value={symbol} onChange={(e) => setSymbol(e.target.value)} />;
 * }
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Options for the useDebouncedCallback hook
 */
export interface UseDebouncedCallbackOptions extends DebounceOptions {
  /**
   * Maximum time to wait before the callback is invoked regardless of activity.
   * Useful for ensuring the callback eventually fires even with continuous activity.
   */
  maxWait?: number;
}

/**
 * Hook to create a debounced version of a callback function.
 * The debounced callback will only be invoked after `delay` milliseconds
 * have elapsed since the last call. Includes cancel and flush methods.
 *
 * @template T - The type of the callback function
 * @param callback - The callback function to debounce
 * @param delay - The number of milliseconds to delay (default: 300)
 * @param options - Configuration options for leading/trailing edge execution
 * @returns A debounced version of the callback with cancel and flush methods
 *
 * @example
 * // Basic debounced callback
 * function SearchForm() {
 *   const handleSearch = useDebouncedCallback((query: string) => {
 *     console.log('Searching for:', query);
 *     // API call here
 *   }, 300);
 *
 *   return (
 *     <input
 *       onChange={(e) => handleSearch(e.target.value)}
 *       placeholder="Search..."
 *     />
 *   );
 * }
 *
 * @example
 * // With cancel on unmount (automatic)
 * function AutoSaveForm() {
 *   const [content, setContent] = useState('');
 *
 *   const saveContent = useDebouncedCallback(
 *     async (text: string) => {
 *       await saveToServer(text);
 *     },
 *     1000,
 *     { trailing: true }
 *   );
 *
 *   return (
 *     <textarea
 *       value={content}
 *       onChange={(e) => {
 *         setContent(e.target.value);
 *         saveContent(e.target.value);
 *       }}
 *     />
 *   );
 * }
 *
 * @example
 * // With flush for form submission
 * function CommentForm() {
 *   const [comment, setComment] = useState('');
 *
 *   const validateComment = useDebouncedCallback((text: string) => {
 *     return text.length >= 10 && text.length <= 500;
 *   }, 200);
 *
 *   const handleSubmit = () => {
 *     // Flush any pending validation before submitting
 *     validateComment.flush();
 *     submitComment(comment);
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <textarea
 *         value={comment}
 *         onChange={(e) => {
 *           setComment(e.target.value);
 *           validateComment(e.target.value);
 *         }}
 *       />
 *       <button type="submit">Submit</button>
 *     </form>
 *   );
 * }
 *
 * @example
 * // Leading edge execution for immediate feedback
 * function QuickAction() {
 *   const handleClick = useDebouncedCallback(
 *     () => {
 *       performAction();
 *     },
 *     500,
 *     { leading: true, trailing: false }
 *   );
 *
 *   return <button onClick={handleClick}>Click Me</button>;
 * }
 *
 * @example
 * // Trading order validation
 * function OrderForm() {
 *   const validateOrder = useDebouncedCallback(
 *     async (symbol: string, quantity: number) => {
 *       const validation = await validateOrderApi(symbol, quantity);
 *       setValidationResult(validation);
 *     },
 *     250
 *   );
 *
 *   return (
 *     <form>
 *       <input
 *         name="symbol"
 *         onChange={(e) => validateOrder(e.target.value, quantity)}
 *       />
 *       <input
 *         name="quantity"
 *         type="number"
 *         onChange={(e) => validateOrder(symbol, Number(e.target.value))}
 *       />
 *     </form>
 *   );
 * }
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300,
  options: UseDebouncedCallbackOptions = {}
): DebouncedFunction<T> {
  // Store the callback in a ref to avoid recreating the debounced function
  // when only the callback changes (closure captures the ref)
  const callbackRef = useRef<T>(callback);

  // Update the ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create the debounced function only when delay or options change
  // We extract individual options to avoid object reference issues
  const { leading, trailing } = options;
  const debouncedFn = useMemo(() => {
    const fn = (...args: Parameters<T>) => {
      return callbackRef.current(...args);
    };

    return debounce(fn as T, delay, { leading, trailing });
  }, [delay, leading, trailing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedFn.cancel();
    };
  }, [debouncedFn]);

  return debouncedFn;
}

/**
 * Hook to get a stable debounced callback that doesn't change between renders.
 * Useful when the callback needs to be passed as a prop or used in dependencies.
 *
 * @template T - The type of the callback function
 * @param callback - The callback function to debounce
 * @param delay - The number of milliseconds to delay (default: 300)
 * @param deps - Dependencies array that will trigger recreation of the debounced function
 * @param options - Configuration options for leading/trailing edge execution
 * @returns A stable debounced version of the callback
 *
 * @example
 * // Stable callback for child components
 * function ParentComponent() {
 *   const [searchResults, setSearchResults] = useState([]);
 *
 *   const handleSearch = useStableDebouncedCallback(
 *     async (query: string) => {
 *       const results = await searchAPI(query);
 *       setSearchResults(results);
 *     },
 *     300,
 *     [setSearchResults]
 *   );
 *
 *   return <ChildComponent onSearch={handleSearch} />;
 * }
 *
 * @example
 * // With dependencies
 * function FilteredList({ filters }: { filters: Filters }) {
 *   const fetchFiltered = useStableDebouncedCallback(
 *     (query: string) => {
 *       fetchData({ ...filters, query });
 *     },
 *     300,
 *     [filters] // Recreate when filters change
 *   );
 *
 *   return <SearchInput onSearch={fetchFiltered} />;
 * }
 */
export function useStableDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300,
  deps: React.DependencyList = [],
  options: UseDebouncedCallbackOptions = {}
): DebouncedFunction<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedCallback = useCallback(callback, deps);

  return useDebouncedCallback(memoizedCallback, delay, options);
}

/**
 * Hook that returns both the debounced value and a function to immediately update it.
 * Useful when you need both debounced behavior and the ability to bypass debouncing.
 *
 * @template T - The type of the value
 * @param initialValue - The initial value
 * @param delay - The number of milliseconds to delay (default: 300)
 * @returns A tuple of [debouncedValue, setValue, setImmediately, pending]
 *
 * @example
 * // Search with immediate clear
 * function SearchWithClear() {
 *   const [debouncedValue, setValue, setImmediately, pending] = useDebouncedState('', 300);
 *
 *   return (
 *     <div>
 *       <input
 *         onChange={(e) => setValue(e.target.value)}
 *         placeholder="Search..."
 *       />
 *       <button onClick={() => setImmediately('')}>Clear</button>
 *       {pending && <span>Searching...</span>}
 *       <Results query={debouncedValue} />
 *     </div>
 *   );
 * }
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
): [
  debouncedValue: T,
  setValue: (value: T) => void,
  setImmediately: (value: T) => void,
  pending: boolean,
] {
  const [value, setValueInternal] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const [pending, setPending] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValue = useCallback(
    (newValue: T) => {
      setValueInternal(newValue);
      setPending(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(newValue);
        setPending(false);
      }, delay);
    },
    [delay]
  );

  const setImmediately = useCallback((newValue: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setValueInternal(newValue);
    setDebouncedValue(newValue);
    setPending(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [debouncedValue, setValue, setImmediately, pending];
}
