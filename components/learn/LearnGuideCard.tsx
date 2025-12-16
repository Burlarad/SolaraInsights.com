import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/shared/Chip";
import { Clock, ArrowRight } from "lucide-react";
import { LearnItem } from "@/lib/learn/content";

interface LearnGuideCardProps {
  item: LearnItem;
  variant?: "default" | "compact" | "roadmap";
  /** Step number for roadmap variant */
  stepNumber?: number;
}

export function LearnGuideCard({
  item,
  variant = "default",
  stepNumber,
}: LearnGuideCardProps) {
  const { slug, title, description, category, level, minutes, tags } = item;

  // Roadmap variant - horizontal scroll card with step number
  if (variant === "roadmap") {
    return (
      <Link href={`/learn/${slug}`} className="block group">
        <Card className="min-w-[280px] max-w-[300px] p-5 flex flex-col gap-3 bg-white hover:shadow-lg transition-shadow h-full">
          <div className="flex items-center gap-2">
            {stepNumber && (
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-gold/10 text-accent-gold text-xs font-semibold">
                {stepNumber}
              </span>
            )}
            <div className="flex items-center gap-1 text-xs text-accent-ink/60">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span>{minutes} MIN</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold mb-1 group-hover:text-accent-gold transition-colors line-clamp-2">
              {title}
            </h3>
            <p className="text-sm text-accent-ink/70 line-clamp-2">
              {description}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-accent-gold mt-auto">
            <span>START</span>
            <ArrowRight
              className="h-4 w-4 group-hover:translate-x-1 transition-transform"
              aria-hidden="true"
            />
          </div>
        </Card>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href={`/learn/${slug}`} className="block group">
        <Card className="min-w-[280px] p-6 flex flex-col gap-4 bg-white hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 text-xs text-accent-ink/60">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>{minutes} MIN</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2 group-hover:text-accent-gold transition-colors">
              {title}
            </h3>
            <p className="text-sm text-accent-ink/70 line-clamp-2">
              {description}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-accent-gold mt-auto">
            <span>OPEN GUIDE</span>
            <ArrowRight
              className="h-4 w-4 group-hover:translate-x-1 transition-transform"
              aria-hidden="true"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 3).map((tag) => (
              <Chip key={tag} className="text-xs">
                {tag}
              </Chip>
            ))}
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/learn/${slug}`} className="block group">
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
        {/* Hero gradient */}
        <div className="relative h-40 bg-gradient-to-br from-accent-muted to-accent-lavender flex items-center justify-center">
          <div className="absolute top-4 left-4 flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/90 pill text-xs">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span>{minutes} MIN</span>
            </div>
            <span className="micro-label bg-white/90 pill">{level}</span>
          </div>
          {/* Category icon */}
          <span className="text-4xl opacity-40" aria-hidden="true">
            {category === "Astrology Basics" && "✦"}
            {category === "Astrology Intermediate" && "✧"}
            {category === "Tarot Basics" && "🃏"}
            {category === "Compatibility" && "💫"}
          </span>
        </div>

        <CardContent className="p-6 space-y-4 flex-1 flex flex-col">
          <div className="flex-1">
            <p className="micro-label mb-2">{category.toUpperCase()}</p>
            <h3 className="text-xl font-semibold mb-2 group-hover:text-accent-gold transition-colors">
              {title}
            </h3>
            <p className="text-sm text-accent-ink/70 leading-relaxed line-clamp-3">
              {description}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-accent-gold">
            <span>Open guide</span>
            <ArrowRight
              className="h-4 w-4 group-hover:translate-x-1 transition-transform"
              aria-hidden="true"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {tags.map((tag) => (
              <Chip key={tag} className="text-xs">
                {tag}
              </Chip>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
