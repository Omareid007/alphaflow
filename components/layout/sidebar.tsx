"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/components/providers/auth-provider";
import { useMobileNav } from "./mobile-nav-context";

const navItems = [
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

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <TrendingUp className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">AlphaFlow</h1>
          <p className="text-xs text-muted-foreground">AI Trading Platform</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              role="menuitem"
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4 space-y-2">
        {mounted && user && (
          <div className="flex items-center gap-3 px-4 py-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <User className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground">
                {user.isAdmin ? "Admin" : "User"}
              </p>
            </div>
          </div>
        )}

        {mounted ? (
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
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3"
            disabled
          >
            <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
            <span className="text-muted-foreground">Theme</span>
          </Button>
        )}

        {mounted && user && (
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
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isOpen, close } = useMobileNav();

  return (
    <>
      {/* Desktop sidebar - hidden on mobile */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-border bg-card md:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar - Sheet overlay */}
      <Sheet open={isOpen} onOpenChange={close}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onNavClick={close} />
        </SheetContent>
      </Sheet>
    </>
  );
}
