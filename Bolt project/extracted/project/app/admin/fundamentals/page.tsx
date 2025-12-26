"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Factor {
  id: string;
  name: string;
  source: string;
  cadence: string;
  status: string;
  lastUpdated: string;
}

export default function FundamentalsPage() {
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([
    { id: '1', name: 'P/E Ratio', source: 'Yahoo Finance', cadence: 'Daily', status: 'healthy', lastUpdated: '2 hours ago' },
    { id: '2', name: 'Revenue Growth', source: 'SEC EDGAR', cadence: 'Quarterly', status: 'healthy', lastUpdated: '1 day ago' },
    { id: '3', name: 'Analyst Ratings', source: 'Bloomberg', cadence: 'Real-time', status: 'stale', lastUpdated: '3 days ago' }
  ]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    toast({ title: "Refreshing all fundamental data..." });

    setTimeout(() => {
      setFactors(factors.map(f => ({
        ...f,
        status: 'healthy',
        lastUpdated: 'Just now'
      })));
      setRefreshing(false);
      toast({ title: "All factors refreshed successfully" });
    }, 2000);
  };

  const handleRefreshFactor = (id: string) => {
    toast({ title: "Refreshing factor..." });
    setTimeout(() => {
      setFactors(factors.map(f => f.id === id ? { ...f, status: 'healthy', lastUpdated: 'Just now' } : f));
      toast({ title: "Factor refreshed successfully" });
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Fundamentals</h1>
          <p className="mt-1 text-muted-foreground">Factor catalog and data health</p>
        </div>
        <Button onClick={handleRefreshAll} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
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
          <div className="space-y-3">
            {factors.map(factor => (
              <div key={factor.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex-1">
                  <p className="font-medium">{factor.name}</p>
                  <p className="text-xs text-muted-foreground">{factor.source} • {factor.cadence} • Updated {factor.lastUpdated}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={factor.status === 'healthy' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                    {factor.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => handleRefreshFactor(factor.id)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
