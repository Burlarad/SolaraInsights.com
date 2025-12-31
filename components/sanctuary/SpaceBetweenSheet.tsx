"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpaceBetweenReport } from "@/types";
import { useTranslations } from "next-intl";

interface SpaceBetweenSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  connectionName: string;
}

// Accordion item for Space Between sections
function SpaceAccordionItem({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-accent-muted">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left hover:text-accent-gold transition-colors"
      >
        <span className="font-medium text-accent-ink">{title}</span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-accent-ink/60 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="pb-6 text-accent-ink/70 text-sm leading-relaxed whitespace-pre-wrap">
          {children}
        </div>
      )}
    </div>
  );
}

export function SpaceBetweenSheet({
  open,
  onOpenChange,
  connectionId,
  connectionName,
}: SpaceBetweenSheetProps) {
  const t = useTranslations("spaceBetween");
  const tCommon = useTranslations("common");
  const [spaceBetween, setSpaceBetween] = useState<SpaceBetweenReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSpaceBetween = useCallback(async () => {
    if (!connectionId || loading) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/connection-space-between", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If locked (403), just close the sheet - no locked UI
        if (response.status === 403) {
          onOpenChange(false);
          return;
        }
        throw new Error(data.message || "Failed to load Space Between");
      }

      setSpaceBetween(data);
    } catch (err: any) {
      console.error("Error loading Space Between:", err);
      setError(err.message || "Unable to load relationship blueprint");
    } finally {
      setLoading(false);
    }
  }, [connectionId, loading, onOpenChange]);

  // Load when sheet opens
  useEffect(() => {
    if (open && !spaceBetween && !loading && !error) {
      loadSpaceBetween();
    }
  }, [open, spaceBetween, loading, error, loadSpaceBetween]);

  // Reset state when connectionId changes
  useEffect(() => {
    setSpaceBetween(null);
    setError(null);
  }, [connectionId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-accent-gold">{t("title")}</SheetTitle>
          <SheetDescription>
            {t("subtitle", { connectionName })}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-accent-gold mb-4" />
            <p className="text-sm text-accent-ink/60">
              {t("generating")}
            </p>
            <p className="text-xs text-accent-ink/40 mt-2">
              {t("generatingHint")}
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">😔</p>
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={loadSpaceBetween}>
              {tCommon("tryAgain")}
            </Button>
          </div>
        ) : spaceBetween ? (
          <div className="space-y-0">
              <SpaceAccordionItem title={t("sections.essence")} defaultOpen={true}>
                {spaceBetween.relationship_essence}
              </SpaceAccordionItem>
              <SpaceAccordionItem title={t("sections.emotionalBlueprint")}>
                {spaceBetween.emotional_blueprint}
              </SpaceAccordionItem>
              <SpaceAccordionItem title={t("sections.communication")}>
                {spaceBetween.communication_patterns}
              </SpaceAccordionItem>
              <SpaceAccordionItem title={t("sections.growthEdges")}>
                {spaceBetween.growth_edges}
              </SpaceAccordionItem>
              <SpaceAccordionItem title={t("sections.careGuide")}>
                {spaceBetween.care_guide}
              </SpaceAccordionItem>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🌌</p>
            <h3 className="text-lg font-semibold mb-2">
              {t("discover")}
            </h3>
            <p className="text-accent-ink/60 mb-6 max-w-md mx-auto">
              {t("discoverDescription", { connectionName })}
            </p>
            <Button variant="gold" onClick={loadSpaceBetween}>
              {t("generateBlueprint")}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
