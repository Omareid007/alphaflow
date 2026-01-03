/**
 * SendGrid Email Provider
 *
 * Premium provider - used when SENDGRID_API_KEY is configured.
 * Priority: 1 (highest)
 */

import sgMail from "@sendgrid/mail";
import { log } from "../../utils/logger";
import type { EmailProvider, EmailOptions, EmailResult } from "./types";

const apiKey = process.env.SENDGRID_API_KEY;

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

export const sendgridProvider: EmailProvider = {
  name: "sendgrid",
  priority: 1,

  isConfigured: () => !!process.env.SENDGRID_API_KEY,

  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "SendGrid API key not configured",
        provider: "sendgrid",
      };
    }

    try {
      const [response] = await sgMail.send({
        to: options.to,
        from: options.from,
        subject: options.subject,
        text: options.text,
        html: options.html || `<p>${options.text}</p>`,
        replyTo: options.replyTo,
      });

      log.info("Email", "Email sent via SendGrid", {
        to: Array.isArray(options.to) ? options.to.length : 1,
        subject: options.subject.substring(0, 50),
        statusCode: response.statusCode,
      });

      return {
        success: true,
        messageId: response.headers["x-message-id"] as string,
        provider: "sendgrid",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      log.error("Email", "SendGrid send failed", { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        provider: "sendgrid",
      };
    }
  },
};
