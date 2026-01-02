"use client";

import { Field } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardFieldProps {
  field: Field;
  value: string | number | boolean | string[];
  onChange: (value: string | number | boolean | string[]) => void;
}

export function WizardField({ field, value, onChange }: WizardFieldProps) {
  const renderField = () => {
    switch (field.type) {
      case "number":
        return (
          <Input
            type="number"
            value={value as number}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            min={field.constraints?.min}
            max={field.constraints?.max}
            step={field.constraints?.step || 1}
            className="w-full"
          />
        );

      case "text":
        return (
          <Input
            type="text"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            debounceMs={300}
            onDebouncedChange={onChange}
            className="w-full"
          />
        );

      case "select":
        return (
          <Select value={value as string} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              {field.constraints?.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "range":
        const numValue = value as number;
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {field.constraints?.min}
              </span>
              <span className="rounded-md bg-secondary px-3 py-1 text-sm font-medium">
                {numValue}
                {field.label.includes("%") ? "%" : ""}
              </span>
              <span className="text-sm text-muted-foreground">
                {field.constraints?.max}
              </span>
            </div>
            <Slider
              value={[numValue]}
              onValueChange={([v]) => onChange(v)}
              min={field.constraints?.min}
              max={field.constraints?.max}
              step={field.constraints?.step || 1}
              className="w-full"
            />
          </div>
        );

      case "toggle":
        return (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {field.helpText}
            </span>
            <Switch checked={value as boolean} onCheckedChange={onChange} />
          </div>
        );

      case "multi-select":
        const selectedValues = (value as string[]) || [];
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {selectedValues.map((val) => (
                <Badge key={val} variant="secondary" className="gap-1 pr-1">
                  {val}
                  <button
                    onClick={() =>
                      onChange(selectedValues.filter((v) => v !== val))
                    }
                    className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {field.constraints?.options
                ?.filter((opt) => !selectedValues.includes(opt.value))
                .map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onChange([...selectedValues, opt.value])}
                    className={cn(
                      "rounded-lg border border-dashed border-border px-3 py-1.5 text-sm",
                      "text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    )}
                  >
                    + {opt.label}
                  </button>
                ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{field.label}</Label>
      {renderField()}
      {field.type !== "toggle" && field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  );
}
