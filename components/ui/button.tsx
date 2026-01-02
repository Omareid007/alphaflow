"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";
import { buttonPressVariants } from "@/lib/animations/presets";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

// Exclude conflicting drag handlers from React's ButtonHTMLAttributes
type SafeButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "onDrag"
  | "onDragEnd"
  | "onDragStart"
  | "onDragOver"
  | "onDragEnter"
  | "onDragLeave"
  | "onDrop"
>;

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-fast ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-glow-sm active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-glow-loss active:scale-[0.98]",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-primary/50 active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
        // Robinhood-style variants
        gain: "bg-gain text-primary-foreground hover:bg-gain/90 hover:shadow-glow-gain active:scale-[0.98]",
        loss: "bg-loss text-white hover:bg-loss/90 hover:shadow-glow-loss active:scale-[0.98]",
        glass:
          "glass hover:bg-card/90 hover:shadow-glow-sm border-white/10 active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-4 py-2 rounded-md",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10 rounded-md",
        // Robinhood pill shapes
        pill: "h-10 px-6 py-2 rounded-full",
        "pill-sm": "h-8 px-4 py-1.5 rounded-full text-xs",
        "pill-lg": "h-12 px-8 py-3 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends SafeButtonProps, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion();

    // Use asChild with Slot (no animations), otherwise use motion.button with animations
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      );
    }

    const variants = prefersReducedMotion ? {} : buttonPressVariants;

    // Filter out conflicting event handlers that clash with framer-motion's types
    const { onAnimationStart, onDrag, onDragEnd, onDragStart, ...safeProps } =
      props as Record<string, unknown>;

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        variants={variants}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        {...(safeProps as Omit<HTMLMotionProps<"button">, "ref">)}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
