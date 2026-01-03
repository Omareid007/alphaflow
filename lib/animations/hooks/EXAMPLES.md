# Animation Hooks & Components - Usage Examples

Complete examples for using the animation library in AlphaFlow.

## Table of Contents

1. [useScrollProgress Hook](#usescrollprogress-hook)
2. [ScrollParallax Component](#scrollparallax-component)
3. [ScrollReveal Component](#scrollreveal-component)
4. [Combined Examples](#combined-examples)

---

## useScrollProgress Hook

### 1. Reading Progress Indicator

```tsx
import { useScrollProgress } from "@/lib/animations";

export function BlogPostProgress() {
  const { progress } = useScrollProgress();

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-1 bg-gradient-to-r from-primary to-primary/50">
        <div
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
```

### 2. Scroll-to-Top Button

```tsx
import { useScrollProgress } from "@/lib/animations";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export function ScrollToTopButton() {
  const { progress, scrollY } = useScrollProgress();

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Show button when scrolled past 20%
  const showButton = progress > 0.2;

  return (
    <AnimatePresence>
      {showButton && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed bottom-8 right-8 z-40"
        >
          <Button
            onClick={handleScrollToTop}
            size="icon"
            variant="secondary"
            className="rounded-full shadow-lg"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### 3. Dynamic Header with Scroll

```tsx
import { useScrollProgress } from "@/lib/animations";
import { cn } from "@/lib/utils";

export function DynamicHeader() {
  const { scrollY, isScrolling } = useScrollProgress();

  // Change header style after scrolling 100px
  const isScrolled = scrollY > 100;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b"
          : "bg-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <h1
            className={cn(
              "font-bold transition-all duration-300",
              isScrolled ? "text-lg" : "text-xl"
            )}
          >
            AlphaFlow
          </h1>
        </div>

        {isScrolling && (
          <div className="text-xs text-muted-foreground">Scrolling...</div>
        )}
      </div>
    </header>
  );
}
```

### 4. Infinite Scroll with Load More

```tsx
import { useScrollProgress } from "@/lib/animations";
import { useEffect } from "react";

export function InfiniteScrollList({ onLoadMore }: { onLoadMore: () => void }) {
  const { progress } = useScrollProgress({
    onScrollEnd: () => {
      // Trigger load more when user scrolls past 90% and stops
      if (progress > 0.9) {
        onLoadMore();
      }
    },
    debounceMs: 300,
  });

  return (
    <div>
      {/* Your list content */}

      {progress > 0.8 && (
        <div className="py-8 text-center">
          <div className="text-sm text-muted-foreground">Loading more...</div>
        </div>
      )}
    </div>
  );
}
```

### 5. Progress-driven Animations

```tsx
import { useScrollProgress } from "@/lib/animations";
import { motion, useTransform, useSpring } from "framer-motion";

export function ProgressDrivenStats() {
  const { progress } = useScrollProgress();

  // Animate value from 0 to 100 based on scroll
  const count = useSpring(progress * 100, {
    stiffness: 100,
    damping: 30,
  });

  return (
    <div className="grid grid-cols-3 gap-8">
      <motion.div
        className="text-center"
        style={{ opacity: progress * 2 }} // Fade in
      >
        <div className="text-4xl font-bold">
          {Math.round(count.get())}%
        </div>
        <div className="text-sm text-muted-foreground">Complete</div>
      </motion.div>
    </div>
  );
}
```

---

## ScrollParallax Component

### 1. Hero Section with Parallax Background

```tsx
import { ScrollParallax } from "@/lib/animations";

export function ParallaxHero() {
  return (
    <div className="relative h-screen overflow-hidden">
      {/* Slow-moving background */}
      <ScrollParallax speed={0.3} className="absolute inset-0 -z-10">
        <div className="h-[120vh] bg-gradient-to-b from-primary/20 to-background" />
      </ScrollParallax>

      {/* Medium-speed layer */}
      <ScrollParallax speed={0.5} className="absolute inset-0 -z-5">
        <div className="h-[110vh] flex items-center justify-center">
          <div className="text-9xl font-bold text-primary/10">TRADE</div>
        </div>
      </ScrollParallax>

      {/* Normal speed content */}
      <div className="relative z-10 h-full flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold">AlphaFlow</h1>
          <p className="mt-4 text-xl text-muted-foreground">
            Automated Trading Platform
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 2. Multi-layer Parallax

```tsx
import { ScrollParallax } from "@/lib/animations";

export function MultiLayerParallax() {
  return (
    <div className="relative min-h-screen">
      {/* Background layer - slowest */}
      <ScrollParallax speed={0.2} className="absolute inset-0 -z-30">
        <div className="h-[150vh] bg-[url('/mountains.jpg')] bg-cover" />
      </ScrollParallax>

      {/* Middle layer */}
      <ScrollParallax speed={0.4} className="absolute inset-0 -z-20">
        <div className="h-[130vh] bg-[url('/trees.png')] bg-cover" />
      </ScrollParallax>

      {/* Foreground layer */}
      <ScrollParallax speed={0.6} className="absolute inset-0 -z-10">
        <div className="h-[120vh] bg-[url('/grass.png')] bg-cover" />
      </ScrollParallax>

      {/* Content - normal speed */}
      <div className="relative z-10 py-20">
        <div className="container">
          <h2 className="text-4xl font-bold">Your Content Here</h2>
        </div>
      </div>
    </div>
  );
}
```

### 3. Reverse Parallax (Down Direction)

```tsx
import { ScrollParallax } from "@/lib/animations";

export function ReverseParallax() {
  return (
    <div className="relative py-20">
      <ScrollParallax speed={0.3} direction="down" className="absolute -top-20 left-0 right-0 -z-10">
        <div className="text-center text-9xl font-bold text-primary/5">
          UP
        </div>
      </ScrollParallax>

      <div className="container">
        <p className="text-xl">
          The text above moves down as you scroll up, creating a reverse effect.
        </p>
      </div>
    </div>
  );
}
```

---

## ScrollReveal Component

### 1. Fade In On Scroll

```tsx
import { ScrollReveal } from "@/lib/animations";

export function FadeInSections() {
  return (
    <div className="space-y-20 py-20">
      <ScrollReveal>
        <div className="container">
          <h2 className="text-3xl font-bold">Section 1</h2>
          <p className="mt-4 text-muted-foreground">
            This content fades in when you scroll to it.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.2}>
        <div className="container">
          <h2 className="text-3xl font-bold">Section 2</h2>
          <p className="mt-4 text-muted-foreground">
            This one has a slight delay.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.4}>
        <div className="container">
          <h2 className="text-3xl font-bold">Section 3</h2>
          <p className="mt-4 text-muted-foreground">
            Even more delay for a staggered effect.
          </p>
        </div>
      </ScrollReveal>
    </div>
  );
}
```

### 2. Feature Cards Grid

```tsx
import { ScrollReveal } from "@/lib/animations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  { title: "Automated Trading", description: "Set it and forget it" },
  { title: "Real-time Analytics", description: "Live market insights" },
  { title: "Risk Management", description: "Smart position sizing" },
  { title: "Backtesting", description: "Test before you trade" },
];

export function FeatureGrid() {
  return (
    <div className="container py-20">
      <h2 className="text-4xl font-bold text-center mb-12">Features</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, index) => (
          <ScrollReveal
            key={feature.title}
            delay={index * 0.1}
            threshold={0.3}
          >
            <Card variant="elevated" hover="lift">
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
```

### 3. Progressive Content Reveal

```tsx
import { ScrollReveal } from "@/lib/animations";

export function ProgressiveStory() {
  return (
    <div className="max-w-2xl mx-auto py-20 space-y-16">
      <ScrollReveal threshold={0.5}>
        <div>
          <h2 className="text-3xl font-bold mb-4">Chapter 1: The Beginning</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit...
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal threshold={0.5} delay={0.2}>
        <div>
          <h2 className="text-3xl font-bold mb-4">Chapter 2: The Journey</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Sed do eiusmod tempor incididunt ut labore et dolore magna...
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal threshold={0.5} delay={0.4}>
        <div>
          <h2 className="text-3xl font-bold mb-4">Chapter 3: The Result</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Ut enim ad minim veniam, quis nostrud exercitation ullamco...
          </p>
        </div>
      </ScrollReveal>
    </div>
  );
}
```

---

## Combined Examples

### 1. Complete Landing Page

```tsx
import { useScrollProgress, ScrollParallax, ScrollReveal } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  const { scrollY } = useScrollProgress();
  const isScrolled = scrollY > 50;

  return (
    <div>
      {/* Dynamic Header */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled && "bg-background/80 backdrop-blur border-b"
        )}
      >
        <div className="container h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold">AlphaFlow</h1>
          <Button>Get Started</Button>
        </div>
      </header>

      {/* Hero with Parallax */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <ScrollParallax speed={0.3} className="absolute inset-0 -z-10">
          <div className="h-[120vh] bg-gradient-to-br from-primary/20 via-background to-primary/10" />
        </ScrollParallax>

        <div className="container text-center">
          <h1 className="text-6xl font-bold mb-6">
            The Future of Trading
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Automated strategies powered by AI
          </p>
          <Button size="lg">Start Trading</Button>
        </div>
      </section>

      {/* Features with Scroll Reveal */}
      <section className="py-20">
        <div className="container">
          <ScrollReveal>
            <h2 className="text-4xl font-bold text-center mb-12">
              Why Choose AlphaFlow?
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            {[1, 2, 3].map((i) => (
              <ScrollReveal key={i} delay={i * 0.1} threshold={0.3}>
                <div className="p-6 border rounded-lg">
                  <h3 className="text-2xl font-semibold mb-4">Feature {i}</h3>
                  <p className="text-muted-foreground">
                    Description of feature {i}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA with Parallax */}
      <section className="relative py-32 overflow-hidden">
        <ScrollParallax speed={0.4} className="absolute inset-0 -z-10">
          <div className="h-[120vh] bg-primary/5" />
        </ScrollParallax>

        <ScrollReveal>
          <div className="container text-center">
            <h2 className="text-4xl font-bold mb-6">
              Ready to Transform Your Trading?
            </h2>
            <Button size="lg">Get Started Now</Button>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
```

### 2. Portfolio Page with Progress Tracking

```tsx
import { useScrollProgress, ScrollReveal } from "@/lib/animations";
import { Card } from "@/components/ui/card";

export function PortfolioShowcase() {
  const { progress } = useScrollProgress();

  return (
    <div>
      {/* Progress Indicator */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Portfolio Items */}
      <div className="container py-20 space-y-32">
        {[1, 2, 3, 4, 5].map((project) => (
          <ScrollReveal key={project} threshold={0.4}>
            <Card className="overflow-hidden">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="aspect-video bg-muted" />
                <div className="p-8 flex flex-col justify-center">
                  <h3 className="text-3xl font-bold mb-4">
                    Project {project}
                  </h3>
                  <p className="text-muted-foreground">
                    Details about project {project}
                  </p>
                </div>
              </div>
            </Card>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
```

### 3. Dashboard with Scroll-based Animations

```tsx
import { useScrollProgress, ScrollReveal } from "@/lib/animations";
import { useReducedMotion } from "@/lib/animations";
import { motion } from "framer-motion";

export function DashboardView() {
  const { progress, isScrolling } = useScrollProgress();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div>
      {/* Stats that animate based on scroll */}
      <div className="sticky top-0 bg-background border-b z-40 p-4">
        <div className="container flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>

          {!prefersReducedMotion && isScrolling && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="text-sm text-muted-foreground"
            >
              {(progress * 100).toFixed(0)}% scrolled
            </motion.div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container py-8 space-y-8">
        <ScrollReveal>
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Overview</CardTitle>
            </CardHeader>
            <CardContent>{/* Chart */}</CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent>{/* Table */}</CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle>Active Strategies</CardTitle>
            </CardHeader>
            <CardContent>{/* Strategy list */}</CardContent>
          </Card>
        </ScrollReveal>
      </div>
    </div>
  );
}
```

---

## Performance Tips

1. **Use throttling wisely**: Default 16ms is good for 60fps. Increase to 32ms for 30fps if needed.
2. **Limit parallax layers**: 2-3 layers max for best performance.
3. **Use ScrollReveal threshold**: Higher threshold (0.5-0.8) means less frequent checks.
4. **Combine with useReducedMotion**: Always respect user preferences.
5. **Avoid heavy components**: Keep revealed components lightweight.

## Accessibility Reminders

- Always provide `useReducedMotion` fallbacks
- Ensure content is readable without animations
- Don't rely solely on scroll for critical interactions
- Test with keyboard navigation
- Maintain proper heading hierarchy regardless of scroll reveals
