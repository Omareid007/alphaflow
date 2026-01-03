/**
 * Email Provider Registry
 *
 * Manages provider selection with automatic fallback.
 * Priority order: SendGrid (1) > Brevo (2)
 */

import { log } from "../../utils/logger";
import type {
  EmailProvider,
  EmailOptions,
  EmailResult,
  EmailServiceStatus,
} from "./types";
import { sendgridProvider } from "./sendgrid";
import { brevoProvider } from "./brevo";

// Re-export types
export type { EmailProvider, EmailOptions, EmailResult, EmailServiceStatus };

// All available providers sorted by priority
const providers: EmailProvider[] = [sendgridProvider, brevoProvider].sort(
  (a, b) => a.priority - b.priority
);

/**
 * Get the first configured provider
 */
export function getActiveProvider(): EmailProvider | null {
  for (const provider of providers) {
    if (provider.isConfigured()) {
      return provider;
    }
  }
  return null;
}

/**
 * Get all configured providers
 */
export function getConfiguredProviders(): EmailProvider[] {
  return providers.filter((p) => p.isConfigured());
}

/**
 * Check if any email provider is configured
 */
export function isEmailConfigured(): boolean {
  return providers.some((p) => p.isConfigured());
}

/**
 * Send email with automatic provider fallback
 */
export async function sendEmailWithFallback(
  options: EmailOptions
): Promise<EmailResult> {
  const configuredProviders = getConfiguredProviders();

  if (configuredProviders.length === 0) {
    log.warn("Email", "No email provider configured");
    return {
      success: false,
      error: "No email provider configured",
    };
  }

  // Try each provider in priority order
  for (const provider of configuredProviders) {
    log.debug("Email", `Attempting to send via ${provider.name}`);

    const result = await provider.send(options);

    if (result.success) {
      return result;
    }

    log.warn("Email", `${provider.name} failed, trying next provider`, {
      error: result.error,
    });
  }

  // All providers failed
  return {
    success: false,
    error: `All email providers failed (tried: ${configuredProviders.map((p) => p.name).join(", ")})`,
  };
}

/**
 * Get email service status for admin/diagnostics
 */
export function getEmailServiceStatus(): EmailServiceStatus {
  const activeProvider = getActiveProvider();
  return {
    configured: isEmailConfigured(),
    activeProvider: activeProvider?.name || null,
    availableProviders: providers.map((p) => ({
      name: p.name,
      priority: p.priority,
      configured: p.isConfigured(),
    })),
  };
}

// Log which provider is active at startup
const activeProvider = getActiveProvider();
if (activeProvider) {
  log.info("Email", `Email service initialized with ${activeProvider.name}`);
} else {
  log.warn(
    "Email",
    "No email provider configured - email notifications disabled"
  );
}
