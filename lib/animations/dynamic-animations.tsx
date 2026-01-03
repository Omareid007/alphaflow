"use client";

/**
 * Dynamic Animation Components
 *
 * Dynamically imports framer-motion-based animation components
 * to reduce bundle size on pages that don't need animations immediately.
 *
 * Framer Motion is ~30KB gzipped and can be deferred for admin pages.
 */

import dynamic from "next/dynamic";
import { ReactNode } from "react";

// Simple wrapper components for loading states (no animations)
function NoopWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Dynamically import heavy animation components
export const Confetti = dynamic(
  () => import("./confetti").then((mod) => ({ default: mod.Confetti })),
  {
    ssr: false,
    loading: () => null, // Confetti doesn't need loading state
  }
);

export const PageTransition = dynamic(
  () =>
    import("./page-transitions").then((mod) => ({
      default: mod.PageTransition,
    })),
  {
    ssr: false,
    loading: () => <></>,
  }
);

export const StaggerList = dynamic(
  () => import("./stagger").then((mod) => ({ default: mod.StaggerList })),
  {
    ssr: false,
    loading: () => <></>,
  }
);

export const StaggerItem = dynamic(
  () => import("./stagger").then((mod) => ({ default: mod.StaggerItem })),
  {
    ssr: false,
    loading: () => <></>,
  }
);

// Components are exported above with dynamic imports
// Types can be imported directly from their respective modules if needed
