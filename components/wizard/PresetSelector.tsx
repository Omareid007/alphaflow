"use client";

import { Preset } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PresetSelectorProps {
  presets: Preset[];
  selectedPreset: Preset | null;
  onPresetSelect: (preset: Preset) => void;
}

export function PresetSelector({
  presets,
  selectedPreset,
  onPresetSelect,
}: PresetSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Choose a Preset</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onPresetSelect(preset)}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-all",
                selectedPreset?.id === preset.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{preset.name}</span>
                {selectedPreset?.id === preset.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
