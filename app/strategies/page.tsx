"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { algorithmTemplates } from "@/lib/store/templates";
import {
  useStrategies,
  usePauseStrategy,
  useResumeStrategy,
  useStopStrategy,
  useCreateStrategy,
  useDeleteStrategy,
  type Strategy
} from "@/lib/api/hooks/useStrategies";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Plus,
  MoreHorizontal,
  Play,
  Pause,
  Square,
  Pencil,
  Copy,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-muted text-muted-foreground", label: "Draft" },
  backtesting: { color: "bg-blue-500/10 text-blue-500", label: "Backtesting" },
  paper: { color: "bg-blue-500/10 text-blue-500", label: "Paper Trading" },
  live: { color: "bg-success/10 text-success", label: "Live" },
  paused: { color: "bg-warning/10 text-warning", label: "Paused" },
  stopped: { color: "bg-destructive/10 text-destructive", label: "Stopped" }
};

const DEFAULT_STATUS = { color: "bg-muted text-muted-foreground", label: "Unknown" };

export default function StrategiesPage() {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Use React Query hooks
  const { data: strategies = [], isLoading, error, refetch } = useStrategies();
  const pauseMutation = usePauseStrategy();
  const resumeMutation = useResumeStrategy();
  const stopMutation = useStopStrategy();
  const createMutation = useCreateStrategy();
  const deleteMutation = useDeleteStrategy();

  const handlePause = async (id: string) => {
    try {
      await pauseMutation.mutateAsync(id);
      toast.success("Strategy paused");
    } catch (error) {
      toast.error("Failed to pause strategy");
      console.error(error);
    }
  };

  const handleResume = async (id: string) => {
    try {
      await resumeMutation.mutateAsync(id);
      toast.success("Strategy resumed");
    } catch (error) {
      toast.error("Failed to resume strategy");
      console.error(error);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopMutation.mutateAsync(id);
      toast.success("Strategy stopped");
    } catch (error) {
      toast.error("Failed to stop strategy");
      console.error(error);
    }
  };

  const handleClone = async (id: string) => {
    try {
      const strategy = strategies.find(s => s.id === id);
      if (!strategy) {
        toast.error("Strategy not found");
        return;
      }

      await createMutation.mutateAsync({
        name: `${strategy.name} (Copy)`,
        templateId: strategy.templateId,
        status: 'draft',
        config: { ...strategy.config }
      });
      toast.success("Strategy cloned");
    } catch (error) {
      toast.error("Failed to clone strategy");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success("Strategy deleted");
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete strategy");
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Strategies</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your trading strategies
            </p>
          </div>
        </div>
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading strategies...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Strategies</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your trading strategies
            </p>
          </div>
          <Link href="/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Strategy
            </Button>
          </Link>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Unable to load strategies</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "An error occurred while loading strategies. Please check your connection and try again."}
            </p>
            <Button onClick={() => refetch()} variant="outline" className="mt-6">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Strategies</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your trading strategies
          </p>
        </div>
        <Link href="/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Strategy
          </Button>
        </Link>
      </div>

      {strategies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No strategies created yet</p>
            <Link href="/create">
              <Button className="mt-4">Create your first strategy</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {strategies.map(strategy => (
            <Card
              key={strategy.id}
              className="group transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={(statusConfig[strategy.status] || DEFAULT_STATUS).color}>
                        {(statusConfig[strategy.status] || DEFAULT_STATUS).label}
                      </Badge>
                    </div>
                    <h3 className="mt-3 truncate text-lg font-semibold">{strategy.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {algorithmTemplates.find(t => t.id === strategy.templateId)?.name}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/strategies/${strategy.id}/edit`)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleClone(strategy.id)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Clone
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {(strategy.status === "live" || strategy.status === "paper") && (
                        <DropdownMenuItem onClick={() => handlePause(strategy.id)}>
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </DropdownMenuItem>
                      )}
                      {strategy.status === "paused" && (
                        <DropdownMenuItem onClick={() => handleResume(strategy.id)}>
                          <Play className="mr-2 h-4 w-4" />
                          Resume
                        </DropdownMenuItem>
                      )}
                      {(strategy.status === "live" || strategy.status === "paper" || strategy.status === "paused") && (
                        <DropdownMenuItem onClick={() => handleStop(strategy.id)}>
                          <Square className="mr-2 h-4 w-4" />
                          Stop
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(strategy.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {strategy.performanceSummary && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Return</p>
                      <p
                        className={cn(
                          "text-lg font-semibold",
                          (strategy.performanceSummary.totalReturn ?? 0) >= 0
                            ? "text-success"
                            : "text-destructive"
                        )}
                      >
                        {(strategy.performanceSummary.totalReturn ?? 0) >= 0 ? "+" : ""}
                        {(strategy.performanceSummary.totalReturn ?? 0).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sharpe</p>
                      <p className="text-lg font-semibold">
                        {(strategy.performanceSummary.sharpeRatio ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Updated {new Date(strategy.updatedAt).toLocaleDateString()}
                  </span>
                  <Link href={`/strategies/${strategy.id}`}>
                    <Button variant="ghost" size="sm" className="gap-2">
                      View
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Strategy</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the strategy
              and all associated backtests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
