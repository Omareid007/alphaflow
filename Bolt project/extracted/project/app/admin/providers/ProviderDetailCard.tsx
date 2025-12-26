import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TestTube, RotateCw } from "lucide-react";
import { Provider } from "@/lib/admin/types";

interface ProviderDetailCardProps {
  provider: Provider;
  onTestConnection: (id: string) => void;
  onRefresh: (id: string) => void;
}

export function ProviderDetailCard({
  provider,
  onTestConnection,
  onRefresh
}: ProviderDetailCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{provider.name}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTestConnection(provider.id)}
          >
            <TestTube className="mr-2 h-4 w-4" />
            Test Connection
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRefresh(provider.id)}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="font-medium capitalize">{provider.type}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={
              provider.status === 'active' ? 'bg-success/10 text-success' :
              provider.status === 'error' ? 'bg-destructive/10 text-destructive' :
              'bg-warning/10 text-warning'
            }>
              {provider.status}
            </Badge>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-muted-foreground">Base URL</p>
            <p className="font-medium break-all">{provider.baseUrl || 'Not set'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">API Version</p>
            <p className="font-medium">{provider.apiVersion || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Auth Method</p>
            <p className="font-medium capitalize">{provider.authMethod || 'header'}</p>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <h4 className="font-medium text-sm">Rate Limiting</h4>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground">Max Requests</p>
              <p className="font-medium">{provider.rateLimitRequests || 100}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Time Window</p>
              <p className="font-medium">{provider.rateLimitWindowSeconds || 60}s</p>
            </div>
            <div>
              <p className="text-muted-foreground">Per Key</p>
              <p className="font-medium">{provider.rateLimitPerKey ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <h4 className="font-medium text-sm">Retry Policy</h4>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground">Enabled</p>
              <p className="font-medium">{provider.retryEnabled ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Max Attempts</p>
              <p className="font-medium">{provider.retryMaxAttempts || 3}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Backoff</p>
              <p className="font-medium">{provider.retryBackoffMs || 1000}ms × {provider.retryBackoffMultiplier || 2}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <h4 className="font-medium text-sm">Timeouts</h4>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground">Connect</p>
              <p className="font-medium">{provider.timeoutConnectMs || 5000}ms</p>
            </div>
            <div>
              <p className="text-muted-foreground">Request</p>
              <p className="font-medium">{provider.timeoutRequestMs || 30000}ms</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="font-medium">{provider.timeoutTotalMs || 60000}ms</p>
            </div>
          </div>
        </div>

        {provider.healthCheckEnabled && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="font-medium text-sm">Health Check</h4>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <p className="text-muted-foreground">Endpoint</p>
                <p className="font-medium">{provider.healthCheckEndpoint || '/health'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Interval</p>
                <p className="font-medium">{provider.healthCheckIntervalSeconds || 300}s</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Check</p>
                <p className="font-medium">{provider.lastHealthCheck ? new Date(provider.lastHealthCheck).toLocaleString() : 'Never'}</p>
              </div>
            </div>
          </div>
        )}

        {provider.tags && provider.tags.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <h4 className="font-medium text-sm">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {provider.tags.map((tag: string) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
