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
import { X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedCallback } from "@/lib/utils/useDebounce";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

interface WizardFieldProps {
  field: Field;
  value: string | number | boolean | string[];
  onChange: (value: string | number | boolean | string[]) => void;
  /**
   * Optional validation function that runs on debounced changes
   */
  onValidate?: (value: string | number | boolean | string[]) => Promise<boolean> | boolean;
  /**
   * Debounce delay for validation (ms)
   * @default 300
   */
  validationDelay?: number;
}

export function WizardField({
  field,
  value,
  onChange,
  onValidate,
  validationDelay = 300,
}: WizardFieldProps) {
  const prefersReducedMotion = useReducedMotion();
  const [validationState, setValidationState] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");

  // Debounced validation handler
  const handleValidation = useDebouncedCallback(
    async (val: string | number | boolean | string[]) => {
      if (!onValidate) return;

      setValidationState("validating");
      try {
        const isValid = await onValidate(val);
        setValidationState(isValid ? "valid" : "invalid");
      } catch {
        setValidationState("invalid");
      }
    },
    validationDelay
  );

  // Wrapped onChange that triggers validation
  const handleChange = useCallback(
    (newValue: string | number | boolean | string[]) => {
      onChange(newValue);
      if (onValidate) {
        handleValidation(newValue);
      }
    },
    [onChange, onValidate, handleValidation]
  );

  // Animation variants for error messages
  const errorVariants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: -10, height: 0 },
        animate: { opacity: 1, y: 0, height: "auto" },
        exit: { opacity: 0, y: -10, height: 0 },
      };

  const renderField = () => {
    switch (field.type) {
      case "number":
        return (
          <div className="relative">
            <Input
              type="number"
              value={value as number}
              onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
              min={field.constraints?.min}
              max={field.constraints?.max}
              step={field.constraints?.step || 1}
              className={cn(
                "w-full pr-10",
                validationState === "invalid" && "border-destructive focus-visible:ring-destructive"
              )}
            />
            <ValidationIndicator state={validationState} />
          </div>
        );

      case "text":
        return (
          <div className="relative">
            <Input
              type="text"
              value={value as string}
              onChange={(e) => handleChange(e.target.value)}
              className={cn(
                "w-full pr-10",
                validationState === "invalid" && "border-destructive focus-visible:ring-destructive"
              )}
            />
            <ValidationIndicator state={validationState} />
          </div>
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

      {/* Error/help text with smooth transitions */}
      <AnimatePresence mode="wait">
        {validationState === "invalid" ? (
          <motion.p
            key="error"
            variants={errorVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex items-center gap-1 text-xs text-destructive"
          >
            <AlertCircle className="h-3 w-3" />
            Invalid value
          </motion.p>
        ) : field.type !== "toggle" && field.helpText ? (
          <motion.p
            key="help"
            variants={errorVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="text-xs text-muted-foreground"
          >
            {field.helpText}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Validation indicator icon shown in input fields
 */
function ValidationIndicator({
  state,
}: {
  state: "idle" | "validating" | "valid" | "invalid";
}) {
  if (state === "idle") return null;

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2">
      {state === "validating" && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {state === "valid" && (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      )}
      {state === "invalid" && (
        <AlertCircle className="h-4 w-4 text-destructive" />
      )}
    </div>
  );
}
