import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn("RESEND_API_KEY is not set; email sending will be disabled.");
}

/**
 * Resend client for sending transactional emails
 */
export const resend = new Resend(process.env.RESEND_API_KEY || "");

/**
 * Resend configuration from environment variables
 *
 * IMPORTANT: The from email MUST match a verified domain in Resend.
 * For production: Solara@solarainsights.com
 */
export const RESEND_CONFIG = {
  fromEmail: process.env.RESEND_FROM || "Solara Insights <Solara@solarainsights.com>",
  fromName: process.env.RESEND_FROM_NAME || "Solara Insights",
} as const;

/**
 * Check if Resend is properly configured
 */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
