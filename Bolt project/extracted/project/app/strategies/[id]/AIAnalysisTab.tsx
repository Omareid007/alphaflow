import { BacktestRun } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";

interface AIAnalysisTabProps {
  backtest: BacktestRun;
}

export function AIAnalysisTab({ backtest }: AIAnalysisTabProps) {
  if (!backtest.interpretation) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No AI analysis available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <p className="text-muted-foreground whitespace-pre-wrap">{backtest.interpretation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
