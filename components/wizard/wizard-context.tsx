"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  ReactNode,
} from "react";

export type WizardStatus = "idle" | "loading" | "success" | "error";

interface WizardContextValue {
  status: WizardStatus;
  error: string | null;
  setStatus: (status: WizardStatus) => void;
  setError: (error: string | null) => void;
  startLoading: () => void;
  finishSuccess: () => void;
  finishError: (error: string) => void;
  reset: () => void;
}

const WizardContext = createContext<WizardContextValue | undefined>(undefined);

interface WizardProviderProps {
  children: ReactNode;
}

/**
 * Wizard context provider for managing wizard-wide state
 * Provides loading states, success/error feedback, and status management
 */
export function WizardProvider({ children }: WizardProviderProps) {
  const [status, setStatus] = useState<WizardStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const startLoading = useCallback(() => {
    setStatus("loading");
    setError(null);
  }, []);

  const finishSuccess = useCallback(() => {
    setStatus("success");
    setError(null);
  }, []);

  const finishError = useCallback((errorMessage: string) => {
    setStatus("error");
    setError(errorMessage);
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return (
    <WizardContext.Provider
      value={{
        status,
        error,
        setStatus,
        setError,
        startLoading,
        finishSuccess,
        finishError,
        reset,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

/**
 * Hook to access wizard context
 * @throws Error if used outside WizardProvider
 */
export function useWizardContext() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizardContext must be used within WizardProvider");
  }
  return context;
}
