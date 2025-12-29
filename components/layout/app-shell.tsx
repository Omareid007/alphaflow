"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider, useAuth } from "@/components/providers/auth-provider";

const PUBLIC_PATHS = ["/login", "/signup"];

// Skeleton sidebar for loading state
function SidebarSkeleton() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
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
      <div className="flex min-h-screen">
        <SidebarSkeleton />
        <main className="flex-1 pl-64">
          <div className="min-h-screen p-6">
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

  // Authenticated pages - with sidebar
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pl-64">
        <div className="min-h-screen p-6">{children}</div>
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppContent>{children}</AppContent>
    </AuthProvider>
  );
}
