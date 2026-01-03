"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/utils/useDebounce";

const inputVariants = cva(
  "flex w-full rounded-md border bg-background text-sm ring-offset-background transition-all duration-fast ease-out-expo file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Robinhood-style with glow
        glow: "border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary focus-visible:shadow-glow-sm",
        // Glass style
        glass:
          "glass border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary/50",
        // Trading semantic
        gain: "border-gain/30 bg-gain/5 focus-visible:ring-gain focus-visible:border-gain focus-visible:shadow-glow-gain",
        loss: "border-loss/30 bg-loss/5 focus-visible:ring-loss focus-visible:border-loss focus-visible:shadow-glow-loss",
      },
      inputSize: {
        default: "h-10 px-3 py-2",
        sm: "h-8 px-2 py-1 text-xs",
        lg: "h-12 px-4 py-3",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  debounceMs?: number;
  onDebouncedChange?: (value: string) => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      value,
      onChange,
      debounceMs,
      onDebouncedChange,
      variant,
      inputSize,
      ...props
    },
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

    const inputClasses = cn(inputVariants({ variant, inputSize, className }));

    // If no debouncing features are used, render the simple version
    if (!debounceMs && !onDebouncedChange) {
      return (
        <input
          type={type}
          className={inputClasses}
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
        className={inputClasses}
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

/**
 * Floating label input wrapper for Robinhood-style inputs
 */
interface FloatingInputProps extends InputProps {
  label: string;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, id, className, ...props }, ref) => {
    // Always call useId hook (React hooks rules)
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(
      Boolean(props.value || props.defaultValue)
    );

    const isFloating = isFocused || hasValue;

    return (
      <div className="relative">
        <Input
          id={inputId}
          ref={ref}
          className={cn("peer pt-5 pb-1", className)}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            setHasValue(Boolean(e.target.value));
            props.onBlur?.(e);
          }}
          onChange={(e) => {
            setHasValue(Boolean(e.target.value));
            props.onChange?.(e);
          }}
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "absolute left-3 transition-all duration-fast ease-out-expo pointer-events-none text-muted-foreground",
            isFloating
              ? "top-1 text-xs text-primary"
              : "top-1/2 -translate-y-1/2 text-sm"
          )}
        >
          {label}
        </label>
      </div>
    );
  }
);
FloatingInput.displayName = "FloatingInput";

export { Input, inputVariants, FloatingInput };
