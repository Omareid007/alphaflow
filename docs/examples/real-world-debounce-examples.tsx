/**
 * Real-world examples of debounced form components
 *
 * These examples demonstrate practical usage patterns for the Input and Textarea
 * components with debouncing support in a trading platform context.
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/form-error";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

// ============================================================================
// Example 1: Trading Symbol Search with Live Quotes
// ============================================================================

export function SymbolSearchWithQuotes() {
  const [symbol, setSymbol] = useState("");
  const [debouncedSymbol, setDebouncedSymbol] = useState("");

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", debouncedSymbol],
    queryFn: () =>
      fetch(`/api/quotes/${debouncedSymbol}`).then((r) => r.json()),
    enabled: debouncedSymbol.length >= 1,
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          debounceMs={300}
          onDebouncedChange={setDebouncedSymbol}
          placeholder="AAPL, TSLA, etc."
          className="font-mono"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        )}
      </div>

      {quote && (
        <div className="p-3 rounded-md border bg-card">
          <div className="flex justify-between items-center">
            <span className="font-semibold">{quote.symbol}</span>
            <span className="text-lg">${quote.price.toFixed(2)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {quote.change > 0 ? "+" : ""}
            {quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 2: Strategy Notes with Auto-Save
// ============================================================================

interface SaveStatus {
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
}

export function StrategyNotesEditor({ strategyId }: { strategyId: string }) {
  const [notes, setNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ status: "idle" });

  const autoSave = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setSaveStatus({ status: "saving" });

      try {
        const response = await fetch(`/api/strategies/${strategyId}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: content }),
        });

        if (!response.ok) throw new Error("Failed to save");

        setSaveStatus({
          status: "saved",
          message: `Saved at ${new Date().toLocaleTimeString()}`,
        });

        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus({ status: "idle" }), 2000);
      } catch (error) {
        setSaveStatus({
          status: "error",
          message: "Failed to save notes",
        });
      }
    },
    [strategyId]
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium">Strategy Notes</label>
        <span className="text-xs text-muted-foreground">
          {saveStatus.status === "saving" && "Saving..."}
          {saveStatus.status === "saved" && `✓ ${saveStatus.message}`}
          {saveStatus.status === "error" && `✗ ${saveStatus.message}`}
        </span>
      </div>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        debounceMs={2000}
        onDebouncedChange={autoSave}
        placeholder="Add notes about this strategy..."
        className="min-h-[200px] font-mono text-sm"
      />

      <p className="text-xs text-muted-foreground">
        Notes are auto-saved 2 seconds after you stop typing
      </p>
    </div>
  );
}

// ============================================================================
// Example 3: Order Quantity Validation
// ============================================================================

interface PositionLimit {
  maxQuantity: number;
  maxValue: number;
  currentQuantity: number;
}

export function OrderQuantityInput({ symbol }: { symbol: string }) {
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [validating, setValidating] = useState(false);

  const validateQuantity = useCallback(
    async (qty: string) => {
      const numQty = parseInt(qty, 10);

      if (!qty || isNaN(numQty)) {
        setError(undefined);
        setValidating(false);
        return;
      }

      setValidating(true);

      try {
        // Call API to validate against position limits
        const response = await fetch(`/api/validate-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, quantity: numQty }),
        });

        const result = await response.json();

        if (!result.valid) {
          setError(result.error || "Invalid quantity");
        } else {
          setError(undefined);
        }
      } catch (err) {
        setError("Failed to validate quantity");
      } finally {
        setValidating(false);
      }
    },
    [symbol]
  );

  return (
    <div className="space-y-2">
      <label htmlFor="quantity" className="text-sm font-medium">
        Quantity
      </label>

      <div className="relative">
        <Input
          id="quantity"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          debounceMs={500}
          onDebouncedChange={validateQuantity}
          placeholder="0"
          min="1"
          step="1"
          aria-describedby={error ? "quantity-error" : undefined}
          aria-invalid={!!error}
          className={error ? "border-destructive" : ""}
        />
        {validating && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {error && <FieldError id="quantity-error" message={error} />}
    </div>
  );
}

// ============================================================================
// Example 4: Multi-Field Strategy Form with Validation
// ============================================================================

interface StrategyFormData {
  name: string;
  description: string;
  maxPositionSize: string;
  stopLoss: string;
}

interface ValidationErrors {
  name?: string;
  description?: string;
  maxPositionSize?: string;
  stopLoss?: string;
}

export function StrategyConfigForm() {
  const [formData, setFormData] = useState<StrategyFormData>({
    name: "",
    description: "",
    maxPositionSize: "",
    stopLoss: "",
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateField = useCallback(
    (field: keyof StrategyFormData, value: string) => {
      const newErrors: ValidationErrors = { ...errors };

      switch (field) {
        case "name":
          if (value.length < 3) {
            newErrors.name = "Name must be at least 3 characters";
          } else if (value.length > 50) {
            newErrors.name = "Name must be less than 50 characters";
          } else {
            delete newErrors.name;
          }
          break;

        case "description":
          if (value.length > 500) {
            newErrors.description =
              "Description must be less than 500 characters";
          } else {
            delete newErrors.description;
          }
          break;

        case "maxPositionSize":
          const size = parseFloat(value);
          if (isNaN(size) || size <= 0) {
            newErrors.maxPositionSize = "Must be a positive number";
          } else if (size > 100000) {
            newErrors.maxPositionSize = "Position size too large";
          } else {
            delete newErrors.maxPositionSize;
          }
          break;

        case "stopLoss":
          const stopLoss = parseFloat(value);
          if (isNaN(stopLoss) || stopLoss <= 0 || stopLoss >= 100) {
            newErrors.stopLoss = "Must be between 0 and 100";
          } else {
            delete newErrors.stopLoss;
          }
          break;
      }

      setErrors(newErrors);
    },
    [errors]
  );

  const updateField = (field: keyof StrategyFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <form className="space-y-4">
      {/* Strategy Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Strategy Name *
        </label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => updateField("name", e.target.value)}
          debounceMs={300}
          onDebouncedChange={(val) => validateField("name", val)}
          placeholder="My Trading Strategy"
          aria-describedby={errors.name ? "name-error" : undefined}
          aria-invalid={!!errors.name}
          className={errors.name ? "border-destructive" : ""}
        />
        {errors.name && <FieldError id="name-error" message={errors.name} />}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          debounceMs={500}
          onDebouncedChange={(val) => validateField("description", val)}
          placeholder="Describe your strategy..."
          className={errors.description ? "border-destructive" : ""}
          aria-describedby={
            errors.description ? "description-error" : undefined
          }
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <FieldError id="description-error" message={errors.description} />
        )}
      </div>

      {/* Max Position Size */}
      <div className="space-y-2">
        <label htmlFor="maxPositionSize" className="text-sm font-medium">
          Max Position Size ($) *
        </label>
        <Input
          id="maxPositionSize"
          type="number"
          value={formData.maxPositionSize}
          onChange={(e) => updateField("maxPositionSize", e.target.value)}
          debounceMs={400}
          onDebouncedChange={(val) => validateField("maxPositionSize", val)}
          placeholder="10000"
          aria-describedby={errors.maxPositionSize ? "size-error" : undefined}
          aria-invalid={!!errors.maxPositionSize}
          className={errors.maxPositionSize ? "border-destructive" : ""}
        />
        {errors.maxPositionSize && (
          <FieldError id="size-error" message={errors.maxPositionSize} />
        )}
      </div>

      {/* Stop Loss */}
      <div className="space-y-2">
        <label htmlFor="stopLoss" className="text-sm font-medium">
          Stop Loss (%) *
        </label>
        <Input
          id="stopLoss"
          type="number"
          value={formData.stopLoss}
          onChange={(e) => updateField("stopLoss", e.target.value)}
          debounceMs={400}
          onDebouncedChange={(val) => validateField("stopLoss", val)}
          placeholder="5.0"
          step="0.1"
          aria-describedby={errors.stopLoss ? "stoploss-error" : undefined}
          aria-invalid={!!errors.stopLoss}
          className={errors.stopLoss ? "border-destructive" : ""}
        />
        {errors.stopLoss && (
          <FieldError id="stoploss-error" message={errors.stopLoss} />
        )}
      </div>

      <button
        type="submit"
        disabled={Object.keys(errors).length > 0}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
      >
        Create Strategy
      </button>
    </form>
  );
}

// ============================================================================
// Example 5: Search with Filters
// ============================================================================

export function StrategySearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: results, isLoading } = useQuery({
    queryKey: ["strategies", debouncedQuery],
    queryFn: () =>
      fetch(`/api/strategies/search?q=${debouncedQuery}`).then((r) => r.json()),
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <div className="space-y-4">
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        debounceMs={300}
        onDebouncedChange={setDebouncedQuery}
        placeholder="Search strategies..."
        className="w-full"
      />

      {isLoading && (
        <div className="text-sm text-muted-foreground">Searching...</div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((strategy: any) => (
            <div key={strategy.id} className="p-3 border rounded-md">
              <h3 className="font-semibold">{strategy.name}</h3>
              <p className="text-sm text-muted-foreground">
                {strategy.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {results && results.length === 0 && debouncedQuery && (
        <div className="text-sm text-muted-foreground text-center py-8">
          No strategies found for &quot;{debouncedQuery}&quot;
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 6: Price Alert with Validation
// ============================================================================

export function PriceAlertForm({
  symbol,
  currentPrice,
}: {
  symbol: string;
  currentPrice: number;
}) {
  const [targetPrice, setTargetPrice] = useState("");
  const [error, setError] = useState<string | undefined>();

  const validatePrice = useCallback(
    (price: string) => {
      const numPrice = parseFloat(price);

      if (!price || isNaN(numPrice)) {
        setError(undefined);
        return;
      }

      if (numPrice <= 0) {
        setError("Price must be positive");
      } else if (Math.abs(numPrice - currentPrice) / currentPrice < 0.01) {
        setError(
          "Alert price must be at least 1% different from current price"
        );
      } else if (numPrice > currentPrice * 10) {
        setError("Alert price seems unrealistically high");
      } else {
        setError(undefined);
      }
    },
    [currentPrice]
  );

  const percentDiff = targetPrice
    ? (((parseFloat(targetPrice) - currentPrice) / currentPrice) * 100).toFixed(
        2
      )
    : null;

  return (
    <div className="space-y-2">
      <label htmlFor="targetPrice" className="text-sm font-medium">
        Alert Price for {symbol}
      </label>

      <Input
        id="targetPrice"
        type="number"
        value={targetPrice}
        onChange={(e) => setTargetPrice(e.target.value)}
        debounceMs={300}
        onDebouncedChange={validatePrice}
        placeholder={currentPrice.toFixed(2)}
        step="0.01"
        aria-describedby={error ? "price-error" : undefined}
        aria-invalid={!!error}
        className={error ? "border-destructive" : ""}
      />

      {percentDiff && !error && (
        <p className="text-sm text-muted-foreground">
          {parseFloat(percentDiff) > 0 ? "+" : ""}
          {percentDiff}% from current price
        </p>
      )}

      {error && <FieldError id="price-error" message={error} />}
    </div>
  );
}
