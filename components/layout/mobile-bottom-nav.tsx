"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Home,
  Layers,
  Plus,
  PieChart,
  Brain,
} from "lucide-react";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

/**
 * Primary navigation items for mobile bottom nav
 * Limited to 5 items for optimal mobile UX
 */
const mobileNavItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/strategies", label: "Strategies", icon: Layers },
  { href: "/create", label: "Create", icon: Plus, isPrimary: true },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/ai", label: "AI Pulse", icon: Brain },
];

interface MobileBottomNavProps {
  className?: string;
}

/**
 * Robinhood-style floating bottom navigation for mobile devices
 * Shows only on mobile (md:hidden) with glassmorphism effect
 */
export function MobileBottomNav({ className }: MobileBottomNavProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render on login/auth pages
  if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
    return null;
  }

  if (!mounted) {
    return null;
  }

  return (
    <motion.nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "pb-safe", // Safe area for iOS
        className
      )}
      initial={prefersReducedMotion ? { opacity: 1 } : { y: 100, opacity: 0 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Mobile navigation"
    >
      {/* Gradient fade above nav */}
      <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      {/* Navigation bar */}
      <div className="mx-3 mb-3 glass rounded-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-around px-2 py-2">
          {mobileNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                isPrimary={item.isPrimary}
                prefersReducedMotion={prefersReducedMotion}
              />
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  isPrimary?: boolean;
  prefersReducedMotion: boolean;
}

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  isPrimary,
  prefersReducedMotion,
}: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-colors",
        "min-w-[64px]",
        isPrimary
          ? "text-primary-foreground"
          : isActive
          ? "text-primary"
          : "text-muted-foreground"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Primary action button (Create) has special styling */}
      {isPrimary ? (
        <motion.div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-glow-sm"
          whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </motion.div>
      ) : (
        <>
          {/* Active indicator dot */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                className="absolute -top-1 left-1/2 h-1 w-1 rounded-full bg-primary"
                initial={prefersReducedMotion ? {} : { scale: 0, x: "-50%" }}
                animate={prefersReducedMotion ? { x: "-50%" } : { scale: 1, x: "-50%" }}
                exit={prefersReducedMotion ? {} : { scale: 0, x: "-50%" }}
                transition={{ duration: 0.15 }}
              />
            )}
          </AnimatePresence>

          <motion.div
            whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
            className="flex flex-col items-center"
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                "text-[10px] font-medium mt-0.5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </motion.div>
        </>
      )}
    </Link>
  );
}

export default MobileBottomNav;
