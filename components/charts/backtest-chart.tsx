"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BacktestChartProps {
  data: Array<{ date: string; equity: number }>;
}

export default function BacktestChart({ data }: BacktestChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="modalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) =>
              new Date(d).toLocaleDateString("en-US", {
                month: "short",
              })
            }
          />
          <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-border bg-card p-2 shadow-lg">
                  <p className="font-medium">
                    ${payload[0].value?.toLocaleString()}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#modalGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
