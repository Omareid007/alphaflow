"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { AnimatedPipeline } from "@/components/strategies/AnimatedPipeline";
import {
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area,
  AreaChart,
} from "recharts";
import { ArrowLeft, BarChart3, TrendingDown, Zap } from "lucide-react";
import Link from "next/link";

// Simulated price data for visualization
const generateSampleData = (count = 100) => {
  const data = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price += (Math.random() - 0.5) * 2;
    data.push({
      index: i,
      price: Math.max(price, 80),
      date: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000)
        .toLocaleDateString("en-US", { month: "short", day: "numeric" })
        .replace(/^(\w+) (\d+)/, "$1 $2"),
    });
  }
  return data;
};

interface BollingerBands {
  sma: number;
  upperBand: number;
  lowerBand: number;
  stdDev: number;
}

interface DataWithBands {
  index: number;
  price: number;
  date: string;
  sma?: number;
  upperBand?: number;
  lowerBand?: number;
}

function calculateBollingerBands(
  prices: number[],
  period: number,
  stdDevMultiple: number
): BollingerBands | null {
  if (prices.length < period) return null;

  const slice = prices.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const squaredDiffs = slice.map((p) => Math.pow(p - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    sma,
    upperBand: sma + stdDev * stdDevMultiple,
    lowerBand: sma - stdDev * stdDevMultiple,
    stdDev,
  };
}

export default function StrategyInfographic() {
  const [meanPeriod, setMeanPeriod] = useState(20);
  const [stdDevMultiple, setStdDevMultiple] = useState(2.0);
  const [stopLossPercent, setStopLossPercent] = useState(5);

  const sampleData = useMemo(() => generateSampleData(100), []);

  // Calculate Bollinger Bands for all points
  const chartData: DataWithBands[] = useMemo(() => {
    return sampleData.map((point, idx) => {
      const prices = sampleData.slice(0, idx + 1).map((d) => d.price);
      const bands = calculateBollingerBands(prices, meanPeriod, stdDevMultiple);

      return {
        ...point,
        sma: bands?.sma,
        upperBand: bands?.upperBand,
        lowerBand: bands?.lowerBand,
      };
    });
  }, [sampleData, meanPeriod, stdDevMultiple]);

  // Find potential buy signals (price below lower band)
  const buySignals = chartData
    .filter(
      (point) =>
        point.lowerBand &&
        point.price < point.lowerBand &&
        point.index > meanPeriod
    )
    .slice(0, 2);

  // Example trades
  const exampleTrades = [
    {
      symbol: "AAPL",
      entry: 145.23,
      exit: 148.75,
      holdDays: 3,
      reason: "Price reverted to mean",
      status: "closed",
    },
    {
      symbol: "MSFT",
      entry: 378.91,
      exit: 384.12,
      holdDays: 5,
      reason: "Take profit hit",
      status: "closed",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/strategies">
            <Button variant="outline" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Strategies
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-2">Mean Reversion Strategy</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Profit from price extremes by identifying oversold conditions and
            mean reversion opportunities
          </p>
        </div>

        {/* Animated Pipeline */}
        <div className="mb-8">
          <AnimatedPipeline
            values={{
              price: chartData[chartData.length - 1]?.price,
              sma: chartData[chartData.length - 1]?.sma,
              lowerBand: chartData[chartData.length - 1]?.lowerBand,
              zScore: chartData[chartData.length - 1]?.sma
                ? (chartData[chartData.length - 1]!.price -
                    chartData[chartData.length - 1]!.sma!) /
                  ((chartData[chartData.length - 1]!.upperBand! -
                    chartData[chartData.length - 1]!.sma!) /
                    2)
                : 0,
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Strategy Overview */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Strategy Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4 py-2">
                  <h4 className="font-semibold text-sm mb-1">How It Works</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Bollinger Bands create upper and lower boundaries around the
                    20-period simple moving average. When price drops below the
                    lower band (oversold), the strategy identifies a potential
                    buy opportunity based on mean reversion.
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4 py-2">
                  <h4 className="font-semibold text-sm mb-1">Entry Signal</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    BUY when: Price &lt; Lower Band AND Z-Score &lt; -2.0
                    (indicating statistical oversold condition)
                  </p>
                </div>

                <div className="border-l-4 border-orange-500 pl-4 py-2">
                  <h4 className="font-semibold text-sm mb-1">Exit Signals</h4>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                    <li>Price reverts to 20-SMA (mean reversion complete)</li>
                    <li>Stop loss hit (5% below entry)</li>
                    <li>Take profit target reached (at 20-SMA level)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Key Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Win Rate (Historical)
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  62%
                </p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Avg Win/Loss
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  1.8x
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Max Drawdown
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  12%
                </p>
              </div>
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Sharpe Ratio
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  1.45
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Chart with Bollinger Bands */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Bollinger Bands Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(chartData.length / 5)}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.8)",
                    border: "none",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => {
                    if (typeof value === "number") {
                      return `$${value.toFixed(2)}`;
                    }
                    return value;
                  }}
                />

                {/* Bollinger Bands */}
                <Area
                  type="monotone"
                  dataKey="upperBand"
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="upperBand"
                  stroke="rgba(59, 130, 246, 0.5)"
                  strokeDasharray="5 5"
                  dot={false}
                  name="Upper Band"
                />
                <Line
                  type="monotone"
                  dataKey="sma"
                  stroke="rgb(59, 130, 246)"
                  strokeWidth={2}
                  dot={false}
                  name="SMA (20)"
                />
                <Line
                  type="monotone"
                  dataKey="lowerBand"
                  stroke="rgba(59, 130, 246, 0.5)"
                  strokeDasharray="5 5"
                  dot={false}
                  name="Lower Band"
                />

                {/* Price */}
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="rgb(30, 41, 59)"
                  strokeWidth={2.5}
                  dot={false}
                  name="Price"
                  isAnimationActive={false}
                />

                {/* Buy signals */}
                {buySignals.map((signal, idx) => (
                  <ReferenceLine
                    key={`signal-${idx}`}
                    x={signal.index}
                    stroke="rgba(34, 197, 94, 0.5)"
                    strokeDasharray="3 3"
                    label={{
                      value: "BUY",
                      position: "top",
                      fill: "rgb(34, 197, 94)",
                      fontSize: 12,
                      fontWeight: "bold",
                    }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Interactive Parameters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Interactive Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">
                  Mean Period (SMA lookback)
                </label>
                <Badge variant="outline">{meanPeriod}</Badge>
              </div>
              <Slider
                value={[meanPeriod]}
                onValueChange={(value) => setMeanPeriod(value[0])}
                min={10}
                max={50}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Number of periods to calculate simple moving average. Higher
                values smooth out noise but react slower to trends.
              </p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">
                  Standard Deviation Multiple
                </label>
                <Badge variant="outline">{stdDevMultiple.toFixed(1)}</Badge>
              </div>
              <Slider
                value={[stdDevMultiple]}
                onValueChange={(value) => setStdDevMultiple(value[0])}
                min={0.5}
                max={3.0}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Band width multiplier. 2.0 = ±2 standard deviations. Higher
                values create wider bands, fewer signals.
              </p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">
                  Stop Loss Percentage
                </label>
                <Badge variant="outline">{stopLossPercent}%</Badge>
              </div>
              <Slider
                value={[stopLossPercent]}
                onValueChange={(value) => setStopLossPercent(value[0])}
                min={1}
                max={15}
                step={0.5}
                className="w-full"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Maximum loss per trade. Protects against adverse price moves.
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm font-semibold mb-2">Current Settings</p>
              <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                <li>
                  • Buy when price &lt; lower band (SMA -{" "}
                  {stdDevMultiple.toFixed(1)}σ)
                </li>
                <li>• Exit at SMA level or stop loss ({stopLossPercent}%)</li>
                <li>• Re-evaluate every bar for new opportunities</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Example Trades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Example Trades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {exampleTrades.map((trade, idx) => {
                const pnl = trade.exit - trade.entry;
                const pnlPercent = ((pnl / trade.entry) * 100).toFixed(2);
                const isProfit = pnl > 0;

                return (
                  <div
                    key={idx}
                    className="p-4 border rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{trade.symbol}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Closed • {trade.holdDays} days
                        </p>
                      </div>
                      <Badge
                        className={
                          isProfit
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                        }
                      >
                        {isProfit ? "+" : ""}
                        {pnlPercent}%
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-slate-600 dark:text-slate-400">
                          Entry
                        </p>
                        <p className="font-semibold">
                          ${trade.entry.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600 dark:text-slate-400">
                          Exit
                        </p>
                        <p className="font-semibold">
                          ${trade.exit.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600 dark:text-slate-400">
                          P&L
                        </p>
                        <p
                          className={`font-semibold ${
                            isProfit
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          ${Math.abs(pnl).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3">
                      <Zap className="w-3 h-3 inline mr-1" />
                      {trade.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link href="/create">
            <Button size="lg" className="gap-2">
              Create Mean Reversion Strategy
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
