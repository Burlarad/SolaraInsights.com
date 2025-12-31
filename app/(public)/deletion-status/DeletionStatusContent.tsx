"use client";

import { Card, CardContent } from "@/components/ui/card";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { useTranslations } from "next-intl";

interface DeletionStatusContentProps {
  code: string | null;
  request: {
    status: string;
    requested_at: string;
    processed_at: string | null;
    error_message: string | null;
  } | null;
  error: boolean;
}

export function DeletionStatusContent({ code, request, error }: DeletionStatusContentProps) {
  const t = useTranslations("deletion");

  if (!code) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Solara Logo - subtle */}
        <div className="flex justify-center items-center pt-2 pb-4">
          <SolaraLogo size="sm" className="opacity-50 scale-75" />
        </div>
        <h1 className="text-3xl font-bold text-center mb-8">{t("pageTitle")}</h1>
        <Card className="p-8">
          <CardContent className="p-0 text-center">
            <p className="text-accent-ink/80">
              {t("noCode")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Solara Logo - subtle */}
        <div className="flex justify-center items-center pt-2 pb-4">
          <SolaraLogo size="sm" className="opacity-50 scale-75" />
        </div>
        <h1 className="text-3xl font-bold text-center mb-8">{t("pageTitle")}</h1>
        <Card className="p-8">
          <CardContent className="p-0 text-center">
            <p className="text-accent-ink/80">
              {t("notFound")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig: Record<string, { labelKey: string; descKey: string; color: string }> = {
    pending: {
      labelKey: "pending.title",
      descKey: "pending.description",
      color: "text-amber-600",
    },
    processing: {
      labelKey: "processing.title",
      descKey: "processing.description",
      color: "text-blue-600",
    },
    completed: {
      labelKey: "completed.title",
      descKey: "completed.description",
      color: "text-green-600",
    },
    failed: {
      labelKey: "failed.title",
      descKey: "failed.description",
      color: "text-red-600",
    },
    user_not_found: {
      labelKey: "userNotFound.title",
      descKey: "userNotFound.description",
      color: "text-gray-600",
    },
  };

  const statusInfo = statusConfig[request.status] || statusConfig.pending;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Solara Logo - subtle */}
      <div className="flex justify-center items-center pt-2 pb-4">
        <SolaraLogo size="sm" className="opacity-50 scale-75" />
      </div>
      <h1 className="text-3xl font-bold text-center mb-8">{t("pageTitle")}</h1>

      <Card className="p-8">
        <CardContent className="p-0 space-y-6">
          <div className="text-center">
            <p className="text-sm text-accent-ink/60 mb-2">{t("confirmationCode")}</p>
            <p className="font-mono text-lg">{code}</p>
          </div>

          <div className="border-t border-border-subtle pt-6">
            <div className="text-center">
              <p className="text-sm text-accent-ink/60 mb-2">{t("status")}</p>
              <p className={`text-2xl font-semibold ${statusInfo.color}`}>{t(statusInfo.labelKey)}</p>
              <p className="mt-2 text-accent-ink/80">{t(statusInfo.descKey)}</p>
            </div>
          </div>

          <div className="border-t border-border-subtle pt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-accent-ink/60">{t("requestReceived")}</span>
              <span className="text-accent-ink/80">
                {new Date(request.requested_at).toLocaleString()}
              </span>
            </div>
            {request.processed_at && (
              <div className="flex justify-between text-sm">
                <span className="text-accent-ink/60">{t("processed")}</span>
                <span className="text-accent-ink/80">
                  {new Date(request.processed_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {request.status === "failed" && request.error_message && (
            <div className="border-t border-border-subtle pt-6">
              <p className="text-sm text-red-600">
                {t("errorDetails")}: {request.error_message}
              </p>
              <p className="text-sm text-accent-ink/60 mt-2">
                {t("contactSupport")}
              </p>
            </div>
          )}

          {request.status === "completed" && (
            <div className="border-t border-border-subtle pt-6 text-center">
              <p className="text-sm text-accent-ink/60">
                {t("completed.permanentNotice")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <p className="text-sm text-accent-ink/60">
          {t("questions")}{" "}
          <a href="mailto:solara@solarainsights.com" className="text-accent-gold hover:underline">
            solara@solarainsights.com
          </a>
        </p>
      </div>
    </div>
  );
}
