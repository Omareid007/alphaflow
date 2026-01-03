import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { RootErrorBoundary } from "@/components/error-boundaries";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AlphaFlow - AI Trading Platform",
  description: "Create, backtest, and deploy AI-powered trading strategies",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Skip to content link for keyboard navigation (WCAG 2.1 AA) */}
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <RootErrorBoundary>
              <AppShell>{children}</AppShell>
            </RootErrorBoundary>
            <Toaster />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
