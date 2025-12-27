/**
 * OAuth sessionStorage helpers for Supabase OAuth flows.
 *
 * Supabase strips query params from redirectTo URLs, so we use
 * sessionStorage to preserve the intended destination and post-login
 * actions across the OAuth redirect.
 *
 * Keys:
 * - oauth_next: The path to redirect to after OAuth completes
 * - oauth_post_action: Action to perform after OAuth (e.g., "auto_connect:facebook")
 * - oauth_connect_attempts: Counter to prevent infinite redirect loops
 */

const OAUTH_NEXT_KEY = "oauth_next";
const OAUTH_POST_ACTION_KEY = "oauth_post_action";
const OAUTH_ATTEMPTS_KEY = "oauth_connect_attempts";

/**
 * Store the destination path for after OAuth completes.
 */
export function setOauthNext(path: string): void {
  sessionStorage.setItem(OAUTH_NEXT_KEY, path);
}

/**
 * Get and clear the stored OAuth destination.
 */
export function getAndClearOauthNext(): string | null {
  const value = sessionStorage.getItem(OAUTH_NEXT_KEY);
  sessionStorage.removeItem(OAUTH_NEXT_KEY);
  return value;
}

/**
 * Store a post-OAuth action (e.g., "auto_connect:facebook").
 */
export function setOauthPostAction(action: string): void {
  sessionStorage.setItem(OAUTH_POST_ACTION_KEY, action);
}

/**
 * Get and clear the stored post-OAuth action.
 */
export function getAndClearOauthPostAction(): string | null {
  const value = sessionStorage.getItem(OAUTH_POST_ACTION_KEY);
  sessionStorage.removeItem(OAUTH_POST_ACTION_KEY);
  return value;
}

/**
 * Clear the OAuth connect attempts counter.
 * Call this before starting a new OAuth flow.
 */
export function clearOauthAttempts(): void {
  sessionStorage.removeItem(OAUTH_ATTEMPTS_KEY);
}

/**
 * Get the current OAuth connect attempts count.
 */
export function getOauthAttempts(): number {
  return parseInt(sessionStorage.getItem(OAUTH_ATTEMPTS_KEY) || "0", 10);
}

/**
 * Increment and return the OAuth connect attempts count.
 */
export function incrementOauthAttempts(): number {
  const current = getOauthAttempts();
  const next = current + 1;
  sessionStorage.setItem(OAUTH_ATTEMPTS_KEY, String(next));
  return next;
}

/**
 * Set up OAuth session state before redirecting to provider.
 * This is a convenience function that sets all three values.
 *
 * @param nextPath - Where to redirect after OAuth
 * @param postAction - Optional action like "auto_connect:facebook"
 */
export function setupOauthSession(nextPath: string, postAction?: string): void {
  setOauthNext(nextPath);
  if (postAction) {
    setOauthPostAction(postAction);
  }
  clearOauthAttempts();
}
