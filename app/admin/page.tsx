"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Server,
  Brain,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  XCircle,
} from "lucide-react";
import { useAdminDashboard, useSystemHealth } from "@/lib/api/hooks";
import { useAuth } from "@/components/providers/auth-provider";

export default function AdminDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Only fetch data when authenticated
  const { data: stats, isLoading: statsLoading } =
    useAdminDashboard(isAuthenticated);
  const { data: health, isLoading: healthLoading } =
    useSystemHealth(isAuthenticated);

  const loading = authLoading || statsLoading || healthLoading;

  const getStatusBadge = (status: string, message: string) => {
    switch (status) {
      case "healthy":
        return (
          <Badge variant="outline" className="bg-success/10 text-success">
            <CheckCircle className="mr-1 h-3 w-3" />
            {message}
          </Badge>
        );
      case "degraded":
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {message}
          </Badge>
        );
      case "unhealthy":
        return (
          <Badge
            variant="outline"
            className="bg-destructive/10 text-destructive"
          >
            <XCircle className="mr-1 h-3 w-3" />
            {message}
          </Badge>
        );
      default:
        return <Badge variant="outline">{message}</Badge>;
    }
  };

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
        <h1 className="text-3xl font-semibold tracking-tight">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          System overview and quick actions
        </p>
      </div>

      {stats?.killSwitch && (
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">
                Kill Switch Enabled
              </p>
              <p className="text-sm text-muted-foreground">
                All automated trading operations are halted
              </p>
            </div>
            <Link href="/admin/orchestrator" className="ml-auto">
              <Button variant="outline" size="sm">
                Manage
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Server className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Providers</p>
                <p className="text-2xl font-semibold">
                  {stats?.providers.active || 0}/{stats?.providers.total || 0}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <Brain className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LLM Models</p>
                <p className="text-2xl font-semibold">
                  {stats?.models.enabled || 0}/{stats?.models.total || 0}
                </p>
                <p className="text-xs text-muted-foreground">Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-400/10">
                <Clock className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Running Jobs</p>
                <p className="text-2xl font-semibold">
                  {stats?.jobs.running || 0}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed Jobs</p>
                <p className="text-2xl font-semibold">
                  {stats?.jobs.failed || 0}
                </p>
                <p className="text-xs text-muted-foreground">Last 24h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/providers">
              <Button variant="outline" className="w-full justify-start">
                <Server className="mr-2 h-4 w-4" />
                Manage Providers
              </Button>
            </Link>
            <Link href="/admin/llm-router">
              <Button variant="outline" className="w-full justify-start">
                <Brain className="mr-2 h-4 w-4" />
                Configure LLM Routing
              </Button>
            </Link>
            <Link href="/admin/orchestrator">
              <Button variant="outline" className="w-full justify-start">
                <Settings className="mr-2 h-4 w-4" />
                Orchestrator Settings
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {health?.services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"
              >
                <span className="text-sm">{service.name}</span>
                {getStatusBadge(service.status, service.message)}
              </div>
            )) || (
              <>
                <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                  <span className="text-sm">Database Connection</span>
                  <Badge
                    variant="outline"
                    className="bg-success/10 text-success"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Healthy
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                  <span className="text-sm">API Endpoints</span>
                  <Badge
                    variant="outline"
                    className="bg-success/10 text-success"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Operational
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                  <span className="text-sm">Background Jobs</span>
                  <Badge
                    variant="outline"
                    className="bg-success/10 text-success"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Running
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
