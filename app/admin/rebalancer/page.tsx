"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCw, RefreshCw, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useAllocationPolicies,
  useRebalanceRuns,
  useTriggerRebalance,
} from "@/lib/api/hooks";

export default function RebalancerPage() {
  const { toast } = useToast();
  const { data: policies = [], isLoading: policiesLoading } = useAllocationPolicies();
  const { data: runs = [], isLoading: runsLoading, refetch } = useRebalanceRuns(20);
  const triggerRebalance = useTriggerRebalance();

  const handleTriggerRebalance = async (policyId?: string) => {
    try {
      toast({ title: "Triggering rebalance..." });
      await triggerRebalance.mutateAsync({
        policyId,
        triggerType: 'manual',
      });
      await refetch();
      toast({ title: "Rebalance triggered successfully" });
    } catch (error) {
      toast({ title: "Failed to trigger rebalance", variant: "destructive" });
    }
  };

  const isLoading = policiesLoading || runsLoading;

  if (isLoading && runs.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const activePolicies = policies.filter(p => p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Rebalancer</h1>
          <p className="mt-1 text-muted-foreground">Rebalancing policies and triggers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => handleTriggerRebalance()} disabled={triggerRebalance.isPending}>
            <Play className="mr-2 h-4 w-4" />
            {triggerRebalance.isPending ? 'Running...' : 'Trigger Rebalance'}
          </Button>
        </div>
      </div>

      {/* Active Policies Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCw className="h-5 w-5" />
            Active Policies ({activePolicies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activePolicies.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No active allocation policies. Enable policies in the Allocation page.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activePolicies.map(policy => (
                <div key={policy.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{policy.name}</p>
                      <Badge variant="outline" className="bg-success/10 text-success">
                        Active
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Frequency: {policy.rebalanceFrequency} • Max Position: {policy.maxPositionWeightPct}%
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTriggerRebalance(policy.id)}
                    disabled={triggerRebalance.isPending}
                  >
                    <Play className="mr-1 h-4 w-4" />
                    Run
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Rebalance Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Rebalance Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No rebalance runs yet. Trigger one above or enable a policy.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map(run => (
                <div key={run.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">
                        {run.triggerType === 'manual' ? 'Manual Run' : `Triggered by ${run.triggerType}`}
                      </p>
                      <Badge variant="outline" className={
                        run.status === 'completed' ? 'bg-success/10 text-success' :
                        run.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
                        run.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }>
                        {run.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Started: {new Date(run.startedAt).toLocaleString()}
                      {run.completedAt && ` • Completed: ${new Date(run.completedAt).toLocaleString()}`}
                    </p>
                    {run.rationale && (
                      <p className="mt-1 text-sm text-muted-foreground">{run.rationale}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
