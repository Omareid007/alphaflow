"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export function ConnectionsCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">Connections</CardTitle>
            <CardDescription>Broker and data feed integrations</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="font-medium">Brokerage Account</p>
            <p className="text-sm text-muted-foreground">Connect your trading account</p>
          </div>
          <Button variant="outline" disabled>
            Coming Soon
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="font-medium">Market Data Feed</p>
            <p className="text-sm text-muted-foreground">Real-time market data provider</p>
          </div>
          <Button variant="outline" disabled>
            Coming Soon
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
