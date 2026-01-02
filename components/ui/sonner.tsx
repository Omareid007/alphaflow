"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return null;
  }

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right" // Modern placement (top-right for desktop, top-center for mobile)
      expand={true} // Show all toasts when hovering
      richColors={true} // Use semantic colors
      closeButton={true} // Add close button
      duration={4000} // 4 seconds default
      visibleToasts={3} // Max 3 toasts visible at once
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:backdrop-blur-sm",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:hover:bg-primary/90",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:hover:bg-muted/80",
          success:
            "group-[.toaster]:bg-green-50 dark:group-[.toaster]:bg-green-950/20 group-[.toaster]:border-green-200 dark:group-[.toaster]:border-green-800",
          error:
            "group-[.toaster]:bg-red-50 dark:group-[.toaster]:bg-red-950/20 group-[.toaster]:border-red-200 dark:group-[.toaster]:border-red-800",
          warning:
            "group-[.toaster]:bg-amber-50 dark:group-[.toaster]:bg-amber-950/20 group-[.toaster]:border-amber-200 dark:group-[.toaster]:border-amber-800",
          info:
            "group-[.toaster]:bg-blue-50 dark:group-[.toaster]:bg-blue-950/20 group-[.toaster]:border-blue-200 dark:group-[.toaster]:border-blue-800",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
