"use client";

import { Menu, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMobileNav } from "./mobile-nav-context";

export function MobileHeader() {
  const { toggle } = useMobileNav();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <TrendingUp className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold">AlphaFlow</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label="Toggle navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
    </header>
  );
}
