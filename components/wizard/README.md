# Strategy Wizard Components

Comprehensive wizard components for creating and configuring trading strategies with loading states, animations, and validation.

## Features

- **Smooth Animations**: Step transitions, progress indicators, and loading states with framer-motion
- **Reduced Motion Support**: Respects `prefers-reduced-motion` accessibility setting
- **Debounced Validation**: Real-time field validation with debouncing
- **Loading States**: Visual feedback for async operations
- **Type-Safe**: Full TypeScript support with strict typing
- **Composable**: Modular components that can be used independently

## Components

### Core Components

#### `StrategyWizard`
Main wizard component that orchestrates the strategy creation flow.

```tsx
import { StrategyWizard } from "@/components/wizard";

<StrategyWizard
  existingStrategy={strategy}
  existingBacktest={backtest}
/>
```

#### `WizardProvider`
Context provider for wizard-wide state management.

```tsx
import { WizardProvider, useWizardContext } from "@/components/wizard";

function MyWizard() {
  return (
    <WizardProvider>
      <MyWizardContent />
    </WizardProvider>
  );
}

function MyWizardContent() {
  const { status, startLoading, finishSuccess, finishError } = useWizardContext();
  // Use wizard state...
}
```

### Animation Components

#### `WizardStep`
Animated wrapper for individual wizard steps.

```tsx
import { WizardStep } from "@/components/wizard";

<AnimatePresence mode="wait">
  <WizardStep key={currentStep} stepKey={currentStep} direction="forward">
    {/* Step content */}
  </WizardStep>
</AnimatePresence>
```

**Props:**
- `stepKey` (string | number): Unique identifier for AnimatePresence
- `direction` ("forward" | "backward"): Animation direction
- `className` (string): Additional CSS classes

#### `WizardProgress`
Animated progress indicator showing wizard completion.

```tsx
import { WizardProgress } from "@/components/wizard";

<WizardProgress
  currentStep={2}
  totalSteps={5}
  showLabels={true}
  labels={["Preset", "Settings", "Backtest", "Review", "Deploy"]}
/>
```

**Props:**
- `currentStep` (number): Current step (0-indexed)
- `totalSteps` (number): Total number of steps
- `showLabels` (boolean): Show step labels below indicators
- `labels` (string[]): Custom labels for each step
- `className` (string): Additional CSS classes

### Form Components

#### `WizardField`
Enhanced form field with validation, debouncing, and loading states.

```tsx
import { WizardField } from "@/components/wizard";

<WizardField
  field={fieldConfig}
  value={value}
  onChange={setValue}
  onValidate={async (val) => {
    // Async validation
    return val > 0 && val < 100;
  }}
  validationDelay={500}
/>
```

**Props:**
- `field` (Field): Field configuration object
- `value` (string | number | boolean | string[]): Current value
- `onChange` (function): Change handler
- `onValidate` (function): Optional async validation function
- `validationDelay` (number): Debounce delay in ms (default: 300)

**Field Types:**
- `text`: Text input with validation indicator
- `number`: Number input with min/max constraints
- `select`: Dropdown selection
- `range`: Slider with visual feedback
- `toggle`: Boolean switch
- `multi-select`: Multiple selection with badges

#### `WizardNavigation`
Navigation buttons with loading states and animations.

```tsx
import { WizardNavigation } from "@/components/wizard";

<WizardNavigation
  currentStep={currentStep}
  totalSteps={totalSteps}
  hasBacktest={false}
  onBack={handleBack}
  onNext={handleNext}
  isLoading={isProcessing}
  disableNext={!isValid}
  nextLabel="Continue"
/>
```

**Props:**
- `currentStep` (number): Current step
- `totalSteps` (number): Total steps
- `hasBacktest` (boolean): Hide next if backtest exists
- `onBack` (function): Back button handler
- `onNext` (function): Next button handler
- `isLoading` (boolean): Show loading state
- `disableNext` (boolean): Disable next button
- `nextLabel` (string): Custom next button text

### Utility Components

#### `LoadingDots`
Animated loading indicator.

```tsx
import { LoadingDots } from "@/components/wizard";

<LoadingDots size="md" variant="primary" />
```

**Props:**
- `size` ("sm" | "md" | "lg"): Dot size
- `variant` ("primary" | "muted" | "white"): Color variant
- `className` (string): Additional CSS classes

#### `BacktestProgress`
Enhanced progress display for backtesting.

```tsx
import { BacktestProgress } from "@/components/wizard";

<BacktestProgress progress={75} />
```

Shows:
- Animated spinner
- Progress bar
- Dynamic status messages
- Loading dots animation

## Animation Details

### Reduced Motion Support

All animations respect the user's `prefers-reduced-motion` setting:

```tsx
const prefersReducedMotion = useReducedMotion();

const variants = prefersReducedMotion
  ? { /* Simple opacity transitions */ }
  : { /* Full animations with transforms */ };
```

### Animation Variants

**Step Transitions:**
- Forward: Slide in from right, fade in
- Backward: Slide in from left, fade in
- Exit: Fade out with slight movement

**Button Interactions:**
- Hover: Scale up (1.02x)
- Tap: Scale down (0.95x)

**Loading States:**
- Spinner: Continuous rotation
- Dots: Wave pattern or opacity pulse
- Progress: Smooth width transitions

## Validation Pattern

The wizard uses debounced validation for real-time feedback:

```tsx
const handleValidation = useDebouncedCallback(
  async (value) => {
    setValidationState("validating");
    try {
      const isValid = await validateFunction(value);
      setValidationState(isValid ? "valid" : "invalid");
    } catch {
      setValidationState("invalid");
    }
  },
  300 // debounce delay
);
```

**Validation States:**
- `idle`: No validation yet
- `validating`: Validation in progress (shows spinner)
- `valid`: Validation passed (shows checkmark)
- `invalid`: Validation failed (shows error icon)

## Accessibility

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **ARIA Labels**: Proper labeling for screen readers
- **Reduced Motion**: Animations disabled when `prefers-reduced-motion: reduce`
- **Focus Management**: Clear focus indicators
- **Error Messaging**: Clear validation feedback with icons and text

## Performance

- **Debouncing**: Reduces unnecessary validation calls
- **Lazy Loading**: Components only render when needed
- **Memoization**: Callbacks memoized with `useCallback`
- **Optimized Animations**: CSS transforms (GPU-accelerated)

## Example Usage

### Basic Wizard Flow

```tsx
"use client";

import { useState } from "react";
import {
  WizardProvider,
  WizardStep,
  WizardProgress,
  WizardNavigation,
} from "@/components/wizard";
import { AnimatePresence } from "framer-motion";

export function MyWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 3;

  return (
    <WizardProvider>
      <div className="space-y-6">
        <WizardProgress
          currentStep={currentStep}
          totalSteps={totalSteps}
          showLabels={true}
          labels={["Setup", "Configure", "Review"]}
        />

        <AnimatePresence mode="wait">
          <WizardStep
            key={currentStep}
            stepKey={currentStep}
            direction="forward"
          >
            {/* Step content */}
          </WizardStep>
        </AnimatePresence>

        <WizardNavigation
          currentStep={currentStep}
          totalSteps={totalSteps}
          hasBacktest={false}
          onBack={() => setCurrentStep(s => s - 1)}
          onNext={() => setCurrentStep(s => s + 1)}
        />
      </div>
    </WizardProvider>
  );
}
```

### Custom Field Validation

```tsx
import { WizardField } from "@/components/wizard";

function MyForm() {
  const [value, setValue] = useState("");

  const validateEmail = async (email: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <WizardField
      field={{
        key: "email",
        label: "Email Address",
        type: "text",
        helpText: "Enter a valid email address",
        default: "",
      }}
      value={value}
      onChange={setValue}
      onValidate={validateEmail}
      validationDelay={300}
    />
  );
}
```

## Dependencies

- `framer-motion`: ^12.23.26
- `react`: ^18.x
- `@/lib/utils/useDebounce`: Debounce hooks
- `@/lib/animations/hooks/useReducedMotion`: Reduced motion detection

## File Structure

```
components/wizard/
├── index.ts                   # Main exports
├── README.md                  # This file
├── strategy-wizard.tsx        # Main wizard component
├── wizard-context.tsx         # State management
├── wizard-step.tsx            # Step wrapper with animations
├── wizard-progress.tsx        # Progress indicator
├── wizard-field.tsx           # Form field with validation
├── WizardNavigation.tsx       # Navigation buttons
├── loading-dots.tsx           # Loading animation
├── BacktestProgress.tsx       # Backtest progress display
└── [other components...]      # Additional wizard components
```

## Best Practices

1. **Always wrap wizard in WizardProvider** for state management
2. **Use AnimatePresence** for smooth step transitions
3. **Debounce validation** to reduce API calls
4. **Respect reduced motion** preferences
5. **Provide clear feedback** with loading states
6. **Use semantic HTML** for accessibility
7. **Keep animations subtle** and purposeful

## TypeScript Types

```typescript
// Wizard status
type WizardStatus = "idle" | "loading" | "success" | "error";

// Field types
type FieldType = "text" | "number" | "select" | "range" | "toggle" | "multi-select";

// Validation state
type ValidationState = "idle" | "validating" | "valid" | "invalid";

// Step direction
type StepDirection = "forward" | "backward";
```
