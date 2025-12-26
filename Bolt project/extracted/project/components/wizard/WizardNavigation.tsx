"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  hasBacktest: boolean;
  onBack: () => void;
  onNext: () => void;
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  hasBacktest,
  onBack,
  onNext
}: WizardNavigationProps) {
  return (
    <div className="flex items-center justify-between">
      <Button
        variant="outline"
        onClick={onBack}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      {!hasBacktest && currentStep <= totalSteps && (
        <Button onClick={onNext}>
          {currentStep === totalSteps ? "Review & Backtest" : "Continue"}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
