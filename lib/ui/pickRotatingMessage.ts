/**
 * Pick a rotating error message based on attempt count.
 * Rotates through messages deterministically (no randomness).
 */

import { ERROR_MESSAGES, ErrorMessageCategory } from "./errorMessages";
import { formatErrorMessage } from "./errorMessageUtils";

export interface PickRotatingMessageOptions {
  category: ErrorMessageCategory;
  attempt: number;
  retryAfterSeconds?: number;
}

/**
 * Pick a rotating message for an error category.
 * The message rotates based on attempt number (modulo message count).
 *
 * @param opts - Options with category, attempt, and optional retryAfterSeconds
 * @returns Formatted error message string
 */
export function pickRotatingMessage(opts: PickRotatingMessageOptions): string {
  const { category, attempt, retryAfterSeconds } = opts;

  const messages = ERROR_MESSAGES[category];
  if (!messages || messages.length === 0) {
    return "Something went wrong. Please try again.";
  }

  // Use attempt modulo to rotate through messages
  const index = Math.abs(attempt) % messages.length;
  const template = messages[index];

  return formatErrorMessage(template, { retryAfterSeconds });
}

/**
 * Standardized error response from API.
 */
export interface ApiErrorResponse {
  error: string;
  message?: string;
  errorCode?: string;
  retryAfterSeconds?: number;
  route?: string;
  requestId?: string;
}

/**
 * Determine error category from HTTP status and error code.
 *
 * Category mapping rules:
 * - 429 + errorCode contains COOLDOWN → cooldown_429
 * - 429 otherwise → rate_limited_429
 * - 503 + errorCode contains LOCK or BUSY → still_generating_503
 * - 503 + errorCode contains BUDGET → budget_503
 * - 503 otherwise → service_503
 * - 400 → validation_400
 * - 500 → provider_500
 *
 * @param status - HTTP status code
 * @param errorCode - Optional error code string
 * @returns Error message category
 */
export function getErrorCategory(
  status: number,
  errorCode?: string
): ErrorMessageCategory {
  const code = (errorCode || "").toUpperCase();

  if (status === 429) {
    if (code.includes("COOLDOWN")) {
      return "cooldown_429";
    }
    return "rate_limited_429";
  }

  if (status === 503) {
    if (code.includes("LOCK") || code.includes("BUSY")) {
      return "still_generating_503";
    }
    if (code.includes("BUDGET")) {
      return "budget_503";
    }
    return "service_503";
  }

  if (status === 400) {
    return "validation_400";
  }

  if (status === 500) {
    return "provider_500";
  }

  // Default fallback
  return "provider_500";
}

/**
 * Safely parse a fetch response as JSON.
 * Returns parsed data or error info if response is not JSON.
 *
 * @param response - Fetch Response object
 * @returns Object with success flag and data or error info
 */
export async function safeParseResponse<T>(
  response: Response
): Promise<
  | { success: true; data: T }
  | { success: false; status: number; category: ErrorMessageCategory; raw?: string }
> {
  const contentType = response.headers.get("content-type") || "";

  // If response is OK and JSON, parse it
  if (response.ok) {
    if (contentType.includes("application/json")) {
      try {
        const data = await response.json();
        return { success: true, data };
      } catch {
        return {
          success: false,
          status: response.status,
          category: "non_json_response",
        };
      }
    }
    // Non-JSON success response (unusual)
    return {
      success: false,
      status: response.status,
      category: "non_json_response",
    };
  }

  // Error response - try to parse as JSON for error details
  if (contentType.includes("application/json")) {
    try {
      const errorData = await response.json();
      const category = getErrorCategory(response.status, errorData.errorCode);
      return {
        success: false,
        status: response.status,
        category,
        ...errorData,
      };
    } catch {
      return {
        success: false,
        status: response.status,
        category: "non_json_response",
      };
    }
  }

  // Non-JSON error response (HTML error page, etc.)
  let raw: string | undefined;
  try {
    raw = await response.text();
  } catch {
    // Ignore
  }

  return {
    success: false,
    status: response.status,
    category: "non_json_response",
    raw,
  };
}
