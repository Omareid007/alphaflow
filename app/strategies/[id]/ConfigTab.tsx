import { AlgorithmTemplate } from "@/lib/types";
import { Strategy } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ConfigTabProps {
  strategy: Strategy;
  template: AlgorithmTemplate | null;
}

export function ConfigTab({ strategy, template }: ConfigTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Strategy Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {template?.stepSchema.steps.map(step =>
            step.fields.map(field => (
              <div key={field.key} className="rounded-lg bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground">{field.label}</p>
                <p className="mt-1 font-medium">
                  {Array.isArray(strategy.config[field.key])
                    ? (strategy.config[field.key] as string[]).join(", ")
                    : String(strategy.config[field.key] ?? "N/A")}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
