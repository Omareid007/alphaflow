"use client";

import { useParams, useRouter } from "next/navigation";
import { algorithmTemplates } from "@/lib/store/templates";
import { AlgorithmTemplate } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { StrategyHeader } from "./StrategyHeader";
import { PerformanceMetricsGrid } from "./PerformanceMetricsGrid";
import { PerformanceTab } from "./PerformanceTab";
import { ConfigTab } from "./ConfigTab";
import { AIAnalysisTab } from "./AIAnalysisTab";
import {
  useStrategy,
  useBacktest,
  usePauseStrategy,
  useResumeStrategy,
  useStopStrategy,
  useDeployStrategy,
  type Strategy,
  type BacktestRun,
} from "@/lib/api/hooks";

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // Fetch strategy data with React Query
  const {
    data: strategy,
    isLoading: strategyLoading,
    error: strategyError,
  } = useStrategy(id);

  // Fetch backtest data if available (with auto-polling when running)
  // useBacktest automatically polls every 2s when status is 'running'
  const { data: backtest } = useBacktest(strategy?.lastBacktestId || "");

  // Get template from static data
  const template = strategy
    ? algorithmTemplates.find((t) => t.id === strategy.templateId) || null
    : null;

  // Mutation hooks for actions
  const pauseMutation = usePauseStrategy();
  const resumeMutation = useResumeStrategy();
  const stopMutation = useStopStrategy();
  const deployMutation = useDeployStrategy();

  const handlePause = async () => {
    if (!strategy) return;
    try {
      await pauseMutation.mutateAsync(strategy.id);
      toast.success("Strategy paused");
    } catch (error) {
      toast.error("Failed to pause strategy");
      console.error(error);
    }
  };

  const handleResume = async () => {
    if (!strategy) return;
    try {
      await resumeMutation.mutateAsync(strategy.id);
      toast.success("Strategy resumed");
    } catch (error) {
      toast.error("Failed to resume strategy");
      console.error(error);
    }
  };

  const handleStop = async () => {
    if (!strategy) return;
    try {
      await stopMutation.mutateAsync(strategy.id);
      toast.success("Strategy stopped");
    } catch (error) {
      toast.error("Failed to stop strategy");
      console.error(error);
    }
  };

  const handleDeploy = async (mode: "paper" | "live") => {
    if (!strategy) return;
    try {
      await deployMutation.mutateAsync({ id: strategy.id, mode });
      toast.success(`Deployed to ${mode} trading`);
    } catch (error) {
      toast.error(`Failed to deploy to ${mode} trading`);
      console.error(error);
    }
  };

  // Handle loading state
  if (strategyLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Handle error state
  if (strategyError) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-destructive">
            Failed to load strategy
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {strategyError instanceof Error
              ? strategyError.message
              : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  // Handle not found
  if (!strategy) {
    router.push("/strategies");
    return null;
  }

  return (
    <div className="space-y-6">
      <StrategyHeader
        strategy={strategy}
        template={template}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onDeploy={handleDeploy}
      />

      <PerformanceMetricsGrid
        performanceSummary={strategy.performanceSummary}
      />

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          {backtest && (
            <TabsTrigger value="interpretation">AI Analysis</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="performance" className="mt-4">
          <PerformanceTab backtest={backtest} strategyId={id} />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <ConfigTab strategy={strategy} template={template} />
        </TabsContent>

        {backtest && (
          <TabsContent value="interpretation" className="mt-4">
            <AIAnalysisTab backtest={backtest} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
