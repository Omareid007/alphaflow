"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { algorithmTemplates } from "@/lib/store/templates";
import { AlgorithmTemplate, Preset, BacktestRun, Strategy } from "@/lib/types";
import {
  useCreateStrategy,
  useUpdateStrategy,
  useDeployStrategy,
} from "@/lib/api/hooks";
import { useRunBacktest, useBacktest } from "@/lib/api/hooks";
import { BacktestResults } from "./backtest-results";
import { TemplateSelector } from "./TemplateSelector";
import { PresetSelector } from "./PresetSelector";
import { ConfigStep } from "./ConfigStep";
import { BacktestPrompt } from "./BacktestPrompt";
import { BacktestProgress } from "./BacktestProgress";
import { WizardNavigation } from "./WizardNavigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StrategyWizardProps {
  existingStrategy?: Strategy;
  existingBacktest?: BacktestRun;
}

export function StrategyWizard({
  existingStrategy,
  existingBacktest,
}: StrategyWizardProps) {
  const router = useRouter();
  const [templates] = useState<AlgorithmTemplate[]>(algorithmTemplates);
  const [selectedTemplate, setSelectedTemplate] =
    useState<AlgorithmTemplate | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [configValues, setConfigValues] = useState<
    Record<string, string | number | boolean | string[]>
  >({});
  const [currentStep, setCurrentStep] = useState(0);
  const [strategyName, setStrategyName] = useState("");
  const [backtestProgress, setBacktestProgress] = useState(0);
  const [strategy, setStrategy] = useState<Strategy | null>(
    existingStrategy || null
  );
  const [runningBacktestId, setRunningBacktestId] = useState<string | null>(
    null
  );
  const [completedBacktest, setCompletedBacktest] =
    useState<BacktestRun | null>(existingBacktest || null);

  // React Query mutations
  const createStrategyMutation = useCreateStrategy();
  const updateStrategyMutation = useUpdateStrategy();
  const runBacktestMutation = useRunBacktest();
  const deployStrategyMutation = useDeployStrategy();

  // Poll backtest status when running (useBacktest has built-in polling)
  const { data: polledBacktest } = useBacktest(runningBacktestId || "");

  // Track backtest progress based on status
  useEffect(() => {
    if (polledBacktest) {
      if (polledBacktest.status === "running") {
        // Simulate progress based on time
        setBacktestProgress((prev) => Math.min(prev + 5, 90));
      } else if (polledBacktest.status === "completed") {
        setBacktestProgress(100);
        // Store the completed backtest BEFORE clearing the running ID
        // This prevents race condition where polledBacktest becomes undefined
        setCompletedBacktest(polledBacktest as unknown as BacktestRun);
        setRunningBacktestId(null);
        toast.success("Backtest completed");
      } else if (polledBacktest.status === "failed") {
        setBacktestProgress(0);
        setRunningBacktestId(null);
        toast.error("Backtest failed");
      }
    }
  }, [polledBacktest]);

  useEffect(() => {
    if (existingStrategy) {
      const template = templates.find(
        (t) => t.id === existingStrategy.templateId
      );
      if (template) {
        setSelectedTemplate(template);
        setConfigValues(existingStrategy.configValues);
        setStrategyName(existingStrategy.name);
        setCurrentStep(1);
      }
    }
  }, [existingStrategy, templates]);

  const initializeConfig = useCallback((template: AlgorithmTemplate) => {
    const defaults: Record<string, string | number | boolean | string[]> = {};
    template.stepSchema.steps.forEach((step) => {
      step.fields.forEach((field) => {
        defaults[field.key] = field.default;
      });
      step.advancedFields?.forEach((field) => {
        defaults[field.key] = field.default;
      });
    });
    return defaults;
  }, []);

  const handleTemplateSelect = useCallback(
    (template: AlgorithmTemplate) => {
      setSelectedTemplate(template);
      setConfigValues(initializeConfig(template));
      setStrategyName(`My ${template.name}`);
      setCurrentStep(1);
    },
    [initializeConfig]
  );

  const handlePresetSelect = useCallback((preset: Preset) => {
    setSelectedPreset(preset);
    if (preset.name !== "Custom") {
      setConfigValues((prev) => ({ ...prev, ...preset.valuesByFieldKey }));
    }
  }, []);

  const handleFieldChange = useCallback(
    (key: string, value: string | number | boolean | string[]) => {
      setConfigValues((prev) => ({ ...prev, [key]: value }));
      if (selectedPreset?.name !== "Custom") {
        const customPreset = selectedTemplate?.presets.find(
          (p) => p.name === "Custom"
        );
        if (customPreset) setSelectedPreset(customPreset);
      }
    },
    [selectedPreset?.name, selectedTemplate?.presets]
  );

  const handleRunBacktest = useCallback(async () => {
    if (!selectedTemplate) return;

    setBacktestProgress(0);

    try {
      let currentStrategy = strategy;

      // Create or update strategy
      if (!currentStrategy) {
        toast.loading("Creating strategy...");
        const result = await createStrategyMutation.mutateAsync({
          name: strategyName,
          templateId: selectedTemplate.id,
          type: selectedTemplate.id, // Required by database schema
          status: "draft",
          config: configValues,
        });
        currentStrategy = result as unknown as Strategy;
        setStrategy(currentStrategy);
        toast.dismiss();
        toast.success("Strategy created");
      } else {
        toast.loading("Updating strategy...");
        await updateStrategyMutation.mutateAsync({
          id: currentStrategy.id,
          config: configValues,
          name: strategyName,
          type: selectedTemplate.id, // Ensure type is always sent
        });
        toast.dismiss();
        toast.success("Strategy updated");
      }

      // Run backtest
      toast.loading("Starting backtest...");
      const backtestResult = await runBacktestMutation.mutateAsync({
        strategyId: currentStrategy.id,
        startDate: new Date(
          Date.now() - 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
        endDate: new Date().toISOString(),
        initialCapital: 100000,
      });

      toast.dismiss();
      toast.success("Backtest started");

      // Start polling for backtest completion
      setRunningBacktestId(backtestResult.id);
      setBacktestProgress(10);
    } catch (error) {
      toast.dismiss();
      toast.error(error instanceof Error ? error.message : "Backtest failed");
      setBacktestProgress(0);
    }
  }, [
    selectedTemplate,
    strategy,
    strategyName,
    configValues,
    createStrategyMutation,
    updateStrategyMutation,
    runBacktestMutation,
  ]);

  const handleApplySuggestions = useCallback(() => {
    // Interpretation is a string in the API, not an object with suggestedEdits
    // This feature requires backend enhancement to return structured interpretation
    toast.info("AI suggestions not yet available from backend");
  }, []);

  const handleRunAgain = useCallback(() => {
    // Clear completed backtest to allow running a new one
    setCompletedBacktest(null);
    setRunningBacktestId(null);
    setBacktestProgress(0);
  }, []);

  const handleDeploy = useCallback(
    async (mode: "paper" | "live") => {
      if (!strategy) return;

      try {
        toast.loading(`Deploying to ${mode} trading...`);
        await deployStrategyMutation.mutateAsync({
          id: strategy.id,
          mode,
        });
        toast.dismiss();
        toast.success(`Strategy deployed to ${mode} trading`);
        router.push("/strategies");
      } catch (error) {
        toast.dismiss();
        toast.error(
          error instanceof Error ? error.message : "Deployment failed"
        );
      }
    },
    [strategy, deployStrategyMutation, router]
  );

  const handleBack = useCallback(() => {
    if (currentStep === 1) {
      setSelectedTemplate(null);
      setSelectedPreset(null);
      setRunningBacktestId(null);
      setCompletedBacktest(null);
    } else if (completedBacktest) {
      // Go back to config step when viewing backtest results
      setCompletedBacktest(null);
      setRunningBacktestId(null);
      setBacktestProgress(0);
    } else {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep, completedBacktest]);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => prev + 1);
  }, []);

  const totalSteps = selectedTemplate
    ? selectedTemplate.stepSchema.steps.length
    : 0;
  const isBacktesting = runBacktestMutation.isPending || !!runningBacktestId;
  // Use stored completedBacktest to prevent race condition when polledBacktest becomes undefined
  const backtest = completedBacktest as any;

  if (!selectedTemplate) {
    return (
      <TemplateSelector
        templates={templates}
        onTemplateSelect={handleTemplateSelect}
      />
    );
  }

  const currentStepData = selectedTemplate.stepSchema.steps[currentStep - 1];
  const isConfigStep = currentStep >= 1 && currentStep <= totalSteps;
  const isBacktestStep = currentStep === totalSteps + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{strategyName}</h2>
          <p className="mt-1 text-muted-foreground">
            {selectedTemplate.name} Strategy
          </p>
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps + 2 }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-8 rounded-full transition-colors",
                i < currentStep ? "bg-primary" : "bg-secondary"
              )}
            />
          ))}
        </div>
      </div>

      {currentStep === 1 && (
        <PresetSelector
          presets={selectedTemplate.presets}
          selectedPreset={selectedPreset}
          onPresetSelect={handlePresetSelect}
        />
      )}

      {isConfigStep && currentStepData && (
        <ConfigStep
          stepData={currentStepData}
          configValues={configValues}
          onFieldChange={handleFieldChange}
        />
      )}

      {isBacktestStep && !isBacktesting && !backtest && (
        <BacktestPrompt
          strategyName={strategyName}
          onStrategyNameChange={setStrategyName}
          onRunBacktest={handleRunBacktest}
        />
      )}

      {isBacktesting && <BacktestProgress progress={backtestProgress} />}

      {backtest && (
        <BacktestResults
          backtest={backtest}
          onApplySuggestions={handleApplySuggestions}
          onRunAgain={handleRunAgain}
          onDeploy={handleDeploy}
        />
      )}

      <WizardNavigation
        currentStep={currentStep}
        totalSteps={totalSteps}
        hasBacktest={!!backtest}
        onBack={handleBack}
        onNext={handleNext}
      />
    </div>
  );
}
