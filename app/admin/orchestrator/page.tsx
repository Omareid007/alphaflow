"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function OrchestratorPage() {
  const [config, setConfig] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData().catch(console.error);
  }, []);

  async function loadData() {
    try {
      const [configRes, jobsRes] = await Promise.all([
        fetch('/api/admin/orchestrator/config'),
        fetch('/api/admin/orchestrator/jobs')
      ]);

      if (configRes.ok) setConfig(await configRes.json());
      if (jobsRes.ok) setJobs(await jobsRes.json());
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function toggleKillSwitch() {
    try {
      const res = await fetch('/api/admin/orchestrator/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !config.killSwitch })
      });

      if (res.ok) {
        toast.success(`Kill switch ${!config.killSwitch ? 'enabled' : 'disabled'}`);
        loadData();
      }
    } catch (error) {
      toast.error('Failed to toggle kill switch');
    }
  }

  async function triggerRun(mode: 'paper' | 'live') {
    try {
      const res = await fetch('/api/admin/orchestrator/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType: 'full-pipeline', mode })
      });

      if (res.ok) {
        toast.success(`${mode} run triggered`);
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to trigger run');
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orchestrator</h1>
        <p className="mt-1 text-muted-foreground">
          Configure and monitor automated trading pipeline
        </p>
      </div>

      {config?.killSwitch && (
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">Kill Switch Active</p>
              <p className="text-sm text-muted-foreground">All automated operations are halted</p>
            </div>
            <Button variant="outline" onClick={toggleKillSwitch}>
              Disable Kill Switch
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Kill Switch</Label>
                <p className="text-sm text-muted-foreground">
                  Emergency stop for all operations
                </p>
              </div>
              <Switch
                checked={config?.killSwitch || false}
                onCheckedChange={toggleKillSwitch}
              />
            </div>

            <div className="space-y-3">
              <Label>Mode</Label>
              <div className="flex gap-2">
                <Badge variant={config?.mode === 'paper' ? 'default' : 'outline'}>Paper</Badge>
                <Badge variant={config?.mode === 'live' ? 'default' : 'outline'}>Live</Badge>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Enabled Agents</Label>
              <div className="space-y-2">
                {['Listener', 'Analyzer', 'Decider', 'Executor', 'Reporter'].map(agent => (
                  <div key={agent} className="flex items-center justify-between rounded-lg bg-secondary/50 p-2">
                    <span className="text-sm">{agent}</span>
                    <Badge variant="outline" className="bg-success/10 text-success">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Enabled
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trigger Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => triggerRun('paper')}
              disabled={config?.killSwitch}
              className="w-full"
              variant="outline"
            >
              <Play className="mr-2 h-4 w-4" />
              Run Paper Pipeline
            </Button>
            <Button
              onClick={() => triggerRun('live')}
              disabled={config?.killSwitch}
              className="w-full"
            >
              <Play className="mr-2 h-4 w-4" />
              Run Live Pipeline (Mocked)
            </Button>
            <p className="text-xs text-muted-foreground">
              Trigger a full orchestration cycle. Paper mode is safe for testing.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Job Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {jobs.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No recent runs</p>
            ) : (
              jobs.slice(0, 10).map(job => (
                <div key={job.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{job.jobType}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      job.status === 'completed' && "bg-success/10 text-success",
                      job.status === 'running' && "bg-blue-400/10 text-blue-400",
                      job.status === 'failed' && "bg-destructive/10 text-destructive"
                    )}
                  >
                    {job.status === 'completed' && <CheckCircle className="mr-1 h-3 w-3" />}
                    {job.status === 'running' && <Clock className="mr-1 h-3 w-3" />}
                    {job.status === 'failed' && <XCircle className="mr-1 h-3 w-3" />}
                    {job.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
