"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WizardField } from "./wizard-field";
import { Settings2 } from "lucide-react";
import type { FieldType } from "@/lib/types";

interface Field {
  key: string;
  label: string;
  type: FieldType;
  default: string | number | boolean | string[];
  validation?: any;
  options?: string[];
}

interface StepData {
  title: string;
  description: string;
  fields: Field[];
  advancedFields?: Field[];
}

interface ConfigStepProps {
  stepData: StepData;
  configValues: Record<string, string | number | boolean | string[]>;
  onFieldChange: (key: string, value: string | number | boolean | string[]) => void;
}

export function ConfigStep({ stepData, configValues, onFieldChange }: ConfigStepProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">{stepData.title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {stepData.description}
          </p>
        </div>
        {stepData.advancedFields && stepData.advancedFields.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            {showAdvanced ? "Hide" : "Show"} Advanced
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {stepData.fields.map(field => (
            <WizardField
              key={field.key}
              field={field}
              value={configValues[field.key]}
              onChange={value => onFieldChange(field.key, value)}
            />
          ))}
        </div>

        {showAdvanced && stepData.advancedFields && (
          <div className="border-t border-border pt-6">
            <h4 className="mb-4 text-sm font-medium text-muted-foreground">
              Advanced Settings
            </h4>
            <div className="grid gap-6 md:grid-cols-2">
              {stepData.advancedFields.map(field => (
                <WizardField
                  key={field.key}
                  field={field}
                  value={configValues[field.key]}
                  onChange={value => onFieldChange(field.key, value)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
