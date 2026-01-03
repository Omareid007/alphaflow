"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

export interface FormErrorProps {
  message?: string;
  messages?: string[];
  className?: string;
  variant?: "error" | "warning" | "info";
  id?: string;
  showIcon?: boolean;
}

const icons = {
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const variants = {
  error: "text-destructive bg-destructive/10 border-destructive/20",
  warning: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800",
  info: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800",
};

/**
 * Accessible form error display component
 * Announces errors to screen readers via aria-live
 */
export function FormError({
  message,
  messages = [],
  className,
  variant = "error",
  id,
  showIcon = true,
}: FormErrorProps) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = icons[variant];

  const allMessages = message ? [message, ...messages] : messages;

  if (allMessages.length === 0) {
    return null;
  }

  const animationProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: -10, height: 0 },
        animate: { opacity: 1, y: 0, height: "auto" },
        exit: { opacity: 0, y: -10, height: 0 },
        transition: { duration: 0.2 },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={allMessages.join(",")}
        id={id}
        role="alert"
        aria-live="polite"
        className={cn(
          "flex items-start gap-2 rounded-md border p-3 text-sm",
          variants[variant],
          className
        )}
        {...animationProps}
      >
        {showIcon && (
          <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
        )}
        <div className="flex-1">
          {allMessages.length === 1 ? (
            <p>{allMessages[0]}</p>
          ) : (
            <ul className="list-disc list-inside space-y-1">
              {allMessages.map((msg, index) => (
                <li key={index}>{msg}</li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Inline form field error (smaller, no background)
 */
export function FieldError({
  message,
  className,
  id,
}: {
  message?: string;
  className?: string;
  id?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (!message) {
    return null;
  }

  const animationProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: -10 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -10 },
        transition: { duration: 0.15 },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={message}
        id={id}
        role="alert"
        aria-live="polite"
        className={cn(
          "text-sm text-destructive mt-1.5 flex items-center gap-1",
          className
        )}
        {...animationProps}
      >
        <XCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        {message}
      </motion.p>
    </AnimatePresence>
  );
}

/**
 * Form success message
 */
export function FormSuccess({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (!message) {
    return null;
  }

  const animationProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: -10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.2 },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={message}
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-2 rounded-md border p-3 text-sm",
          "text-green-600 bg-green-50 border-green-200",
          "dark:text-green-400 dark:bg-green-900/20 dark:border-green-800",
          className
        )}
        {...animationProps}
      >
        <svg
          className="h-4 w-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <p>{message}</p>
      </motion.div>
    </AnimatePresence>
  );
}
