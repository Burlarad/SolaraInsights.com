import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/shared/Chip";
import { Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LearnGuideCardProps {
  title: string;
  summary: string;
  readingTime: number;
  category: string;
  tags: string[];
  heroImage?: string;
  variant?: "default" | "roadmap";
}

export function LearnGuideCard({
  title,
  summary,
  readingTime,
  category,
  tags,
  heroImage,
  variant = "default",
}: LearnGuideCardProps) {
  if (variant === "roadmap") {
    return (
      <Card className="min-w-[280px] p-6 flex flex-col gap-4 bg-white hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-2 text-xs text-accent-ink/60">
          <Clock className="h-3 w-3" />
          <span>{readingTime} MIN</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-sm text-accent-ink/70 line-clamp-2">{summary}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-accent-gold hover:underline cursor-pointer mt-auto">
          <span>OPEN GUIDE</span>
          <ArrowRight className="h-4 w-4" />
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Chip key={tag} className="text-xs">
              {tag}
            </Chip>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Hero image */}
      {heroImage && (
        <div className="relative h-48 bg-gradient-to-br from-accent-muted to-accent-lavender flex items-center justify-center">
          <div className="absolute top-4 left-4 flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/90 pill text-xs">
              <Clock className="h-3 w-3" />
              <span>{readingTime} MIN</span>
            </div>
            <span className="micro-label bg-white/90 pill">{category}</span>
          </div>
          {/* Placeholder for image */}
          <span className="text-6xl opacity-50">✨</span>
        </div>
      )}

      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-2xl font-semibold mb-2">{title}</h3>
          <p className="text-base text-accent-ink/70 leading-relaxed">{summary}</p>
        </div>

        <div className="flex items-center gap-2 text-sm text-accent-gold hover:underline cursor-pointer">
          <span>Open guide</span>
          <ArrowRight className="h-4 w-4" />
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
  );
}
