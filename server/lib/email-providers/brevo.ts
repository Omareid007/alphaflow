/**
 * Brevo (formerly Sendinblue) Email Provider
 *
 * Free tier: 300 emails/day, no credit card required.
 * Priority: 2
 *
 * Uses REST API directly to avoid SDK TypeScript issues.
 * @see https://developers.brevo.com/reference/sendtransacemail
 */

import { log } from "../../utils/logger";
import type { EmailProvider, EmailOptions, EmailResult } from "./types";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface BrevoEmailRequest {
  sender: { email: string; name?: string };
  to: Array<{ email: string; name?: string }>;
  subject: string;
  textContent?: string;
  htmlContent?: string;
  replyTo?: { email: string };
}

interface BrevoSuccessResponse {
  messageId: string;
}

interface BrevoErrorResponse {
  code?: string;
  message?: string;
}

export const brevoProvider: EmailProvider = {
  name: "brevo",
  priority: 2,

  isConfigured: () => !!process.env.BREVO_API_KEY,

  async send(options: EmailOptions): Promise<EmailResult> {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "Brevo API not configured",
        provider: "brevo",
      };
    }

    try {
      // Handle to field (string or array)
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

      // Parse sender - extract name if present in format "Name <email>"
      let sender: { email: string; name?: string };
      const fromMatch = options.from.match(/^(.+?)\s*<(.+)>$/);
      if (fromMatch) {
        sender = { name: fromMatch[1].trim(), email: fromMatch[2].trim() };
      } else {
        sender = { email: options.from };
      }

      const requestBody: BrevoEmailRequest = {
        sender,
        to: toAddresses.map((email) => ({ email })),
        subject: options.subject,
        textContent: options.text,
        htmlContent: options.html || `<p>${options.text}</p>`,
      };

      if (options.replyTo) {
        requestBody.replyTo = { email: options.replyTo };
      }

      const response = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as BrevoErrorResponse;
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as BrevoSuccessResponse;

      log.info("Email", "Email sent via Brevo", {
        to: toAddresses.length,
        subject: options.subject.substring(0, 50),
        messageId: data.messageId,
      });

      return {
        success: true,
        messageId: data.messageId,
        provider: "brevo",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      log.error("Email", "Brevo send failed", { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        provider: "brevo",
      };
    }
  },
};
