"use client";

import { useParams, useRouter } from "next/navigation";
import { useStrategy, useBacktest } from "@/lib/api/hooks";
import { StrategyWizard } from "@/components/wizard/strategy-wizard";

export default function EditStrategyPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: strategy, isLoading: strategyLoading } = useStrategy(id);
  const { data: backtest, isLoading: backtestLoading } = useBacktest(
    strategy?.lastBacktestId || ""
  );

  const loading = strategyLoading || backtestLoading;

  // Redirect if strategy not found
  useEffect(() => {
    if (!strategyLoading && !strategy) {
      router.push("/strategies");
    }
  }, [strategyLoading, strategy, router]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!strategy) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Edit Strategy</h1>
        <p className="mt-1 text-muted-foreground">
          Modify configuration and run new backtests
        </p>
      </div>
      <StrategyWizard existingStrategy={strategy as any} existingBacktest={backtest as any} />
    </div>
  );
}
