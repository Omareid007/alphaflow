/**
 * Email Provider Abstraction Types
 *
 * Enables multiple email providers with automatic fallback.
 * Priority order: SendGrid (1) > Brevo (2)
 */

export interface EmailOptions {
  to: string | string[];
  from: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

export interface EmailProvider {
  /** Provider name for logging */
  name: string;

  /** Priority (lower = higher priority, used first) */
  priority: number;

  /** Check if this provider is configured with valid credentials */
  isConfigured: () => boolean;

  /** Send an email via this provider */
  send: (options: EmailOptions) => Promise<EmailResult>;
}

export interface EmailServiceStatus {
  configured: boolean;
  activeProvider: string | null;
  availableProviders: Array<{
    name: string;
    priority: number;
    configured: boolean;
  }>;
}
