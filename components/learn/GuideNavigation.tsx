"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { LearnItem } from "@/lib/learn/content";

interface GuideNavigationProps {
  prev: LearnItem | undefined;
  next: LearnItem | undefined;
}

export function BackToLearn() {
  const t = useTranslations("learn");

  return (
    <Link
      href="/learn"
      className="inline-flex items-center gap-2 text-sm text-accent-ink/60 hover:text-accent-gold transition-colors mb-8"
    >
      <ArrowLeft className="h-4 w-4" />
      {t("backToLearn")}
    </Link>
  );
}

export function GuideNavigation({ prev, next }: GuideNavigationProps) {
  const t = useTranslations("learn");

  if (!prev && !next) return null;

  return (
    <nav className="mt-12 flex flex-col md:flex-row gap-4" aria-label="Guide navigation">
      {prev ? (
        <Link
          href={`/learn/${prev.slug}`}
          className="flex-1 group flex items-center gap-3 p-4 rounded-lg border border-accent-muted hover:bg-accent-muted/30 hover:border-accent-gold/50 transition-colors min-h-[72px]"
        >
          <ChevronLeft
            className="h-5 w-5 text-accent-ink/40 group-hover:text-accent-gold transition-colors flex-shrink-0"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-accent-ink/50 uppercase tracking-wide mb-1">
              {t("previous")}
            </p>
            <p className="font-medium truncate group-hover:text-accent-gold transition-colors">
              {prev.title}
            </p>
            <div className="flex items-center gap-2 text-sm text-accent-ink/60">
              <span>{prev.minutes} min</span>
              <span>&middot;</span>
              <span>{prev.level}</span>
            </div>
          </div>
        </Link>
      ) : (
        <div className="flex-1 hidden md:block" />
      )}

      {next ? (
        <Link
          href={`/learn/${next.slug}`}
          className="flex-1 group flex items-center gap-3 p-4 rounded-lg border border-accent-muted hover:bg-accent-muted/30 hover:border-accent-gold/50 transition-colors min-h-[72px] md:text-right"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-accent-ink/50 uppercase tracking-wide mb-1">
              {t("next")}
            </p>
            <p className="font-medium truncate group-hover:text-accent-gold transition-colors">
              {next.title}
            </p>
            <div className="flex items-center gap-2 text-sm text-accent-ink/60 md:justify-end">
              <span>{next.minutes} min</span>
              <span>&middot;</span>
              <span>{next.level}</span>
            </div>
          </div>
          <ChevronRight
            className="h-5 w-5 text-accent-ink/40 group-hover:text-accent-gold transition-colors flex-shrink-0"
            aria-hidden="true"
          />
        </Link>
      ) : (
        <div className="flex-1 hidden md:block" />
      )}
    </nav>
  );
}

export function MinutesRead({ minutes }: { minutes: number }) {
  const t = useTranslations("learn");
  return <span>{minutes} {t("minRead")}</span>;
}
