"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase/client";

export default function ConnectSocialPage() {
  const router = useRouter();
  const [facebookPersonalization, setFacebookPersonalization] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectSocial = async (provider: "facebook") => {
    setIsLoading(true);
    setError(null);

    try {
      // Store personalization preference
      if (provider === "facebook") {
        sessionStorage.setItem("facebookPersonalization", facebookPersonalization.toString());
      }

      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/sanctuary`,
        },
      });
    } catch (err: any) {
      console.error("Social connect error:", err);
      setError("Unable to connect. Please try again.");
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push("/sanctuary");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Connect social accounts (optional)
          </CardTitle>
          <p className="text-center text-sm text-accent-ink/60 mt-2">
            Would you like to connect social accounts to improve your experience?
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
              {error}
            </div>
          )}

          {/* Social connection options */}
          <div className="space-y-6">
            {/* Facebook */}
            <div className="border border-border-subtle rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-semibold">
                    F
                  </div>
                  <div>
                    <p className="font-medium">Facebook</p>
                    <p className="text-xs text-accent-ink/60">
                      Connect your Facebook account
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleConnectSocial("facebook")}
                  disabled={isLoading}
                >
                  Connect
                </Button>
              </div>

              <div className="flex items-center space-x-2 ml-15">
                <Checkbox
                  id="facebook-personalization"
                  checked={facebookPersonalization}
                  onCheckedChange={(checked) => setFacebookPersonalization(checked === true)}
                />
                <label
                  htmlFor="facebook-personalization"
                  className="text-sm text-accent-ink/80 cursor-pointer"
                >
                  Use Facebook to improve my experience
                </label>
              </div>
            </div>

            {/* TikTok - Stub */}
            <div className="border border-border-subtle rounded-lg p-4 opacity-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white font-semibold">
                    T
                  </div>
                  <div>
                    <p className="font-medium">TikTok</p>
                    <p className="text-xs text-accent-ink/60">Coming soon</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </div>
            </div>

            {/* X/Twitter - Stub */}
            <div className="border border-border-subtle rounded-lg p-4 opacity-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white font-semibold">
                    X
                  </div>
                  <div>
                    <p className="font-medium">X (Twitter)</p>
                    <p className="text-xs text-accent-ink/60">Coming soon</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </div>
            </div>

            {/* Reddit - Stub */}
            <div className="border border-border-subtle rounded-lg p-4 opacity-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#FF4500] flex items-center justify-center text-white font-semibold">
                    R
                  </div>
                  <div>
                    <p className="font-medium">Reddit</p>
                    <p className="text-xs text-accent-ink/60">Coming soon</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </div>
            </div>

            {/* Skip button */}
            <div className="pt-4">
              <Button
                variant="outline"
                onClick={handleSkip}
                className="w-full"
                disabled={isLoading}
              >
                Skip for now
              </Button>
            </div>

            <div className="text-center text-xs text-accent-ink/60">
              <p>You can connect social accounts later in Settings</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
