import { AlgorithmTemplate } from "@/lib/types";
import { Strategy } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2 } from "lucide-react";
import { StaggerList, StaggerItem } from "@/lib/animations/stagger";
import { motion } from "framer-motion";

interface ConfigTabProps {
  strategy: Strategy;
  template: AlgorithmTemplate | null;
}

export function ConfigTab({ strategy, template }: ConfigTabProps) {
  if (!template?.stepSchema?.steps) {
    return (
      <Card variant="glass">
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Settings2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-muted-foreground mb-2">
            No configuration available
          </p>
          <p className="text-sm text-muted-foreground/70">
            This strategy has no configurable parameters
          </p>
        </CardContent>
      </Card>
    );
  }

  // Flatten all fields from all steps
  const allFields = template.stepSchema.steps.flatMap((step) => step.fields);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card variant="glass" className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary/80 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Strategy Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">
                {allFields.length} parameters configured
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StaggerList className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {allFields.map((field, index) => {
              const value = strategy.config[field.key];
              const displayValue = Array.isArray(value)
                ? (value as string[]).join(", ")
                : String(value ?? "N/A");

              return (
                <StaggerItem key={field.key}>
                  <div className="rounded-xl bg-secondary/50 p-4 border border-border/30 hover:border-border/50 transition-colors">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {field.label}
                    </p>
                    <p
                      className="font-medium text-foreground truncate"
                      title={displayValue}
                    >
                      {displayValue}
                    </p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerList>
        </CardContent>
      </Card>
    </motion.div>
  );
}
