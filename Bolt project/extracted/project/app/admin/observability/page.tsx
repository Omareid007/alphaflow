"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Activity, AlertCircle } from "lucide-react";

export default function ObservabilityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Observability</h1>
        <p className="mt-1 text-muted-foreground">System logs, metrics, and alerts</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Query and view system logs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">System performance metrics</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Configure alert rules</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
