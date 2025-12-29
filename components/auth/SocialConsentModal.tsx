"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * Provider display names for the consent modal
 */
const PROVIDER_NAMES: Record<string, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  reddit: "Reddit",
  instagram: "Instagram",
};

interface SocialConsentModalProps {
  provider: string;
  isOpen: boolean;
  defaultChecked?: boolean;
  onContinue: (consentChecked: boolean) => void;
  onClose: () => void;
}

/**
 * Compact consent modal shown before OAuth redirect.
 * Single "Continue" button - checkbox controls whether Social Insights auto-connects.
 */
export function SocialConsentModal({
  provider,
  isOpen,
  defaultChecked = true,
  onContinue,
  onClose,
}: SocialConsentModalProps) {
  const [checked, setChecked] = useState(defaultChecked);
  const providerName = PROVIDER_NAMES[provider] || provider;

  const handleContinue = () => {
    onContinue(checked);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg text-center">
            Continue with {providerName}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="social-consent"
              checked={checked}
              onCheckedChange={(val) => setChecked(val === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor="social-consent"
                className="text-sm font-medium cursor-pointer"
              >
                Use {providerName} to enhance my experience
              </Label>
              <p className="text-xs text-accent-ink/60 mt-1">
                Optional. You can disconnect anytime in Settings.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="gold"
            onClick={handleContinue}
            className="w-full"
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
