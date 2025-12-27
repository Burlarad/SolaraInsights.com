import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { Profile } from "@/types";

export type DeletionSource = "user_request" | "meta_callback" | "admin";

export interface DeleteAccountParams {
  userId: string;
  requestId?: string;
  source: DeletionSource;
}

export interface DeleteAccountResult {
  success: boolean;
  deletedTables: string[];
  errors: string[];
  stripeSubscriptionCanceled: boolean;
}

/**
 * Core account deletion logic - reusable across different deletion triggers.
 * Uses service role to bypass RLS.
 *
 * Deletion order (respects foreign key constraints):
 * 1. Cancel Stripe subscription (if exists)
 * 2. soul_paths
 * 3. social_accounts (tokens - but NOT social_identities)
 * 4. social_summaries
 * 5. connections (cascades daily_briefs, space_between_reports)
 * 6. profiles
 * 7. auth.users (last)
 *
 * Note: social_identities is NOT deleted - it preserves the external_user_id → user_id
 * mapping for Meta Data Deletion compliance (we need to look up users by Facebook ID).
 */
export async function deleteAccountCore({
  userId,
  requestId,
  source,
}: DeleteAccountParams): Promise<DeleteAccountResult> {
  const result: DeleteAccountResult = {
    success: false,
    deletedTables: [],
    errors: [],
    stripeSubscriptionCanceled: false,
  };

  const logPrefix = `[Delete Account][${source}]${requestId ? `[${requestId}]` : ""}`;
  console.log(`${logPrefix} Starting deletion for user: ${userId}`);

  const admin = createAdminSupabaseClient();

  try {
    // Step 1: Get profile for Stripe info
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("id", userId)
      .single();

    const typedProfile = profile as Pick<
      Profile,
      "stripe_subscription_id" | "stripe_customer_id"
    > | null;

    // Step 2: Cancel Stripe subscription if exists
    if (typedProfile?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(typedProfile.stripe_subscription_id);
        console.log(
          `${logPrefix} Canceled Stripe subscription: ${typedProfile.stripe_subscription_id}`
        );
        result.stripeSubscriptionCanceled = true;
      } catch (stripeError: any) {
        // Log but continue - subscription might already be canceled
        console.error(
          `${logPrefix} Failed to cancel Stripe subscription:`,
          stripeError.message
        );
        result.errors.push(`Stripe: ${stripeError.message}`);
      }
    }

    // Step 3: Delete soul_paths
    const { error: soulPathsError } = await admin
      .from("soul_paths")
      .delete()
      .eq("user_id", userId);

    if (soulPathsError) {
      console.error(`${logPrefix} Failed to delete soul_paths:`, soulPathsError);
      result.errors.push(`soul_paths: ${soulPathsError.message}`);
    } else {
      console.log(`${logPrefix} Deleted soul_paths`);
      result.deletedTables.push("soul_paths");
    }

    // Step 4: Delete social_accounts (tokens only - NOT social_identities)
    const { error: socialAccountsError } = await admin
      .from("social_accounts")
      .delete()
      .eq("user_id", userId);

    if (socialAccountsError) {
      console.error(
        `${logPrefix} Failed to delete social_accounts:`,
        socialAccountsError
      );
      result.errors.push(`social_accounts: ${socialAccountsError.message}`);
    } else {
      console.log(`${logPrefix} Deleted social_accounts`);
      result.deletedTables.push("social_accounts");
    }

    // Step 5: Delete social_summaries
    const { error: socialSummariesError } = await admin
      .from("social_summaries")
      .delete()
      .eq("user_id", userId);

    if (socialSummariesError) {
      console.error(
        `${logPrefix} Failed to delete social_summaries:`,
        socialSummariesError
      );
      result.errors.push(`social_summaries: ${socialSummariesError.message}`);
    } else {
      console.log(`${logPrefix} Deleted social_summaries`);
      result.deletedTables.push("social_summaries");
    }

    // Step 6: Delete connections (cascades daily_briefs, space_between_reports)
    const { error: connectionsError } = await admin
      .from("connections")
      .delete()
      .eq("owner_user_id", userId);

    if (connectionsError) {
      console.error(`${logPrefix} Failed to delete connections:`, connectionsError);
      result.errors.push(`connections: ${connectionsError.message}`);
    } else {
      console.log(
        `${logPrefix} Deleted connections (cascaded daily_briefs, space_between_reports)`
      );
      result.deletedTables.push("connections");
    }

    // Step 7: Delete profile
    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error(`${logPrefix} Failed to delete profile:`, profileError);
      result.errors.push(`profiles: ${profileError.message}`);
      // Profile deletion failure is critical - return early
      return result;
    }
    console.log(`${logPrefix} Deleted profile`);
    result.deletedTables.push("profiles");

    // Step 8: Delete auth user (must be last)
    const { error: authError } = await admin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error(`${logPrefix} Failed to delete auth user:`, authError);
      result.errors.push(`auth.users: ${authError.message}`);
      return result;
    }
    console.log(`${logPrefix} Deleted auth user`);
    result.deletedTables.push("auth.users");

    console.log(`${logPrefix} Successfully deleted account for user: ${userId}`);
    result.success = true;
    return result;
  } catch (error: any) {
    console.error(`${logPrefix} Unexpected error:`, error);
    result.errors.push(`Unexpected: ${error.message}`);
    return result;
  }
}
