export function formatCurrency(
  value: number | null | undefined,
  options: { decimals?: number; currency?: string; showSign?: boolean } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const { decimals = 2, currency = "$", showSign = false } = options;
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${currency}${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absValue >= 1e9) {
    return `${sign}$${(absValue / 1e9).toFixed(2)}B`;
  } else if (absValue >= 1e6) {
    return `${sign}$${(absValue / 1e6).toFixed(2)}M`;
  } else if (absValue >= 1e3) {
    return `${sign}$${(absValue / 1e3).toFixed(2)}K`;
  }
  return `${sign}$${absValue.toFixed(2)}`;
}

export function formatPercent(
  value: number | null | undefined,
  options: { decimals?: number; showSign?: boolean } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const { decimals = 2, showSign = true } = options;
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(
  value: number | null | undefined,
  options: { decimals?: number; useGrouping?: boolean } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const { decimals = 0, useGrouping = true } = options;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  });
}

export function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`;
  }
  return value.toString();
}

export function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  if (value < 0.01) {
    return `$${value.toFixed(8)}`;
  } else if (value < 1) {
    return `$${value.toFixed(4)}`;
  } else if (value < 1000) {
    return `$${value.toFixed(2)}`;
  }
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  if (value === Math.floor(value)) {
    return value.toLocaleString("en-US");
  }
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function formatPnL(
  value: number | null | undefined,
  options: { compact?: boolean } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const { compact = false } = options;
  const sign = value >= 0 ? "+" : "";
  if (compact) {
    const absValue = Math.abs(value);
    if (absValue >= 1e6) {
      return `${sign}$${(value / 1e6).toFixed(2)}M`;
    } else if (absValue >= 1e3) {
      return `${sign}$${(value / 1e3).toFixed(2)}K`;
    }
  }
  return `${sign}$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatTimestamp(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMarketCap(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  return `$${value.toLocaleString("en-US")}`;
}

export function getPercentColor(value: number | null | undefined): "positive" | "negative" | "neutral" {
  if (value === null || value === undefined || isNaN(value)) return "neutral";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

export function getPnLColor(value: number | null | undefined, colors: { success: string; error: string; neutral: string }): string {
  if (value === null || value === undefined || isNaN(value)) return colors.neutral;
  if (value > 0) return colors.success;
  if (value < 0) return colors.error;
  return colors.neutral;
}
