"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { AuthProvider, useAuth } from "@/components/providers/auth-provider";

const PUBLIC_PATHS = ["/login", "/signup"];

// Skeleton sidebar for loading state (desktop only)
function SidebarSkeleton() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-border bg-card md:block">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-muted" />
          <div>
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-1 h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5"
            >
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

// Mobile header skeleton
function MobileHeaderSkeleton() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-8 w-8 animate-pulse rounded bg-muted" />
    </header>
  );
}

// Skeleton content for loading state
function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading } = useAuth();

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname?.startsWith(path));

  // Show skeleton layout during auth check (faster perceived load)
  if (isLoading) {
    // For public paths, show minimal loading
    if (pathname?.startsWith("/login") || pathname?.startsWith("/signup")) {
      return <>{children}</>;
    }
    // For authenticated pages, show skeleton layout
    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        <MobileHeaderSkeleton />
        <SidebarSkeleton />
        <main className="flex-1 pt-14 md:pt-0 md:pl-64 transition-[padding] duration-300">
          <div className="min-h-screen p-4 md:p-6">
            <PageSkeleton />
          </div>
        </main>
      </div>
    );
  }

  // Public pages (login, signup) - no sidebar
  if (isPublicPath) {
    return <>{children}</>;
  }

  // Authenticated pages - with responsive sidebar
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <MobileHeader />
      <Sidebar />
      <main className="flex-1 pt-14 pb-24 md:pt-0 md:pb-0 md:pl-64 transition-[padding] duration-300">
        <div className="min-h-screen p-4 md:p-6">{children}</div>
      </main>
      <MobileBottomNav />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MobileNavProvider>
        <AppContent>{children}</AppContent>
      </MobileNavProvider>
    </AuthProvider>
  );
}
