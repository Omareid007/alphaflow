"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "./hooks/useReducedMotion";

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  scale: number;
  shape: "circle" | "square" | "triangle";
}

const COLORS = [
  "hsl(var(--gain))",
  "hsl(var(--primary))",
  "#FFD700",
  "#00CED1",
  "#FF69B4",
  "#9370DB",
];

const SHAPES = ["circle", "square", "triangle"] as const;

function generateParticles(count: number, originX: number, originY: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: originX + (Math.random() - 0.5) * 20,
    y: originY,
    rotation: Math.random() * 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    scale: 0.5 + Math.random() * 0.5,
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
  }));
}

interface ConfettiProps {
  active: boolean;
  count?: number;
  duration?: number;
  originX?: number;
  originY?: number;
  spread?: number;
  className?: string;
}

/**
 * Confetti explosion animation for celebrations (order fills, achievements)
 */
export function Confetti({
  active,
  count = 50,
  duration = 2000,
  originX = 50,
  originY = 50,
  spread = 300,
  className,
}: ConfettiProps) {
  const prefersReducedMotion = useReducedMotion();
  const [particles, setParticles] = React.useState<Particle[]>([]);

  React.useEffect(() => {
    if (active && !prefersReducedMotion) {
      setParticles(generateParticles(count, originX, originY));
      const timer = setTimeout(() => setParticles([]), duration);
      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [active, count, duration, originX, originY, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 9999,
      }}
    >
      <AnimatePresence>
        {particles.map((particle) => {
          const endX = particle.x + (Math.random() - 0.5) * spread;
          const endY = particle.y + Math.random() * spread + 100;

          return (
            <motion.div
              key={particle.id}
              initial={{
                x: `${particle.x}%`,
                y: `${particle.y}%`,
                scale: 0,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                x: `${endX}%`,
                y: `${endY}%`,
                scale: particle.scale,
                rotate: particle.rotation + Math.random() * 720,
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: duration / 1000,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                position: "absolute",
                width: particle.shape === "triangle" ? 0 : 8,
                height: particle.shape === "triangle" ? 0 : 8,
                backgroundColor: particle.shape === "triangle" ? "transparent" : particle.color,
                borderRadius: particle.shape === "circle" ? "50%" : 0,
                borderLeft:
                  particle.shape === "triangle" ? "4px solid transparent" : undefined,
                borderRight:
                  particle.shape === "triangle" ? "4px solid transparent" : undefined,
                borderBottom:
                  particle.shape === "triangle" ? `8px solid ${particle.color}` : undefined,
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/**
 * Hook for triggering confetti on demand
 */
export function useConfetti() {
  const [isActive, setIsActive] = React.useState(false);

  const trigger = React.useCallback(() => {
    setIsActive(true);
    // Auto-reset after animation
    setTimeout(() => setIsActive(false), 2500);
  }, []);

  return { isActive, trigger };
}

export default Confetti;
