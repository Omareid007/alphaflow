"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal, Home } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode;
  }
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    aria-label="breadcrumb"
    className={cn("", className)}
    {...props}
  />
));
Breadcrumb.displayName = "Breadcrumb";

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<"ol">
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      "flex flex-wrap items-center gap-1 text-sm text-muted-foreground",
      className
    )}
    {...props}
  />
));
BreadcrumbList.displayName = "BreadcrumbList";

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1", className)}
    {...props}
  />
));
BreadcrumbItem.displayName = "BreadcrumbItem";

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean;
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      ref={ref}
      className={cn(
        "transition-colors duration-fast hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:rounded",
        className
      )}
      {...props}
    />
  );
});
BreadcrumbLink.displayName = "BreadcrumbLink";

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn("font-medium text-foreground", className)}
    {...props}
  />
));
BreadcrumbPage.displayName = "BreadcrumbPage";

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:size-3 text-muted-foreground/50", className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn(
      "flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary transition-colors",
      className
    )}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
);
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis";

/**
 * Animated breadcrumb with Robinhood-style transitions
 */
interface AnimatedBreadcrumbProps {
  items: Array<{
    href?: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
  className?: string;
  showHome?: boolean;
  maxItems?: number;
}

export function AnimatedBreadcrumb({
  items,
  className,
  showHome = true,
  maxItems = 4,
}: AnimatedBreadcrumbProps) {
  const prefersReducedMotion = useReducedMotion();

  // Always show home, first item, ellipsis (if needed), and last 2 items
  const visibleItems = React.useMemo(() => {
    if (items.length <= maxItems) return items;

    const first = items[0];
    const lastTwo = items.slice(-2);
    return [first, { label: "...", isEllipsis: true }, ...lastTwo];
  }, [items, maxItems]);

  const itemVariants = {
    initial: prefersReducedMotion ? {} : { opacity: 0, x: -8 },
    animate: prefersReducedMotion ? {} : { opacity: 1, x: 0 },
    exit: prefersReducedMotion ? {} : { opacity: 0, x: 8 },
  };

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {/* Home link */}
        {showHome && (
          <>
            <BreadcrumbItem>
              <motion.div
                initial={itemVariants.initial}
                animate={itemVariants.animate}
                transition={{ duration: 0.15, delay: 0 }}
              >
                <BreadcrumbLink
                  href="/home"
                  className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-secondary"
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Home</span>
                </BreadcrumbLink>
              </motion.div>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}

        {/* Breadcrumb items */}
        <AnimatePresence mode="popLayout">
          {visibleItems.map((item, index) => {
            const isLast = index === visibleItems.length - 1;
            const isEllipsis = "isEllipsis" in item && item.isEllipsis;

            return (
              <React.Fragment key={`${item.label}-${index}`}>
                <BreadcrumbItem>
                  <motion.div
                    variants={itemVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.15, delay: index * 0.05 }}
                    layout={!prefersReducedMotion}
                  >
                    {isEllipsis ? (
                      <BreadcrumbEllipsis />
                    ) : isLast ? (
                      <BreadcrumbPage className="flex items-center gap-1.5">
                        {'icon' in item && item.icon && (
                          <item.icon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        )}
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href={'href' in item ? item.href : undefined}
                        className="flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded-md hover:bg-secondary"
                      >
                        {'icon' in item && item.icon && (
                          <item.icon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        )}
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </motion.div>
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </React.Fragment>
            );
          })}
        </AnimatePresence>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * Compact breadcrumb for mobile - shows only current page with back button
 */
interface CompactBreadcrumbProps {
  currentPage: string;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function CompactBreadcrumb({
  currentPage,
  backHref,
  backLabel = "Back",
  className,
}: CompactBreadcrumbProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn("flex items-center gap-2", className)}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: -4 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {backHref && (
        <a
          href={backHref}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
          <span className="sr-only md:not-sr-only">{backLabel}</span>
        </a>
      )}
      <span className="font-medium text-foreground">{currentPage}</span>
    </motion.div>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
