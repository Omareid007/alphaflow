"use client";

import * as React from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "./hooks/useReducedMotion";

/**
 * Page transition variants
 */
export const pageVariants: Record<string, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  scaleDown: {
    initial: { opacity: 0, scale: 1.05 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
};

interface PageTransitionProps {
  children: React.ReactNode;
  variant?: keyof typeof pageVariants;
  duration?: number;
  className?: string;
}

/**
 * Wrapper for animating page content on mount
 */
export function PageTransition({
  children,
  variant = "slideUp",
  duration = 0.3,
  className,
}: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={pageVariants[variant]}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

interface RouteTransitionProps {
  children: React.ReactNode;
  variant?: keyof typeof pageVariants;
  duration?: number;
  mode?: "wait" | "sync" | "popLayout";
}

/**
 * Animate between route changes (requires AnimatePresence parent)
 * Note: Works best with Next.js App Router in layout.tsx
 */
export function RouteTransition({
  children,
  variant = "fade",
  duration = 0.2,
  mode = "wait",
}: RouteTransitionProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode={mode}>
      <motion.div
        key={pathname}
        variants={pageVariants[variant]}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          duration,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Section transition - for animating sections within a page
 */
interface SectionTransitionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function SectionTransition({
  children,
  delay = 0,
  className,
}: SectionTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Hero section animation with delayed content reveal
 */
interface HeroTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function HeroTransition({ children, className }: HeroTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scroll-driven parallax wrapper
 * @example
 * <ScrollParallax speed={0.5}>
 *   <div>Content moves at 50% scroll speed</div>
 * </ScrollParallax>
 */
interface ScrollParallaxProps {
  children: React.ReactNode;
  className?: string;
  speed?: number; // 0.5 = slower, 1.5 = faster than scroll
  direction?: "up" | "down";
}

export function ScrollParallax({
  children,
  className,
  speed = 0.5,
  direction = "up",
}: ScrollParallaxProps) {
  const prefersReducedMotion = useReducedMotion();
  const [offsetY, setOffsetY] = React.useState(0);

  React.useEffect(() => {
    if (prefersReducedMotion || typeof window === "undefined") {
      return;
    }

    const handleScroll = () => {
      setOffsetY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const transform =
    direction === "up"
      ? `translateY(${offsetY * speed}px)`
      : `translateY(-${offsetY * speed}px)`;

  return (
    <div className={className} style={{ transform }}>
      {children}
    </div>
  );
}

/**
 * Scroll-triggered reveal animation (alternative to AnimateOnScroll)
 */
interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  threshold?: number; // 0 to 1, how much of element visible before animating
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  threshold = 0.2,
}: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (prefersReducedMotion || typeof window === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [prefersReducedMotion, threshold]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Modal/Dialog transition
 */
interface ModalTransitionProps {
  children: React.ReactNode;
  isOpen: boolean;
  className?: string;
}

export function ModalTransition({
  children,
  isOpen,
  className,
}: ModalTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          {/* Modal content */}
          <motion.div
            className={className}
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, scale: 0.95, y: 10 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: 10 }
            }
            transition={{
              duration: 0.2,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default PageTransition;
