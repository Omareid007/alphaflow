"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Moon,
  Sun,
  Monitor,
  Check,
  Sparkles,
  Zap,
  MinusCircle,
  BarChart3,
  LineChart,
  AreaChart,
  Palette,
  Play,
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  useUserPreferences,
  useUpdatePreferences,
  type ThemeValue,
  type AnimationLevel,
  type ChartStyle,
} from "@/lib/api/hooks/useUserPreferences";
import { Sparkline } from "@/components/charts/sparkline";

// Preset accent colors matching Robinhood style
const ACCENT_PRESETS = [
  { name: "Neon Green", color: "#00C805", description: "Robinhood classic" },
  { name: "Electric Blue", color: "#00A3FF", description: "Cool and modern" },
  {
    name: "Vibrant Purple",
    color: "#8B5CF6",
    description: "Bold and creative",
  },
  { name: "Sunset Orange", color: "#FF6B35", description: "Warm energy" },
  { name: "Hot Pink", color: "#EC4899", description: "Standout style" },
  { name: "Cyan", color: "#06B6D4", description: "Fresh and clean" },
];

// Theme options with icons
const THEME_OPTIONS: {
  value: ThemeValue;
  label: string;
  icon: typeof Moon;
  description: string;
}[] = [
  { value: "dark", label: "Dark", icon: Moon, description: "Easy on the eyes" },
  {
    value: "light",
    label: "Light",
    icon: Sun,
    description: "Classic bright mode",
  },
  {
    value: "system",
    label: "System",
    icon: Monitor,
    description: "Match your device",
  },
];

// Animation level options
const ANIMATION_OPTIONS: {
  value: AnimationLevel;
  label: string;
  icon: typeof Sparkles;
  description: string;
}[] = [
  {
    value: "full",
    label: "Full",
    icon: Sparkles,
    description: "Rich animations",
  },
  {
    value: "reduced",
    label: "Reduced",
    icon: Zap,
    description: "Subtle effects",
  },
  {
    value: "none",
    label: "None",
    icon: MinusCircle,
    description: "No animations",
  },
];

// Chart style options
const CHART_OPTIONS: {
  value: ChartStyle;
  label: string;
  icon: typeof AreaChart;
}[] = [
  { value: "area", label: "Area", icon: AreaChart },
  { value: "line", label: "Line", icon: LineChart },
  { value: "candle", label: "Candle", icon: BarChart3 },
];

// Mini chart preview data
const PREVIEW_DATA = [
  40, 45, 38, 52, 48, 55, 60, 58, 65, 62, 70, 68, 75, 72, 78,
];

/**
 * Theme Preview Card - Shows a mini preview of theme colors
 */
function ThemePreview({
  theme,
  accentColor,
  isSelected,
  onClick,
}: {
  theme: ThemeValue;
  accentColor: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isDark = theme === "dark" || theme === "system";
  const bgColor = isDark ? "#0D0D0D" : "#FFFFFF";
  const cardColor = isDark ? "#141414" : "#F8F9FA";
  const textColor = isDark ? "#FFFFFF" : "#0D0D0D";
  const mutedColor = isDark ? "#71717A" : "#9CA3AF";

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border-2 p-3 text-left transition-all duration-200",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/50"
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{ background: bgColor }}
    >
      {/* Selection indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute right-2 top-2 z-10"
          >
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: accentColor }}
            >
              <Check className="h-3 w-3 text-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview content */}
      <div className="space-y-2">
        {/* Header bar */}
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: accentColor }}
          />
          <div
            className="h-2 flex-1 rounded"
            style={{ background: cardColor }}
          />
        </div>

        {/* Card mockup */}
        <div className="rounded-lg p-2" style={{ background: cardColor }}>
          <div
            className="mb-1 h-1.5 w-8 rounded"
            style={{ background: mutedColor }}
          />
          <div
            className="h-2.5 w-12 rounded font-medium"
            style={{ background: textColor, opacity: 0.8 }}
          />
        </div>

        {/* Mini chart indicator */}
        <div className="flex items-center gap-1">
          <div
            className="h-4 w-full rounded"
            style={{
              background: `linear-gradient(to right, ${accentColor}40, ${accentColor}10)`,
            }}
          />
        </div>
      </div>

      {/* Theme label */}
      <div className="mt-2 flex items-center gap-1.5">
        {theme === "dark" && (
          <Moon className="h-3 w-3" style={{ color: mutedColor }} />
        )}
        {theme === "light" && (
          <Sun className="h-3 w-3" style={{ color: mutedColor }} />
        )}
        {theme === "system" && (
          <Monitor className="h-3 w-3" style={{ color: mutedColor }} />
        )}
        <span className="text-xs font-medium" style={{ color: textColor }}>
          {THEME_OPTIONS.find((t) => t.value === theme)?.label}
        </span>
      </div>
    </motion.button>
  );
}

/**
 * Accent Color Button
 */
function AccentColorButton({
  color,
  name,
  isSelected,
  onClick,
}: {
  color: string;
  name: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "group relative flex h-12 w-12 items-center justify-center rounded-xl border-2 transition-all",
        isSelected
          ? "border-foreground ring-2 ring-foreground/20"
          : "border-transparent hover:border-border"
      )}
      style={{ background: color }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      title={name}
    >
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Check className="h-5 w-5 text-white drop-shadow-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glow effect on hover */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-50"
        style={{
          boxShadow: `0 0 20px ${color}`,
        }}
      />
    </motion.button>
  );
}

/**
 * Chart Style Preview
 */
function ChartStylePreview({
  style,
  accentColor,
  isSelected,
  onClick,
}: {
  style: ChartStyle;
  accentColor: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = CHART_OPTIONS.find((c) => c.value === style)?.icon || AreaChart;

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-secondary/50"
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Mini chart preview */}
      <div className="h-8 w-20 overflow-hidden rounded">
        {style === "area" && (
          <Sparkline
            data={PREVIEW_DATA}
            width={80}
            height={32}
            color={isSelected ? "gain" : "muted"}
            showArea
          />
        )}
        {style === "line" && (
          <Sparkline
            data={PREVIEW_DATA}
            width={80}
            height={32}
            color={isSelected ? "gain" : "muted"}
          />
        )}
        {style === "candle" && (
          <div className="flex h-full items-end justify-around px-1">
            {[0.6, 0.8, 0.5, 0.9, 0.7, 0.85, 1].map((h, i) => (
              <div
                key={i}
                className={cn(
                  "w-1.5 rounded-sm",
                  i % 2 === 0 ? "bg-gain" : "bg-loss"
                )}
                style={{ height: `${h * 100}%`, opacity: isSelected ? 1 : 0.5 }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            isSelected ? "text-primary" : "text-muted-foreground"
          )}
        />
        <span
          className={cn(
            "text-xs font-medium",
            isSelected ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {CHART_OPTIONS.find((c) => c.value === style)?.label}
        </span>
      </div>

      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -right-1 -top-1"
        >
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
            <Check className="h-2.5 w-2.5 text-primary-foreground" />
          </div>
        </motion.div>
      )}
    </motion.button>
  );
}

/**
 * Animation Preview
 */
function AnimationPreview({
  level,
  isSelected,
  onClick,
}: {
  level: AnimationLevel;
  isSelected: boolean;
  onClick: () => void;
}) {
  const option = ANIMATION_OPTIONS.find((a) => a.value === level);
  const Icon = option?.icon || Sparkles;

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-secondary/50"
      )}
      whileHover={level !== "none" ? { scale: 1.02 } : undefined}
      whileTap={level !== "none" ? { scale: 0.98 } : undefined}
    >
      <div className="relative">
        <motion.div
          animate={
            level === "full" && isSelected
              ? {
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }
              : level === "reduced" && isSelected
                ? { scale: [1, 1.05, 1] }
                : {}
          }
          transition={{
            repeat: level !== "none" && isSelected ? Infinity : 0,
            duration: level === "full" ? 1.5 : 2,
            ease: "easeInOut",
          }}
        >
          <Icon
            className={cn(
              "h-6 w-6",
              isSelected ? "text-primary" : "text-muted-foreground"
            )}
          />
        </motion.div>

        {level === "full" && isSelected && (
          <motion.div
            className="absolute -inset-2"
            animate={{ opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="h-full w-full rounded-full bg-primary/20" />
          </motion.div>
        )}
      </div>

      <div className="text-center">
        <p
          className={cn(
            "text-sm font-medium",
            isSelected ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {option?.label}
        </p>
        <p className="text-xs text-muted-foreground">{option?.description}</p>
      </div>

      {isSelected && (
        <Badge variant="gain-subtle" size="sm" className="mt-1">
          <Check className="mr-1 h-3 w-3" />
          Active
        </Badge>
      )}
    </motion.button>
  );
}

/**
 * Main Appearance Card Component
 */
export function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: preferences, isLoading } = useUserPreferences();
  const updatePreferences = useUpdatePreferences();

  // Sync with preferences on load
  useEffect(() => {
    setMounted(true);
  }, []);

  // Current values with fallbacks
  const currentTheme = (preferences?.theme as ThemeValue) ?? "dark";
  const currentAccentColor = preferences?.accentColor ?? "#00C805";
  const currentAnimationLevel = preferences?.animationLevel ?? "full";
  const currentChartStyle = preferences?.chartStyle ?? "area";

  // Handle theme change
  const handleThemeChange = (newTheme: ThemeValue) => {
    setTheme(newTheme);
    updatePreferences.mutate({ theme: newTheme });
  };

  // Handle accent color change
  const handleAccentChange = (color: string) => {
    updatePreferences.mutate({ accentColor: color });
    // Apply CSS custom property for immediate effect
    document.documentElement.style.setProperty("--accent-color", color);
  };

  // Handle animation level change
  const handleAnimationChange = (level: AnimationLevel) => {
    updatePreferences.mutate({ animationLevel: level });
  };

  // Handle chart style change
  const handleChartStyleChange = (style: ChartStyle) => {
    updatePreferences.mutate({ chartStyle: style });
  };

  if (!mounted) {
    return (
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Appearance</CardTitle>
              <CardDescription>Customize your experience</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-48 animate-pulse rounded-xl bg-secondary/50" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Appearance</CardTitle>
            <CardDescription>Customize your trading experience</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Theme Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Theme</Label>
          <p className="text-sm text-muted-foreground">
            Choose your preferred color scheme
          </p>
          <div className="grid grid-cols-3 gap-3">
            {THEME_OPTIONS.map((option) => (
              <ThemePreview
                key={option.value}
                theme={option.value}
                accentColor={currentAccentColor}
                isSelected={theme === option.value}
                onClick={() => handleThemeChange(option.value)}
              />
            ))}
          </div>
        </div>

        {/* Accent Color */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Accent Color</Label>
          <p className="text-sm text-muted-foreground">
            Personalize gains, highlights, and primary actions
          </p>
          <div className="flex flex-wrap gap-3">
            {ACCENT_PRESETS.map((preset) => (
              <AccentColorButton
                key={preset.color}
                color={preset.color}
                name={preset.name}
                isSelected={currentAccentColor === preset.color}
                onClick={() => handleAccentChange(preset.color)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Current:{" "}
            <span
              className="font-mono font-medium"
              style={{ color: currentAccentColor }}
            >
              {currentAccentColor}
            </span>{" "}
            (
            {ACCENT_PRESETS.find((p) => p.color === currentAccentColor)?.name ||
              "Custom"}
            )
          </p>
        </div>

        {/* Animation Level */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Animations</Label>
          <p className="text-sm text-muted-foreground">
            Control motion and visual effects
          </p>
          <div className="flex gap-3">
            {ANIMATION_OPTIONS.map((option) => (
              <AnimationPreview
                key={option.value}
                level={option.value}
                isSelected={currentAnimationLevel === option.value}
                onClick={() => handleAnimationChange(option.value)}
              />
            ))}
          </div>
        </div>

        {/* Chart Style */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Chart Style</Label>
          <p className="text-sm text-muted-foreground">
            Choose how performance charts are displayed
          </p>
          <div className="grid grid-cols-3 gap-3">
            {CHART_OPTIONS.map((option) => (
              <ChartStylePreview
                key={option.value}
                style={option.value}
                accentColor={currentAccentColor}
                isSelected={currentChartStyle === option.value}
                onClick={() => handleChartStyleChange(option.value)}
              />
            ))}
          </div>
        </div>

        {/* Live Preview Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-gain/20 bg-gain/5 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gain/10">
              <Play className="h-5 w-5 text-gain" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gain">Live Preview Active</p>
              <p className="text-sm text-muted-foreground">
                Changes apply instantly across the app
              </p>
            </div>
            <Badge variant="gain" animate="glow">
              Auto-save
            </Badge>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
