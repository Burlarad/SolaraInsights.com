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
import { ChevronDown, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpaceBetweenReport } from "@/types";

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
  const [spaceBetween, setSpaceBetween] = useState<SpaceBetweenReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutualLocked, setMutualLocked] = useState(false);
  const [mutualMessage, setMutualMessage] = useState<string | null>(null);

  const loadSpaceBetween = useCallback(async () => {
    if (!connectionId || loading) return;

    try {
      setLoading(true);
      setError(null);
      setMutualLocked(false);
      setMutualMessage(null);

      const response = await fetch("/api/connection-space-between", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle mutual requirement (403)
        if (response.status === 403 && data.error === "MUTUAL_REQUIRED") {
          setMutualLocked(true);
          setMutualMessage(data.message);
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
  }, [connectionId, loading]);

  // Load when sheet opens
  useEffect(() => {
    if (open && !spaceBetween && !loading && !error && !mutualLocked) {
      loadSpaceBetween();
    }
  }, [open, spaceBetween, loading, error, mutualLocked, loadSpaceBetween]);

  // Reset state when connectionId changes
  useEffect(() => {
    setSpaceBetween(null);
    setError(null);
    setMutualLocked(false);
    setMutualMessage(null);
  }, [connectionId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-accent-gold">The Space Between</SheetTitle>
          <SheetDescription>
            Your relationship blueprint with {connectionName}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-accent-gold mb-4" />
            <p className="text-sm text-accent-ink/60">
              Generating your relationship blueprint...
            </p>
            <p className="text-xs text-accent-ink/40 mt-2">
              This may take a moment
            </p>
          </div>
        ) : mutualLocked ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-accent-muted/50 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-accent-ink/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-accent-ink/80">
              Not Yet Unlocked
            </h3>
            <p className="text-accent-ink/60 max-w-sm mx-auto mb-4">
              {mutualMessage || `Space Between unlocks when ${connectionName} adds you back.`}
            </p>
            <p className="text-xs text-accent-ink/40">
              This page will update automatically when the connection becomes mutual.
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">😔</p>
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={loadSpaceBetween}>
              Try again
            </Button>
          </div>
        ) : spaceBetween ? (
          <div>
            {spaceBetween.includes_linked_birth_data && (
              <p className="text-xs text-green-600 mb-4">
                Includes {connectionName}&apos;s verified birth data
              </p>
            )}

            <div className="space-y-0">
              <SpaceAccordionItem title="Essence" defaultOpen={true}>
                {spaceBetween.relationship_essence}
              </SpaceAccordionItem>
              <SpaceAccordionItem title="Emotional Blueprint">
                {spaceBetween.emotional_blueprint}
              </SpaceAccordionItem>
              <SpaceAccordionItem title="Communication">
                {spaceBetween.communication_patterns}
              </SpaceAccordionItem>
              <SpaceAccordionItem title="Growth Edges">
                {spaceBetween.growth_edges}
              </SpaceAccordionItem>
              <SpaceAccordionItem title="Care Guide">
                {spaceBetween.care_guide}
              </SpaceAccordionItem>
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🌌</p>
            <h3 className="text-lg font-semibold mb-2">
              Discover the Space Between
            </h3>
            <p className="text-accent-ink/60 mb-6 max-w-md mx-auto">
              Generate your permanent relationship blueprint with {connectionName}.
              This deep insight is created once and saved forever.
            </p>
            <Button variant="gold" onClick={loadSpaceBetween}>
              Generate blueprint
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
