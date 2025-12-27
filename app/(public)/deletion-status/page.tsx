import { Card, CardContent } from "@/components/ui/card";
import { Metadata } from "next";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

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
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-center mb-8">Data Deletion Status</h1>
        <Card className="p-8">
          <CardContent className="p-0 text-center">
            <p className="text-accent-ink/80">
              No confirmation code provided. Please use the link from your data deletion confirmation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Look up the deletion request
  const admin = createAdminSupabaseClient();
  const { data: request, error } = await admin
    .from("facebook_data_deletion_requests")
    .select("status, requested_at, processed_at, error_message")
    .eq("confirmation_code", code)
    .single();

  if (error || !request) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-center mb-8">Data Deletion Status</h1>
        <Card className="p-8">
          <CardContent className="p-0 text-center">
            <p className="text-accent-ink/80">
              Deletion request not found. The confirmation code may be invalid or expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusMessages: Record<string, { label: string; description: string; color: string }> = {
    pending: {
      label: "Pending",
      description: "Your data deletion request has been received and is waiting to be processed.",
      color: "text-amber-600",
    },
    processing: {
      label: "Processing",
      description: "Your data is currently being deleted from our systems.",
      color: "text-blue-600",
    },
    completed: {
      label: "Completed",
      description: "Your data has been successfully deleted from Solara Insights.",
      color: "text-green-600",
    },
    failed: {
      label: "Failed",
      description: "There was an issue processing your deletion request. Please contact support.",
      color: "text-red-600",
    },
    user_not_found: {
      label: "No Data Found",
      description: "No account was found associated with your Facebook account. No data needed to be deleted.",
      color: "text-gray-600",
    },
  };

  const status = statusMessages[request.status] || statusMessages.pending;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-center mb-8">Data Deletion Status</h1>

      <Card className="p-8">
        <CardContent className="p-0 space-y-6">
          <div className="text-center">
            <p className="text-sm text-accent-ink/60 mb-2">Confirmation Code</p>
            <p className="font-mono text-lg">{code}</p>
          </div>

          <div className="border-t border-border-subtle pt-6">
            <div className="text-center">
              <p className="text-sm text-accent-ink/60 mb-2">Status</p>
              <p className={`text-2xl font-semibold ${status.color}`}>{status.label}</p>
              <p className="mt-2 text-accent-ink/80">{status.description}</p>
            </div>
          </div>

          <div className="border-t border-border-subtle pt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-accent-ink/60">Request Received</span>
              <span className="text-accent-ink/80">
                {new Date(request.requested_at).toLocaleString()}
              </span>
            </div>
            {request.processed_at && (
              <div className="flex justify-between text-sm">
                <span className="text-accent-ink/60">Processed</span>
                <span className="text-accent-ink/80">
                  {new Date(request.processed_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {request.status === "failed" && request.error_message && (
            <div className="border-t border-border-subtle pt-6">
              <p className="text-sm text-red-600">
                Error details: {request.error_message}
              </p>
              <p className="text-sm text-accent-ink/60 mt-2">
                Please contact us at solara@solarainsights.com for assistance.
              </p>
            </div>
          )}

          {request.status === "completed" && (
            <div className="border-t border-border-subtle pt-6 text-center">
              <p className="text-sm text-accent-ink/60">
                All your personal data associated with your Facebook account has been permanently
                deleted from Solara Insights. This action cannot be undone.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <p className="text-sm text-accent-ink/60">
          Questions? Contact us at{" "}
          <a href="mailto:solara@solarainsights.com" className="text-accent-gold hover:underline">
            solara@solarainsights.com
          </a>
        </p>
      </div>
    </div>
  );
}
