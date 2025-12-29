"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFundamentalFactors, useRefreshFundamentals } from "@/lib/api/hooks";

export default function FundamentalsPage() {
  const { toast } = useToast();
  const { data: factors = [], isLoading, refetch } = useFundamentalFactors();
  const refreshFundamentals = useRefreshFundamentals();

  const handleRefreshAll = async () => {
    try {
      toast({ title: "Refreshing all fundamental data..." });
      await refreshFundamentals.mutateAsync();
      await refetch();
      toast({ title: "All factors refreshed successfully" });
    } catch (error) {
      toast({
        title: "Failed to refresh fundamentals",
        variant: "destructive",
      });
    }
  };

  const handleRefreshFactor = (id: string) => {
    toast({ title: "Refreshing factor..." });
    // In a real implementation, this would refresh a specific factor
    setTimeout(() => {
      refetch();
      toast({ title: "Factor refreshed successfully" });
    }, 1000);
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
          <h1 className="text-3xl font-semibold tracking-tight">
            Fundamentals
          </h1>
          <p className="mt-1 text-muted-foreground">
            Factor catalog and data health ({factors.length} factors)
          </p>
        </div>
        <Button
          onClick={handleRefreshAll}
          disabled={refreshFundamentals.isPending}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${refreshFundamentals.isPending ? "animate-spin" : ""}`}
          />
          Refresh All
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Factor Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          {factors.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                No fundamental factors found.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {factors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="flex-1">
                    <p className="font-medium">{factor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {factor.source} • {factor.cadence} • Updated{" "}
                      {new Date(factor.lastUpdated).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        factor.status === "healthy"
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }
                    >
                      {factor.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefreshFactor(factor.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
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
