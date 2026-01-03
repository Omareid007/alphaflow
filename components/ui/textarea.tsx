"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/utils/useDebounce";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Optional debounce delay in milliseconds.
   * When set, the onChange event will be debounced.
   */
  debounceMs?: number;
  /**
   * Optional callback that receives the debounced value.
   * Called after debounceMs milliseconds have elapsed since the last change.
   */
  onDebouncedChange?: (value: string) => void;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, value, onChange, debounceMs, onDebouncedChange, ...props },
    ref
  ) => {
    const [localValue, setLocalValue] = React.useState(value ?? "");
    const debouncedValue = useDebounce(localValue, debounceMs);

    // Update local value when prop changes
    React.useEffect(() => {
      if (value !== undefined) {
        setLocalValue(value);
      }
    }, [value]);

    // Call debounced callback
    React.useEffect(() => {
      if (onDebouncedChange && debouncedValue !== value) {
        onDebouncedChange(String(debouncedValue));
      }
    }, [debouncedValue, onDebouncedChange, value]);

    // If no debouncing features are used, render the simple version
    if (!debounceMs && !onDebouncedChange) {
      return (
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          value={value}
          onChange={onChange}
          {...props}
        />
      );
    }

    // Debounced version
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange?.(e);
        }}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
