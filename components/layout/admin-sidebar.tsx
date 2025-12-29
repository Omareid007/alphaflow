"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Shield,
  Server,
  Brain,
  Settings,
  ShoppingCart,
  Layers,
  Database,
  BarChart3,
  Flag,
  Target,
  RotateCw,
  Eye,
  Zap,
  Trophy,
  List,
  Users,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: Shield, exact: true },
  { href: "/admin/providers", label: "Providers & Budgets", icon: Server },
  { href: "/admin/llm-router", label: "LLM Router", icon: Brain },
  { href: "/admin/orchestrator", label: "Orchestrator", icon: Settings },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/positions", label: "Positions", icon: Layers },
  { href: "/admin/universe", label: "Universe", icon: Database },
  { href: "/admin/fundamentals", label: "Fundamentals", icon: BarChart3 },
  { href: "/admin/candidates", label: "Candidates", icon: Flag },
  { href: "/admin/enforcement", label: "Enforcement", icon: Shield },
  { href: "/admin/allocation", label: "Allocation", icon: Target },
  { href: "/admin/rebalancer", label: "Rebalancer", icon: RotateCw },
  { href: "/admin/observability", label: "Observability", icon: Eye },
  { href: "/admin/ai-arena", label: "AI Arena", icon: Zap },
  { href: "/admin/competition", label: "Competition", icon: Trophy },
  { href: "/admin/strategies", label: "Strategies", icon: List },
  { href: "/admin/users", label: "Users & Roles", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Admin Hub</h1>
            <p className="text-xs text-muted-foreground">Control Plane</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Back to Main App
          </Link>
        </div>
      </div>
    </aside>
  );
}
