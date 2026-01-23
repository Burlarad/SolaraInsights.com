"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LearnGuideCard } from "@/components/learn/LearnGuideCard";
import { LEARN_ITEMS } from "@/lib/learn/content";
import { ArrowRight } from "lucide-react";

export function LearnPreview() {
  const t = useTranslations("learn");

  // Show first 6 guides
  const previewGuides = LEARN_ITEMS.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Guide cards grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {previewGuides.map((item) => (
          <LearnGuideCard key={item.slug} item={item} />
        ))}
      </div>

      {/* View all link */}
      <div className="text-center">
        <Link href="/learn">
          <Button variant="outline" className="min-h-[48px] gap-2">
            {t("viewAllGuides")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
