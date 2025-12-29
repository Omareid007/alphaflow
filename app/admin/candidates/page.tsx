"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag, Check, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCandidates,
  useApproveCandidate,
  useRejectCandidate,
  useTriggerCandidateRun,
} from "@/lib/api/hooks";

export default function CandidatesPage() {
  const { toast } = useToast();
  const { data: candidates = [], isLoading, refetch } = useCandidates();
  const approveCandidate = useApproveCandidate();
  const rejectCandidate = useRejectCandidate();
  const triggerRun = useTriggerCandidateRun();

  const handleTriggerRun = async () => {
    try {
      toast({ title: "Triggering candidate generation run..." });
      await triggerRun.mutateAsync();
      toast({ title: "Candidate generation completed" });
    } catch (error) {
      toast({ title: "Failed to generate candidates", variant: "destructive" });
    }
  };

  const handleApprove = async (symbol: string) => {
    try {
      await approveCandidate.mutateAsync(symbol);
      toast({ title: `${symbol} approved` });
    } catch (error) {
      toast({ title: "Failed to approve candidate", variant: "destructive" });
    }
  };

  const handleReject = async (symbol: string) => {
    try {
      await rejectCandidate.mutateAsync(symbol);
      toast({ title: `${symbol} rejected` });
    } catch (error) {
      toast({ title: "Failed to reject candidate", variant: "destructive" });
    }
  };

  // Map backend status to display format
  const getStatusDisplay = (status: string) => {
    const map: Record<string, string> = {
      NEW: "pending",
      WATCHLIST: "watchlist",
      APPROVED: "approved",
      REJECTED: "rejected",
    };
    return map[status] || status.toLowerCase();
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Candidates</h1>
          <p className="mt-1 text-muted-foreground">
            Review and approve trading candidates ({candidates.length} total)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleTriggerRun} disabled={triggerRun.isPending}>
            {triggerRun.isPending ? "Running..." : "Trigger Candidate Run"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Candidate List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                No candidates found. Click &quot;Trigger Candidate Run&quot; to
                generate new candidates.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((cand) => {
                const displayStatus = getStatusDisplay(cand.status);
                return (
                  <div
                    key={cand.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-semibold">{cand.symbol}</p>
                        <Badge variant="secondary">
                          Score: {(cand.score * 100).toFixed(0)}%
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            displayStatus === "approved"
                              ? "bg-success/10 text-success"
                              : displayStatus === "rejected"
                                ? "bg-destructive/10 text-destructive"
                                : displayStatus === "watchlist"
                                  ? "bg-blue-500/10 text-blue-500"
                                  : "bg-warning/10 text-warning"
                          }
                        >
                          {displayStatus}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {cand.rationale}
                      </p>
                    </div>
                    {(cand.status === "NEW" || cand.status === "WATCHLIST") && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(cand.symbol)}
                          disabled={approveCandidate.isPending}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReject(cand.symbol)}
                          disabled={rejectCandidate.isPending}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
