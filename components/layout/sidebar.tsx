"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Home,
  Layers,
  Plus,
  PieChart,
  History,
  BookOpen,
  Brain,
  FlaskConical,
  Settings,
  Moon,
  Sun,
  TrendingUp,
  ShieldCheck,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/components/providers/auth-provider";
import { useMobileNav } from "./mobile-nav-context";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

export const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/strategies", label: "Strategies", icon: Layers },
  { href: "/create", label: "Create", icon: Plus },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/backtests", label: "Backtests", icon: History },
  { href: "/ledger", label: "Ledger", icon: BookOpen },
  { href: "/ai", label: "AI Pulse", icon: Brain },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin Hub", icon: ShieldCheck },
];

// Persist collapsed state in localStorage
const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

function usePersistedCollapsed() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setIsCollapsed(value);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
  }, []);

  return [isCollapsed, setCollapsed] as const;
}

interface SidebarContentProps {
  onNavClick?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  showCollapseButton?: boolean;
}

function SidebarContent({
  onNavClick,
  isCollapsed = false,
  onToggleCollapse,
  showCollapseButton = false,
}: SidebarContentProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const handleLogout = useCallback(() => {
    logout();
    onNavClick?.();
  }, [logout, onNavClick]);

  const animationProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: -10 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -10 },
        transition: { duration: 0.15 },
      };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-border/50",
            isCollapsed ? "justify-center px-2" : "gap-3 px-6"
          )}
        >
          <motion.div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-glow-sm"
            whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
          >
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </motion.div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div {...animationProps}>
                <h1 className="text-lg font-semibold tracking-tight">
                  AlphaFlow
                </h1>
                <p className="text-xs text-muted-foreground">
                  AI Trading Platform
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav
          className={cn("flex-1 space-y-1", isCollapsed ? "p-2" : "p-4")}
          aria-label="Main navigation"
        >
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                role="menuitem"
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex items-center rounded-xl text-sm font-medium transition-all duration-fast",
                  isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2.5",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-glow-sm"
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 transition-transform duration-fast",
                    !isActive && "group-hover:scale-110"
                  )}
                  aria-hidden="true"
                />
                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span {...animationProps}>{item.label}</motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );

            // Wrap in tooltip when collapsed
            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "border-t border-border/50 space-y-2",
            isCollapsed ? "p-2" : "p-4"
          )}
        >
          {/* User info */}
          {mounted && user && !isCollapsed && (
            <motion.div
              className="flex items-center gap-3 px-4 py-2 text-sm"
              {...animationProps}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                <User className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.username}</p>
                <p className="text-xs text-muted-foreground">
                  {user.isAdmin ? "Admin" : "User"}
                </p>
              </div>
            </motion.div>
          )}

          {/* Collapsed user avatar */}
          {mounted && user && isCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center py-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                    <User className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{user.username}</p>
                <p className="text-xs text-muted-foreground">
                  {user.isAdmin ? "Admin" : "User"}
                </p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Theme toggle */}
          {mounted ? (
            isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full"
                    onClick={handleThemeToggle}
                    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Moon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-3"
                onClick={handleThemeToggle}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4 w-4" aria-hidden="true" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" aria-hidden="true" />
                    Dark Mode
                  </>
                )}
              </Button>
            )
          ) : (
            <Button
              variant="ghost"
              size={isCollapsed ? "icon" : "sm"}
              className={cn(!isCollapsed && "w-full justify-start gap-3")}
              disabled
            >
              <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
              {!isCollapsed && (
                <span className="text-muted-foreground">Theme</span>
              )}
            </Button>
          )}

          {/* Logout */}
          {mounted &&
            user &&
            (isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full text-muted-foreground hover:text-destructive"
                    onClick={handleLogout}
                    aria-label="Sign out of your account"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                onClick={handleLogout}
                aria-label="Sign out of your account"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign Out
              </Button>
            ))}

          {/* Collapse toggle button */}
          {showCollapseButton && (
            <Button
              variant="ghost"
              size={isCollapsed ? "icon" : "sm"}
              className={cn(
                "w-full text-muted-foreground hover:text-foreground",
                !isCollapsed && "justify-start gap-3"
              )}
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Collapse
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function Sidebar() {
  const { isOpen, close } = useMobileNav();
  const [isCollapsed, setCollapsed] = usePersistedCollapsed();
  const prefersReducedMotion = useReducedMotion();

  const toggleCollapse = useCallback(() => {
    setCollapsed(!isCollapsed);
  }, [isCollapsed, setCollapsed]);

  return (
    <>
      {/* Desktop sidebar - hidden on mobile */}
      <motion.aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen border-r border-border/50 bg-card/95 backdrop-blur-sm md:block",
          "transition-[width] duration-normal ease-out-expo"
        )}
        animate={{
          width: isCollapsed ? 72 : 256,
        }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
        }
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
          showCollapseButton
        />
      </motion.aside>

      {/* Mobile sidebar - Sheet overlay */}
      <Sheet open={isOpen} onOpenChange={close}>
        <SheetContent
          side="left"
          className="w-64 p-0 bg-card/95 backdrop-blur-sm"
        >
          <SidebarContent onNavClick={close} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export default Sidebar;
