/**
 * Social Consent helpers for OAuth flows.
 *
 * Centralizes storage of OAuth context (destination, consent, post-action)
 * across sessionStorage and cookie fallbacks.
 */

// Storage keys
const OAUTH_NEXT_KEY = "oauth_next";
const OAUTH_PROVIDER_KEY = "oauth_provider";
const OAUTH_POST_ACTION_KEY = "oauth_post_action";
const CHECKOUT_SESSION_COOKIE = "solara_checkout_session";

/**
 * Get consent storage key for a provider
 */
function getConsentKey(provider: string): string {
  return `oauth_consent_${provider}`;
}

/**
 * Set a cookie with standard options for OAuth context
 */
function setOAuthCookie(name: string, value: string): void {
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  const secureFlag = isSecure ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=900; Path=/; SameSite=Lax${secureFlag}`;
}

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Delete a cookie by name
 */
function deleteCookie(name: string): void {
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

/**
 * Persist OAuth context before redirecting to provider.
 *
 * @param nextPath - Where to redirect after OAuth completes (usually /onboarding)
 * @param provider - The OAuth provider (facebook, tiktok, etc.)
 * @param consentChecked - Whether user consented to auto-connect Social Insights
 * @param checkoutSessionId - Optional Stripe checkout session ID to preserve
 */
export function persistOauthContext({
  nextPath,
  provider,
  consentChecked,
  checkoutSessionId,
}: {
  nextPath: string;
  provider: string;
  consentChecked: boolean;
  checkoutSessionId?: string;
}): void {
  // Store in sessionStorage
  sessionStorage.setItem(OAUTH_NEXT_KEY, nextPath);
  sessionStorage.setItem(OAUTH_PROVIDER_KEY, provider);
  sessionStorage.setItem(getConsentKey(provider), consentChecked ? "true" : "false");

  // Set post-action only if consent is true
  if (consentChecked) {
    sessionStorage.setItem(OAUTH_POST_ACTION_KEY, `auto_connect:${provider}`);
  } else {
    sessionStorage.removeItem(OAUTH_POST_ACTION_KEY);
  }

  // Set cookie fallbacks
  setOAuthCookie(OAUTH_NEXT_KEY, nextPath);
  setOAuthCookie(OAUTH_PROVIDER_KEY, provider);
  setOAuthCookie(getConsentKey(provider), consentChecked ? "true" : "false");

  if (consentChecked) {
    setOAuthCookie(OAUTH_POST_ACTION_KEY, `auto_connect:${provider}`);
  } else {
    deleteCookie(OAUTH_POST_ACTION_KEY);
  }

  // Preserve checkout session if provided
  if (checkoutSessionId && checkoutSessionId.startsWith("cs_")) {
    setOAuthCookie(CHECKOUT_SESSION_COOKIE, checkoutSessionId);
  }
}

/**
 * Get consent status for a provider.
 * Checks sessionStorage first, then cookie fallback.
 */
export function getOauthConsent(provider: string): boolean {
  const key = getConsentKey(provider);

  // Try sessionStorage first
  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue !== null) {
    return sessionValue === "true";
  }

  // Fallback to cookie
  const cookieValue = getCookie(key);
  return cookieValue === "true";
}

/**
 * Get OAuth context from storage (sessionStorage first, then cookies).
 * Returns null values if not found.
 */
export function getOauthContext(): {
  next: string | null;
  provider: string | null;
  postAction: string | null;
} {
  return {
    next: sessionStorage.getItem(OAUTH_NEXT_KEY) || getCookie(OAUTH_NEXT_KEY),
    provider: sessionStorage.getItem(OAUTH_PROVIDER_KEY) || getCookie(OAUTH_PROVIDER_KEY),
    postAction: sessionStorage.getItem(OAUTH_POST_ACTION_KEY) || getCookie(OAUTH_POST_ACTION_KEY),
  };
}

/**
 * Clear all OAuth context from storage.
 * Call after OAuth flow completes.
 */
export function clearOauthContext(provider?: string): void {
  // Clear sessionStorage
  sessionStorage.removeItem(OAUTH_NEXT_KEY);
  sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
  sessionStorage.removeItem(OAUTH_POST_ACTION_KEY);

  if (provider) {
    sessionStorage.removeItem(getConsentKey(provider));
    deleteCookie(getConsentKey(provider));
  }

  // Clear cookies
  deleteCookie(OAUTH_NEXT_KEY);
  deleteCookie(OAUTH_PROVIDER_KEY);
  deleteCookie(OAUTH_POST_ACTION_KEY);
}

/**
 * Check if checkout session cookie exists.
 */
export function hasCheckoutSessionCookie(): boolean {
  return !!getCookie(CHECKOUT_SESSION_COOKIE);
}

/**
 * Get checkout session ID from cookie.
 */
export function getCheckoutSessionId(): string | null {
  return getCookie(CHECKOUT_SESSION_COOKIE);
}

/**
 * Clear checkout session cookie.
 */
export function clearCheckoutSessionCookie(): void {
  deleteCookie(CHECKOUT_SESSION_COOKIE);
}

/**
 * Set checkout session cookie directly (for email/password flow).
 * Used when persistOauthContext() isn't appropriate (no OAuth provider).
 */
export function setCheckoutSessionCookie(sessionId: string): void {
  if (sessionId && sessionId.startsWith("cs_")) {
    setOAuthCookie(CHECKOUT_SESSION_COOKIE, sessionId);
  }
}
