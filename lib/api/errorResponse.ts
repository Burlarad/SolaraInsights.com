/**
 * Standardized API error response utilities.
 * Ensures consistent error format with errorCode and requestId for debugging.
 */

import { NextResponse } from "next/server";

/**
 * Generate a short request ID for debugging.
 * Returns 8 character base36 string.
 */
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export interface ApiErrorOptions {
  error: string;
  message: string;
  errorCode: string;
  status: number;
  retryAfterSeconds?: number;
  route?: string;
  requestId?: string;
}

/**
 * Create a standardized JSON error response.
 * Includes errorCode and requestId for UI debugging.
 */
export function createApiErrorResponse(options: ApiErrorOptions): NextResponse {
  const {
    error,
    message,
    errorCode,
    status,
    retryAfterSeconds,
    route,
    requestId = generateRequestId(),
  } = options;

  const body: Record<string, unknown> = {
    error,
    message,
    errorCode,
    requestId,
  };

  if (retryAfterSeconds !== undefined) {
    body.retryAfterSeconds = retryAfterSeconds;
  }

  if (route) {
    body.route = route;
  }

  const headers: Record<string, string> = {};
  if (retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }

  return NextResponse.json(body, { status, headers });
}

/**
 * Error codes for insights endpoint.
 */
export const INSIGHTS_ERROR_CODES = {
  COOLDOWN: "INSIGHTS_COOLDOWN",
  RATE_LIMIT: "INSIGHTS_RATE_LIMIT",
  LOCK_BUSY: "INSIGHTS_LOCK_BUSY",
  BUDGET_EXCEEDED: "INSIGHTS_BUDGET_EXCEEDED",
  REDIS_UNAVAILABLE: "INSIGHTS_REDIS_UNAVAILABLE",
  PROVIDER_ERROR: "INSIGHTS_PROVIDER_ERROR",
  INVALID_PROFILE: "INSIGHTS_INVALID_PROFILE",
  INVALID_TIMEFRAME: "INSIGHTS_INVALID_TIMEFRAME",
  UNAUTHORIZED: "INSIGHTS_UNAUTHORIZED",
} as const;

/**
 * Error codes for birth chart endpoint.
 */
export const BIRTHCHART_ERROR_CODES = {
  COOLDOWN: "BIRTHCHART_COOLDOWN",
  RATE_LIMIT: "BIRTHCHART_RATE_LIMIT",
  LOCK_BUSY: "BIRTHCHART_LOCK_BUSY",
  BUDGET_EXCEEDED: "BIRTHCHART_BUDGET_EXCEEDED",
  REDIS_UNAVAILABLE: "BIRTHCHART_REDIS_UNAVAILABLE",
  PROVIDER_ERROR: "BIRTHCHART_PROVIDER_ERROR",
  INVALID_PROFILE: "BIRTHCHART_INVALID_PROFILE",
  UNAUTHORIZED: "BIRTHCHART_UNAUTHORIZED",
} as const;

/**
 * Error codes for connection brief endpoint.
 */
export const CONNECTION_BRIEF_ERROR_CODES = {
  COOLDOWN: "CONNECTION_BRIEF_COOLDOWN",
  RATE_LIMIT: "CONNECTION_BRIEF_RATE_LIMIT",
  LOCK_BUSY: "CONNECTION_BRIEF_LOCK_BUSY",
  BUDGET_EXCEEDED: "CONNECTION_BRIEF_BUDGET_EXCEEDED",
  REDIS_UNAVAILABLE: "CONNECTION_BRIEF_REDIS_UNAVAILABLE",
  PROVIDER_ERROR: "CONNECTION_BRIEF_PROVIDER_ERROR",
  INVALID_CONNECTION: "CONNECTION_BRIEF_INVALID_CONNECTION",
  UNAUTHORIZED: "CONNECTION_BRIEF_UNAUTHORIZED",
} as const;

/**
 * Error codes for connection insight endpoint.
 */
export const CONNECTION_INSIGHT_ERROR_CODES = {
  COOLDOWN: "CONNECTION_INSIGHT_COOLDOWN",
  RATE_LIMIT: "CONNECTION_INSIGHT_RATE_LIMIT",
  LOCK_BUSY: "CONNECTION_INSIGHT_LOCK_BUSY",
  BUDGET_EXCEEDED: "CONNECTION_INSIGHT_BUDGET_EXCEEDED",
  REDIS_UNAVAILABLE: "CONNECTION_INSIGHT_REDIS_UNAVAILABLE",
  PROVIDER_ERROR: "CONNECTION_INSIGHT_PROVIDER_ERROR",
  INVALID_CONNECTION: "CONNECTION_INSIGHT_INVALID_CONNECTION",
  UNAUTHORIZED: "CONNECTION_INSIGHT_UNAUTHORIZED",
} as const;

/**
 * Error codes for space between endpoint.
 */
export const SPACE_BETWEEN_ERROR_CODES = {
  COOLDOWN: "SPACE_BETWEEN_COOLDOWN",
  RATE_LIMIT: "SPACE_BETWEEN_RATE_LIMIT",
  LOCK_BUSY: "SPACE_BETWEEN_LOCK_BUSY",
  BUDGET_EXCEEDED: "SPACE_BETWEEN_BUDGET_EXCEEDED",
  REDIS_UNAVAILABLE: "SPACE_BETWEEN_REDIS_UNAVAILABLE",
  PROVIDER_ERROR: "SPACE_BETWEEN_PROVIDER_ERROR",
  INVALID_CONNECTION: "SPACE_BETWEEN_INVALID_CONNECTION",
  UNAUTHORIZED: "SPACE_BETWEEN_UNAUTHORIZED",
} as const;
