"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-fast ease-out-expo focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border",
        // Robinhood trading semantic variants
        gain: "border-transparent bg-gain text-primary-foreground hover:bg-gain/80",
        loss: "border-transparent bg-loss text-white hover:bg-loss/80",
        "gain-subtle": "border-gain/30 bg-gain/10 text-gain",
        "loss-subtle": "border-loss/30 bg-loss/10 text-loss",
        // Market status badges
        "market-open":
          "border-transparent bg-market-open text-primary-foreground",
        "market-closed": "border-transparent bg-market-closed text-white",
        "market-extended":
          "border-transparent bg-market-extended text-primary-foreground",
        // Glass style
        glass: "glass border-white/10 text-foreground",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
      animate: {
        none: "",
        pulse: "",
        glow: "",
      },
    },
    compoundVariants: [
      {
        variant: "gain",
        animate: "pulse",
        className: "animate-pulse-gain",
      },
      {
        variant: "loss",
        animate: "pulse",
        className: "animate-pulse-loss",
      },
      {
        variant: "gain",
        animate: "glow",
        className: "shadow-glow-gain",
      },
      {
        variant: "loss",
        animate: "glow",
        className: "shadow-glow-loss",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      animate: "none",
    },
  }
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, animate, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size, animate }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
