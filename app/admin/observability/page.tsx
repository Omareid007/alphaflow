"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Activity,
  AlertCircle,
  RefreshCw,
  Server,
  Clock,
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  useSystemMetrics,
  useSystemHealth,
  useSystemLogs,
} from "@/lib/api/hooks";
import { useAuth } from "@/components/providers/auth-provider";

export default function ObservabilityPage() {
  const { isAuthenticated } = useAuth();
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useSystemMetrics(isAuthenticated);
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useSystemHealth(isAuthenticated);
  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = useSystemLogs(20, 0, isAuthenticated);

  const isLoading = metricsLoading || healthLoading || logsLoading;

  const handleRefresh = () => {
    refetchMetrics();
    refetchHealth();
    refetchLogs();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "unhealthy":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge variant="outline" className="bg-success/10 text-success">Healthy</Badge>;
      case "degraded":
        return <Badge variant="outline" className="bg-warning/10 text-warning">Degraded</Badge>;
      case "unhealthy":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive">Unhealthy</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
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
          <h1 className="text-3xl font-semibold tracking-tight">Observability</h1>
          <p className="mt-1 text-muted-foreground">System logs, metrics, and alerts</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* System Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Server className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Memory Usage</p>
                <p className="text-2xl font-semibold">
                  {metrics?.system.memoryUsedMB || 0} MB
                </p>
                <p className="text-xs text-muted-foreground">
                  of {metrics?.system.memoryTotalMB || 0} MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <Clock className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uptime</p>
                <p className="text-2xl font-semibold">
                  {metrics?.system.uptimeHours || 0} hrs
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics?.system.nodeVersion || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-400/10">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
                <p className="text-2xl font-semibold">
                  {metrics?.workQueue.running || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics?.workQueue.pending || 0} pending
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <AlertCircle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed Jobs</p>
                <p className="text-2xl font-semibold">
                  {metrics?.workQueue.failed || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics?.workQueue.completed || 0} completed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Service Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Service Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {health?.services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(service.status)}
                  <span className="text-sm font-medium">{service.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{service.message}</span>
                  {getStatusBadge(service.status)}
                </div>
              </div>
            ))}
            {health && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Status</span>
                  {getStatusBadge(health.overall)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Recent Activity ({logs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No recent activity logs
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {logs.map((log, index) => (
                  <div
                    key={log.id || index}
                    className="flex items-start gap-2 rounded-lg bg-secondary/30 p-2 text-xs"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {log.action || "activity"}
                        </Badge>
                        <span className="text-muted-foreground">
                          {log.resource || "system"}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-secondary/50 p-4">
              <p className="text-sm text-muted-foreground">Logs (Last 24h)</p>
              <p className="text-2xl font-semibold">{metrics?.activity.logsLast24h || 0}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-4">
              <p className="text-sm text-muted-foreground">Total Recent Logs</p>
              <p className="text-2xl font-semibold">{metrics?.activity.totalRecentLogs || 0}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-4">
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="text-lg font-semibold">
                {metrics?.timestamp
                  ? new Date(metrics.timestamp).toLocaleTimeString()
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
