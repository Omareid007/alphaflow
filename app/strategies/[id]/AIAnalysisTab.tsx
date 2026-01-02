import { BacktestRun } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface AIAnalysisTabProps {
  backtest: BacktestRun;
}

export function AIAnalysisTab({ backtest }: AIAnalysisTabProps) {
  if (!backtest.interpretation) {
    return (
      <Card variant="glass">
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-medium text-muted-foreground mb-2">
            No AI analysis available yet
          </p>
          <p className="text-sm text-muted-foreground/70">
            AI analysis will appear here once the backtest is interpreted
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card variant="glass" className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                AI Analysis
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Intelligent strategy insights
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="rounded-xl bg-secondary/30 p-6 border border-border/50">
              <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {backtest.interpretation}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
