"use client";

import { cn } from "@/lib/utils";

interface MetricTileProps {
  label: string;
  value: number;
  format?: "percent" | "number" | "ratio";
  good?: boolean;
}

export function MetricTile({
  label,
  value,
  format = "number",
  good = true
}: MetricTileProps) {
  let formatted: string;
  if (format === "percent") {
    formatted = `${value.toFixed(1)}%`;
  } else if (format === "ratio") {
    formatted = value.toFixed(2);
  } else {
    formatted = value.toFixed(0);
  }

  return (
    <div className="rounded-xl bg-secondary/50 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold",
          format === "percent" && (good ? "text-success" : "text-destructive")
        )}
      >
        {formatted}
      </p>
    </div>
  );
}
