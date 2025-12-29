"use client";

import { AlgorithmTemplate } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Activity, GitCompare, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const templateIcons: Record<string, React.ElementType> = {
  TrendingUp,
  Activity,
  GitCompare,
  Brain,
};

interface TemplateSelectorProps {
  templates: AlgorithmTemplate[];
  onTemplateSelect: (template: AlgorithmTemplate) => void;
}

export function TemplateSelector({
  templates,
  onTemplateSelect,
}: TemplateSelectorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Choose Algorithm Template</h2>
        <p className="mt-1 text-muted-foreground">
          Select a trading algorithm to start building your strategy
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => {
          const Icon = templateIcons[template.icon] || TrendingUp;
          return (
            <Card
              key={template.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary hover:shadow-lg",
                "hover:shadow-primary/5"
              )}
              onClick={() => onTemplateSelect(template)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {template.difficulty}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
