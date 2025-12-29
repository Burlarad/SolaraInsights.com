import { cookies } from "next/headers";

/**
 * Reauth verification for server-side API routes
 *
 * Used by sensitive operations (delete, hibernate, reactivate) to verify
 * OAuth-only users have completed a recent reauth flow.
 */

export interface ReauthData {
  intent: "delete" | "hibernate" | "reactivate";
  userId: string;
  provider: string;
  completedAt: number;
}

// Reauth cookie validity: 5 minutes
const REAUTH_OK_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Verify the reauth_ok cookie is valid for a given intent and user
 *
 * @param userId - The user ID to verify against
 * @param intent - The required intent (delete, hibernate, reactivate)
 * @returns true if reauth is valid, false otherwise
 */
export async function verifyReauth(
  userId: string,
  intent: "delete" | "hibernate" | "reactivate"
): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const reauthCookie = cookieStore.get("reauth_ok");

    if (!reauthCookie) {
      return false;
    }

    const data: ReauthData = JSON.parse(reauthCookie.value);

    // Verify user matches
    if (data.userId !== userId) {
      console.warn(`[Reauth] User mismatch: expected ${userId}, got ${data.userId}`);
      return false;
    }

    // Verify intent matches
    if (data.intent !== intent) {
      console.warn(`[Reauth] Intent mismatch: expected ${intent}, got ${data.intent}`);
      return false;
    }

    // Verify not expired (5 minutes)
    const age = Date.now() - data.completedAt;
    if (age > REAUTH_OK_MAX_AGE_MS) {
      console.warn(`[Reauth] Cookie expired: age ${age}ms exceeds ${REAUTH_OK_MAX_AGE_MS}ms`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Reauth] Failed to verify:", error);
    return false;
  }
}

/**
 * Set the reauth_ok cookie after successful OAuth reauth
 * Cookie is valid for 5 minutes
 */
export async function setReauth(
  userId: string,
  intent: "delete" | "hibernate" | "reactivate",
  provider: string = "unknown"
): Promise<void> {
  const cookieStore = await cookies();
  const data: ReauthData = {
    intent,
    userId,
    provider,
    completedAt: Date.now(),
  };

  cookieStore.set("reauth_ok", JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 5 * 60, // 5 minutes in seconds
    path: "/",
  });

  console.log(`[Reauth] Set reauth_ok for user ${userId}, intent: ${intent}`);
}

/**
 * Clear the reauth_ok cookie after use
 * Call this after a successful sensitive operation
 */
export async function clearReauth(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("reauth_ok");
}
