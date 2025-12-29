"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Play,
  RefreshCw,
  Users,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useArenaStats,
  useArenaRuns,
  useRunArena,
  useAgentProfiles,
  useArenaLeaderboard,
} from "@/lib/api/hooks";

export default function AiArenaPage() {
  const { toast } = useToast();
  const [symbols, setSymbols] = useState("AAPL, MSFT, NVDA");

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useArenaStats();
  const {
    data: runs = [],
    isLoading: runsLoading,
    refetch: refetchRuns,
  } = useArenaRuns(10);
  const { data: profiles = [] } = useAgentProfiles();
  const { data: leaderboard } = useArenaLeaderboard("7d");
  const runArena = useRunArena();

  const handleRunTest = async () => {
    const symbolList = symbols
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbolList.length === 0) {
      toast({
        title: "Please enter at least one symbol",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({ title: "Running AI Arena analysis..." });
      const result = await runArena.mutateAsync({
        symbols: symbolList,
        mode: "debate",
        triggeredBy: "admin_manual",
      });
      await refetchStats();
      await refetchRuns();
      toast({
        title: `Arena completed with ${result.decisionsCount} decisions`,
      });
    } catch (error) {
      toast({ title: "Failed to run arena", variant: "destructive" });
    }
  };

  if (statsLoading && !stats) {
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
          <h1 className="text-3xl font-semibold tracking-tight">AI Arena</h1>
          <p className="mt-1 text-muted-foreground">
            Test prompts and simulate strategy cycles
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            refetchStats();
            refetchRuns();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Play className="h-4 w-4" />
              Runs Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.runsToday || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cost Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ${(stats?.costToday || 0).toFixed(4)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Escalations Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.escalationsToday || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Profiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.activeProfiles || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Run Arena */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Prompt Playground
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Symbols (comma-separated)
            </label>
            <Textarea
              placeholder="AAPL, MSFT, NVDA, GOOGL..."
              rows={2}
              value={symbols}
              onChange={(e) => setSymbols(e.target.value)}
            />
          </div>
          <Button onClick={handleRunTest} disabled={runArena.isPending}>
            <Play className="mr-2 h-4 w-4" />
            {runArena.isPending ? "Running Analysis..." : "Run Arena Analysis"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Runs */}
      {runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Arena Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {new Date(run.createdAt).toLocaleString()}
                      </Badge>
                      <Badge variant="secondary">{run.mode}</Badge>
                      {run.escalationTriggered && (
                        <Badge variant="destructive">Escalated</Badge>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-blue-500/10 text-blue-500"
                    >
                      ${parseFloat(run.totalCostUsd || "0").toFixed(4)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Symbols:
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {run.symbols?.map((s) => (
                        <Badge key={s} variant="secondary">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {run.consensusDecision && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Consensus:
                      </p>
                      <p className="text-sm">
                        {run.consensusDecision}
                        {run.consensusConfidence &&
                          ` (${(run.consensusConfidence * 100).toFixed(0)}% confidence)`}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Profiles */}
      {profiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Profiles ({profiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{profile.name}</p>
                    <Badge
                      variant="outline"
                      className={
                        profile.status === "active"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {profile.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {profile.provider} / {profile.model} • {profile.role}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
