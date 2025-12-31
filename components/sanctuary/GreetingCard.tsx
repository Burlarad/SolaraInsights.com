"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GreetingCardProps {
  name?: string;
  message?: string;
  className?: string;
}

export function GreetingCard({
  name,
  message,
  className,
}: GreetingCardProps) {
  const t = useTranslations("sanctuary");

  const displayName = name || t("greeting.defaultName");
  const displayMessage = message || t("greeting.defaultMessage");

  return (
    <Card className={cn("border-border-subtle", className)}>
      <CardContent className="p-4 md:p-8">
        <h2 className="text-2xl md:text-3xl font-semibold mb-2">
          {t("greeting.title", { name: displayName })}
        </h2>
        <p className="text-sm md:text-base text-accent-ink/70">{displayMessage}</p>
      </CardContent>
    </Card>
  );
}
