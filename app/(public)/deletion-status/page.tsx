import { Metadata } from "next";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { DeletionStatusContent } from "./DeletionStatusContent";

export const metadata: Metadata = {
  title: "Data Deletion Status | Solara Insights",
  description: "Check the status of your data deletion request.",
};

interface DeletionStatusPageProps {
  searchParams: Promise<{ code?: string }>;
}

export default async function DeletionStatusPage({ searchParams }: DeletionStatusPageProps) {
  const { code } = await searchParams;

  if (!code) {
    return <DeletionStatusContent code={null} request={null} error={false} />;
  }

  // Look up the deletion request
  const admin = createAdminSupabaseClient();
  const { data: request, error } = await admin
    .from("facebook_data_deletion_requests")
    .select("status, requested_at, processed_at, error_message")
    .eq("confirmation_code", code)
    .single();

  if (error || !request) {
    return <DeletionStatusContent code={code} request={null} error={true} />;
  }

  return (
    <DeletionStatusContent
      code={code}
      request={{
        status: request.status,
        requested_at: request.requested_at,
        processed_at: request.processed_at,
        error_message: request.error_message,
      }}
      error={false}
    />
  );
}
