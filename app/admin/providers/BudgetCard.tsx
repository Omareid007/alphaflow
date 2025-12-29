import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign } from "lucide-react";
import { Budget, UsageMetrics } from "@/lib/admin/types";

interface BudgetCardProps {
  budget: Budget | null;
  usageMetrics: UsageMetrics[];
  onUpdateBudget: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function BudgetCard({
  budget,
  usageMetrics,
  onUpdateBudget,
}: BudgetCardProps) {
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    onUpdateBudget(e);
    setBudgetDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-4 w-4" />
          Budget
        </CardTitle>
        <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Budget</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Daily Limit ($)</Label>
                <Input
                  name="dailyLimit"
                  type="number"
                  step="0.01"
                  defaultValue={budget?.dailyLimit || 0}
                  required
                />
              </div>
              <div>
                <Label>Monthly Limit ($)</Label>
                <Input
                  name="monthlyLimit"
                  type="number"
                  step="0.01"
                  defaultValue={budget?.monthlyLimit || 0}
                  required
                />
              </div>
              <div>
                <Label>Soft Limit ($)</Label>
                <Input
                  name="softLimit"
                  type="number"
                  step="0.01"
                  defaultValue={budget?.softLimit || 0}
                  required
                />
              </div>
              <div>
                <Label>Hard Limit ($)</Label>
                <Input
                  name="hardLimit"
                  type="number"
                  step="0.01"
                  defaultValue={budget?.hardLimit || 0}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Update Budget
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {budget && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-sm text-muted-foreground">Daily Usage</p>
                <p className="text-2xl font-semibold">
                  ${budget.usageToday.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  of ${budget.dailyLimit.toFixed(2)} limit
                </p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-sm text-muted-foreground">Monthly Usage</p>
                <p className="text-2xl font-semibold">
                  ${budget.usageMonth.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  of ${budget.monthlyLimit.toFixed(2)} limit
                </p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usageMetrics}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                          <p className="text-sm text-muted-foreground">
                            {new Date(
                              payload[0].payload.date
                            ).toLocaleDateString()}
                          </p>
                          <p className="font-semibold">
                            ${Number(payload[0].value).toFixed(2)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
