import { WelcomeContent } from "./WelcomeContent";

/**
 * /welcome - Account Registration Page (Server Component Wrapper)
 *
 * Purpose: First-time user registration after Stripe checkout
 *
 * This is a Server Component that reads searchParams (Safari-safe)
 * and passes them to the client component.
 *
 * Flow:
 * - OAuth: Click provider → OAuth → auto-enable social insights → /onboarding
 * - Email: Enter email → verify → /set-password → /onboarding
 *
 * Edge cases:
 * - Already logged in → redirect to /sanctuary (handled by client)
 * - No session_id → redirect to /join (handled by client)
 */

interface WelcomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const params = await searchParams;

  // Extract session_id from server-side searchParams (Safari-safe)
  const sessionIdParam = params.session_id;
  const initialSessionId = typeof sessionIdParam === "string" ? sessionIdParam : "";

  return <WelcomeContent initialSessionId={initialSessionId} />;
}
