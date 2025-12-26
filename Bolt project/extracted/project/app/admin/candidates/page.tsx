"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Candidate {
  id: string;
  symbol: string;
  score: number;
  rationale: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function CandidatesPage() {
  const { toast } = useToast();
  const [triggering, setTriggering] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([
    { id: '1', symbol: 'NVDA', score: 0.87, rationale: 'Strong momentum + positive sentiment', status: 'pending' },
    { id: '2', symbol: 'AMD', score: 0.75, rationale: 'Technical breakout pattern', status: 'approved' },
    { id: '3', symbol: 'INTC', score: 0.42, rationale: 'Weak fundamentals', status: 'rejected' }
  ]);

  const handleTriggerRun = () => {
    setTriggering(true);
    toast({ title: "Triggering candidate generation run..." });

    setTimeout(() => {
      const newCandidates: Candidate[] = [
        { id: Date.now().toString(), symbol: 'TSLA', score: 0.82, rationale: 'Momentum surge with volume', status: 'pending' },
        { id: (Date.now() + 1).toString(), symbol: 'META', score: 0.78, rationale: 'AI narrative strength', status: 'pending' }
      ];
      setCandidates([...newCandidates, ...candidates]);
      setTriggering(false);
      toast({ title: `Generated ${newCandidates.length} new candidates` });
    }, 2000);
  };

  const handleApprove = (id: string) => {
    setCandidates(candidates.map(c => c.id === id ? { ...c, status: 'approved' as const } : c));
    toast({ title: "Candidate approved" });
  };

  const handleReject = (id: string) => {
    setCandidates(candidates.map(c => c.id === id ? { ...c, status: 'rejected' as const } : c));
    toast({ title: "Candidate rejected" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Candidates</h1>
          <p className="mt-1 text-muted-foreground">Review and approve trading candidates</p>
        </div>
        <Button onClick={handleTriggerRun} disabled={triggering}>
          {triggering ? 'Running...' : 'Trigger Candidate Run'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Candidate List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {candidates.map(cand => (
              <div key={cand.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-semibold">{cand.symbol}</p>
                    <Badge variant="secondary">Score: {cand.score}</Badge>
                    <Badge variant="outline" className={
                      cand.status === 'approved' ? 'bg-success/10 text-success' :
                      cand.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                      'bg-warning/10 text-warning'
                    }>
                      {cand.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{cand.rationale}</p>
                </div>
                {cand.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleApprove(cand.id)}>
                      <Check className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleReject(cand.id)}>
                      <X className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
