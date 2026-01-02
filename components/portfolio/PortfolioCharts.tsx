"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

const COLORS = [
  "hsl(199, 89%, 48%)",
  "hsl(152, 69%, 45%)",
  "hsl(43, 96%, 56%)",
  "hsl(0, 72%, 51%)",
  "hsl(220, 14%, 50%)",
];

export interface AllocationDataItem {
  name: string;
  value: number;
}

export interface PnlDataItem {
  symbol: string;
  pnl: number;
  pnlPercent: number;
}

interface AllocationChartProps {
  data: AllocationDataItem[];
}

interface PositionPnlChartProps {
  data: PnlDataItem[];
}

/**
 * Pie chart showing asset allocation percentages
 * Uses responsive height: 192px on mobile, 288px on desktop
 */
export function AllocationChart({ data }: AllocationChartProps) {
  return (
    <div className="h-48 md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                  <p className="font-medium">{payload[0].name}</p>
                  <p className="text-sm text-muted-foreground">
                    {Number(payload[0].value).toFixed(1)}%
                  </p>
                </div>
              );
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Bar chart showing position P&L
 * Uses responsive height: 192px on mobile, 288px on desktop
 */
export function PositionPnlChart({ data }: PositionPnlChartProps) {
  return (
    <div className="h-48 md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => `$${v}`} />
          <YAxis type="category" dataKey="symbol" width={50} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const chartData = payload[0].payload;
              return (
                <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                  <p className="font-medium">{chartData.symbol}</p>
                  <p
                    className={cn(
                      "text-sm",
                      chartData.pnl >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    ${chartData.pnl.toLocaleString()} (
                    {chartData.pnlPercent.toFixed(1)}%)
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="pnl" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
