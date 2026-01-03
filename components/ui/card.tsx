"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { cardHoverVariants } from "@/lib/animations/presets";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

const cardVariants = cva(
  "rounded-lg text-card-foreground transition-all duration-normal ease-out-expo",
  {
    variants: {
      variant: {
        default: "border bg-card shadow-sm",
        // Robinhood-style glassmorphism
        glass: "glass shadow-glass",
        "glass-subtle": "glass-subtle",
        "glass-strong": "glass-strong shadow-glass",
        // Elevated card with glow
        elevated: "border bg-card shadow-card-hover",
        // Borderless minimal
        ghost: "bg-transparent",
        // Trading cards with semantic colors
        gain: "border-gain/20 bg-gain/5 shadow-glow-gain",
        loss: "border-loss/20 bg-loss/5 shadow-glow-loss",
      },
      hover: {
        none: "",
        lift: "hover-lift",
        glow: "hover:shadow-glow-sm hover:border-primary/30",
        scale: "hover:scale-[1.02] active:scale-[0.98]",
      },
    },
    defaultVariants: {
      variant: "default",
      hover: "none",
    },
  }
);

export interface CardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  disableAnimation?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, hover, disableAnimation = false, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion();

    const shouldAnimate = !disableAnimation && !prefersReducedMotion;
    const variants = shouldAnimate ? cardHoverVariants : {};

    if (!shouldAnimate) {
      return (
        <div
          ref={ref}
          className={cn(cardVariants({ variant, hover, className }))}
          {...props}
        />
      );
    }

    // Filter out conflicting event handlers that clash with framer-motion's types
    const { onAnimationStart, onDrag, onDragEnd, onDragStart, ...safeProps } =
      props as Record<string, unknown>;

    return (
      <motion.div
        ref={ref}
        className={cn(cardVariants({ variant, hover, className }))}
        variants={variants}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        {...(safeProps as Omit<HTMLMotionProps<"div">, "ref">)}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  cardVariants,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
