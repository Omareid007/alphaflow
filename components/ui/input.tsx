"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/utils/useDebounce";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  debounceMs?: number;
  onDebouncedChange?: (value: string) => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, value, onChange, debounceMs, onDebouncedChange, ...props }, ref) => {
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
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
Input.displayName = "Input";

export { Input };
