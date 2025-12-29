"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Plus, Play, Zap } from "lucide-react";
import { toast } from "sonner";

export default function LlmRouterPage() {
  const [taskType, setTaskType] = useState("analysis");
  const [promptLength, setPromptLength] = useState(1000);
  const [routingResult, setRoutingResult] = useState<any>(null);

  async function handleDryRun() {
    try {
      const res = await fetch(`/api/admin/llm-router/dry-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType, promptLength }),
      });

      if (res.ok) {
        const result = await res.json();
        setRoutingResult(result);
      } else {
        toast.error("Dry run failed");
      }
    } catch (error) {
      toast.error("Failed to run routing test");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">LLM Router</h1>
          <p className="mt-1 text-muted-foreground">
            Manage LLM models and routing rules
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Model
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">LLM Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "GPT-4", context: "8k", cost: 0.03 },
                { name: "GPT-3.5 Turbo", context: "16k", cost: 0.001 },
                { name: "Claude-3 Opus", context: "200k", cost: 0.015 },
                { name: "Llama-2-70B", context: "4k", cost: 0.0007 },
              ].map((model) => (
                <div
                  key={model.name}
                  className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"
                >
                  <div>
                    <p className="font-medium">{model.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {model.context} context • ${model.cost}/1k tokens
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-success/10 text-success"
                  >
                    Enabled
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="h-4 w-4" />
              Dry Run Routing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Task Type</Label>
              <Input
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                placeholder="e.g., analysis, generation, classification"
              />
            </div>
            <div>
              <Label>Prompt Length (tokens)</Label>
              <Input
                type="number"
                value={promptLength}
                onChange={(e) => setPromptLength(Number(e.target.value))}
              />
            </div>
            <Button onClick={handleDryRun} className="w-full">
              <Zap className="mr-2 h-4 w-4" />
              Run Dry Run
            </Button>

            {routingResult && (
              <div className="mt-4 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium">Selected Model:</p>
                <p className="text-lg font-semibold">
                  {routingResult.selectedModel?.modelName || "GPT-3.5 Turbo"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {routingResult.reason ||
                    "Default selection based on cost optimization"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Estimated cost: $
                  {routingResult.estimatedCost?.toFixed(5) || "0.00100"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Routing Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                name: "High Priority Analysis",
                match: "analysis + premium",
                model: "GPT-4",
              },
              { name: "Code Generation", match: "code + *", model: "Claude-3" },
              { name: "Quick Tasks", match: "* + fast", model: "GPT-3.5" },
            ].map((rule) => (
              <div
                key={rule.name}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Match: {rule.match} → {rule.model}
                  </p>
                </div>
                <Badge variant="outline">Active</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
