"use client";

import { BacktestRun } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle,
  Lightbulb
} from "lucide-react";

interface AIInterpretationProps {
  interpretation: BacktestRun["interpretation"];
  onApplySuggestions: () => void;
}

export function AIInterpretation({ interpretation, onApplySuggestions }: AIInterpretationProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">AI Interpretation</h3>
      </div>

      <p className="text-muted-foreground">{interpretation.summary}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 text-success" />
            Strengths
          </h4>
          <ul className="space-y-2">
            {interpretation.strengths.map((strength, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {strength}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Risks
          </h4>
          <ul className="space-y-2">
            {interpretation.risks.map((risk, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {risk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {interpretation.suggestedEdits.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h4 className="mb-3 font-medium">Suggested Optimizations</h4>
          <div className="space-y-3">
            {interpretation.suggestedEdits.map((edit, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {i + 1}
                </div>
                <div>
                  <p className="text-muted-foreground">
                    Change <span className="font-medium text-foreground">{edit.fieldKey}</span>{" "}
                    from {String(edit.currentValue)} to{" "}
                    <span className="font-medium text-primary">{String(edit.suggestedValue)}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{edit.rationale}</p>
                </div>
              </div>
            ))}
          </div>
          <Button className="mt-4" variant="outline" onClick={onApplySuggestions}>
            Apply Suggestions
          </Button>
        </div>
      )}
    </div>
  );
}
