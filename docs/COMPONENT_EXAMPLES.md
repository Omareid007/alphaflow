# Component Examples - Robinhood UI

Quick copy-paste examples for common UI patterns.

## Trading Cards

### Position Card

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function PositionCard({ symbol, shares, value, change, changePercent }) {
  const isGain = change >= 0;

  return (
    <Card variant={isGain ? "trading-gain" : "trading-loss"} hoverEffect="lift">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold">{symbol}</CardTitle>
        <Badge variant={isGain ? "gain-subtle" : "loss-subtle"}>
          {isGain ? "+" : ""}
          {changePercent.toFixed(2)}%
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">${value.toLocaleString()}</div>
        <div className="text-sm text-muted-foreground">{shares} shares</div>
        <div className={isGain ? "text-gain" : "text-loss"}>
          {isGain ? "+" : ""}${Math.abs(change).toFixed(2)}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Metric Card with Animation

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedValue } from "@/components/charts/animated-value";

function MetricCard({ label, value, previousValue }) {
  return (
    <Card variant="glass">
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <AnimatedValue
          value={value}
          previousValue={previousValue}
          format="currency"
          className="text-2xl font-bold"
        />
      </CardContent>
    </Card>
  );
}
```

---

## Trading Buttons

### Buy/Sell Button Pair

```tsx
import { Button } from "@/components/ui/button";

function TradingButtons({ onBuy, onSell, disabled }) {
  return (
    <div className="flex gap-2">
      <Button
        variant="gain"
        size="pill-lg"
        onClick={onBuy}
        disabled={disabled}
        className="flex-1"
      >
        Buy
      </Button>
      <Button
        variant="loss"
        size="pill-lg"
        onClick={onSell}
        disabled={disabled}
        className="flex-1"
      >
        Sell
      </Button>
    </div>
  );
}
```

### Order Type Buttons

```tsx
import { Button } from "@/components/ui/button";
import { useState } from "react";

function OrderTypeSelector() {
  const [type, setType] = useState("market");

  return (
    <div className="flex gap-1 p-1 bg-secondary rounded-full">
      <Button
        variant={type === "market" ? "default" : "ghost"}
        size="pill"
        onClick={() => setType("market")}
      >
        Market
      </Button>
      <Button
        variant={type === "limit" ? "default" : "ghost"}
        size="pill"
        onClick={() => setType("limit")}
      >
        Limit
      </Button>
      <Button
        variant={type === "stop" ? "default" : "ghost"}
        size="pill"
        onClick={() => setType("stop")}
      >
        Stop
      </Button>
    </div>
  );
}
```

---

## Market Status Badges

```tsx
import { Badge } from "@/components/ui/badge";

function MarketStatusBadge({ status }) {
  const variants = {
    open: "market-open",
    closed: "market-closed",
    pre: "market-pre",
    after: "market-after",
  };

  const labels = {
    open: "Market Open",
    closed: "Closed",
    pre: "Pre-Market",
    after: "After Hours",
  };

  return (
    <Badge variant={variants[status]} className="animate-pulse">
      {labels[status]}
    </Badge>
  );
}
```

---

## Price Display with Sparkline

```tsx
import { Sparkline } from "@/components/charts/sparkline";
import { AnimatedValue } from "@/components/charts/animated-value";

function PriceWithSparkline({ symbol, price, previousPrice, history }) {
  const isUp = price >= previousPrice;

  return (
    <div className="flex items-center gap-4">
      <div>
        <div className="font-bold">{symbol}</div>
        <AnimatedValue
          value={price}
          previousValue={previousPrice}
          format="currency"
          className="text-xl"
        />
      </div>
      <Sparkline
        data={history}
        width={80}
        height={32}
        color={isUp ? "var(--gain)" : "var(--loss)"}
      />
    </div>
  );
}
```

---

## Loading States

### Shimmer Cards

```tsx
import { CardShimmer, MetricCardShimmer } from "@/lib/animations";

function LoadingDashboard() {
  return (
    <div className="space-y-4">
      {/* Hero metrics */}
      <MetricCardShimmer count={4} />

      {/* Main content cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <CardShimmer />
        <CardShimmer />
      </div>
    </div>
  );
}
```

### Table Loading

```tsx
import { TableRowShimmer } from "@/lib/animations";

function LoadingTable() {
  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="bg-muted p-3 font-semibold">Positions</div>
      <TableRowShimmer rows={5} />
    </div>
  );
}
```

---

## Stagger Animations

### Animated List

```tsx
import { StaggerList, StaggerItem } from "@/lib/animations";

function PositionsList({ positions }) {
  return (
    <StaggerList speed="fast" className="space-y-2">
      {positions.map((position) => (
        <StaggerItem key={position.id}>
          <PositionCard {...position} />
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
```

### Scroll-Triggered Animation

```tsx
import { AnimateOnScroll, fadeInUp } from "@/lib/animations";

function FeatureSection({ title, description }) {
  return (
    <AnimateOnScroll variant={fadeInUp} once>
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="text-muted-foreground mt-2">{description}</p>
      </div>
    </AnimateOnScroll>
  );
}
```

---

## Glass Morphism Overlay

```tsx
function GlassOverlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div className="absolute inset-x-4 bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-8 md:w-[400px]">
        <Card variant="glass-strong" className="p-6">
          {children}
        </Card>
      </div>
    </div>
  );
}
```

---

## Responsive Sidebar

```tsx
import { Sidebar } from "@/components/layout/sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 pb-16 lg:pb-0">{children}</main>

      {/* Mobile bottom navigation */}
      <div className="lg:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
}
```

---

## Theme Toggle

```tsx
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor } from "lucide-react";
import { useUserPreferences } from "@/lib/api/hooks/useUserPreferences";

function ThemeToggle() {
  const { preferences, updatePreference } = useUserPreferences();

  const themes = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div className="flex gap-1 p-1 bg-secondary rounded-lg">
      {themes.map(({ value, icon: Icon, label }) => (
        <Button
          key={value}
          variant={preferences.theme === value ? "default" : "ghost"}
          size="sm"
          onClick={() => updatePreference("theme", value)}
          className="gap-2"
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
    </div>
  );
}
```

---

## Confetti Celebration

```tsx
import { useConfetti } from "@/lib/animations";
import { Button } from "@/components/ui/button";

function OrderConfirmation({ order }) {
  const { triggerConfetti, ConfettiComponent } = useConfetti();

  useEffect(() => {
    if (order.status === "filled") {
      triggerConfetti();
    }
  }, [order.status]);

  return (
    <>
      <ConfettiComponent />
      <Card variant="trading-gain">
        <CardContent className="text-center py-8">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-xl font-bold text-gain">Order Filled!</h2>
          <p className="text-muted-foreground">
            {order.qty} shares of {order.symbol} at ${order.filled_avg_price}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
```

---

## Form Inputs

```tsx
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function TradeForm() {
  return (
    <form className="space-y-4">
      <div>
        <label className="text-sm text-muted-foreground">Symbol</label>
        <Input placeholder="AAPL" className="uppercase" />
      </div>

      <div>
        <label className="text-sm text-muted-foreground">Quantity</label>
        <Input type="number" placeholder="100" min={1} />
      </div>

      <div>
        <label className="text-sm text-muted-foreground">Limit Price</label>
        <Input type="number" placeholder="0.00" step={0.01} leftAddon="$" />
      </div>

      <Button variant="gain" className="w-full" size="lg">
        Place Order
      </Button>
    </form>
  );
}
```

---

**See also**:

- [Full Theming Guide](./THEMING_GUIDE.md)
- [Customization Quick Reference](./THEME_CUSTOMIZATION_QUICK_REF.md)
