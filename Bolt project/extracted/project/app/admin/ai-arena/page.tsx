"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Zap, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AiArenaPage() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Array<{ timestamp: string; prompt: string; response: string; tokens: number }>>([]);

  const handleRunTest = () => {
    if (!prompt.trim()) {
      toast({ title: "Please enter a prompt", variant: "destructive" });
      return;
    }

    setRunning(true);
    toast({ title: "Running AI test..." });

    setTimeout(() => {
      const mockResponse = {
        timestamp: new Date().toLocaleTimeString(),
        prompt: prompt,
        response: `Based on the analysis of ${prompt.includes('market') ? 'current market conditions' : 'the given parameters'}, I recommend ${Math.random() > 0.5 ? 'buying' : 'holding'} positions with a confidence of ${(Math.random() * 30 + 70).toFixed(1)}%. The key factors include momentum indicators, volume profile, and sentiment analysis.`,
        tokens: Math.floor(Math.random() * 500 + 200)
      };

      setResults([mockResponse, ...results]);
      setRunning(false);
      toast({ title: "Test completed successfully" });
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">AI Arena</h1>
        <p className="mt-1 text-muted-foreground">Test prompts and simulate strategy cycles</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Prompt Playground
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter test prompt (e.g., 'Analyze current market conditions for tech stocks')..."
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Button onClick={handleRunTest} disabled={running}>
            <Play className="mr-2 h-4 w-4" />
            {running ? 'Running Test...' : 'Run Test'}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, idx) => (
                <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{result.timestamp}</Badge>
                    <Badge variant="secondary">{result.tokens} tokens</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Prompt:</p>
                    <p className="text-sm">{result.prompt}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Response:</p>
                    <p className="text-sm">{result.response}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
