import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { Chip } from "@/components/shared/Chip";
import { Clock } from "lucide-react";
import {
  LEARN_ITEMS,
  getLearnItemBySlug,
  getPrevNextLearnItems,
} from "@/lib/learn/content";
import { BackToLearn, GuideNavigation, MinutesRead } from "@/components/learn/GuideNavigation";

// Guide content components
import { GuideAstrology101 } from "@/components/learn/guides/astrology-101";
import { GuideBigThree } from "@/components/learn/guides/big-three";
import { GuideElementsModalities } from "@/components/learn/guides/elements-modalities";
import { GuidePlanets101 } from "@/components/learn/guides/planets-101";
import { GuideHouses101 } from "@/components/learn/guides/houses-101";
import { GuideTransits101 } from "@/components/learn/guides/transits-101";
import { GuideRetrogrades } from "@/components/learn/guides/retrogrades";
import { GuideNodesChironLilith } from "@/components/learn/guides/nodes-chiron-lilith";
import { GuideTarot101 } from "@/components/learn/guides/tarot-101";
import { GuideCompatibility101 } from "@/components/learn/guides/compatibility-101";

// Map slugs to guide content components
const GUIDE_COMPONENTS: Record<string, React.ReactNode> = {
  "astrology-101": <GuideAstrology101 />,
  "big-three": <GuideBigThree />,
  "elements-modalities": <GuideElementsModalities />,
  "planets-101": <GuidePlanets101 />,
  "houses-101": <GuideHouses101 />,
  "transits-101": <GuideTransits101 />,
  "retrogrades": <GuideRetrogrades />,
  "nodes-chiron-lilith": <GuideNodesChironLilith />,
  "tarot-101": <GuideTarot101 />,
  "compatibility-101": <GuideCompatibility101 />,
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getLearnItemBySlug(slug);

  if (!item) {
    return {
      title: "Guide Not Found | Solara Insights",
    };
  }

  return {
    title: `${item.title} | Learn | Solara Insights`,
    description: item.description,
    openGraph: {
      title: `${item.title} | Learn | Solara Insights`,
      description: item.description,
    },
  };
}

export function generateStaticParams() {
  return LEARN_ITEMS.map((item) => ({ slug: item.slug }));
}

export default async function LearnGuidePage({ params }: PageProps) {
  const { slug } = await params;
  const item = getLearnItemBySlug(slug);

  if (!item) {
    notFound();
  }

  const { prev, next } = getPrevNextLearnItems(slug);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="flex justify-center items-center pt-4 pb-6">
        <SolaraLogo />
      </div>

      <BackToLearn />

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="micro-label">{item.category.toUpperCase()}</span>
          <div className="flex items-center gap-1 text-sm text-accent-ink/60">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <MinutesRead minutes={item.minutes} />
          </div>
          <span className="text-xs bg-accent-muted text-accent-ink/70 px-2 py-0.5 rounded-full">
            {item.level}
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{item.title}</h1>
        <p className="text-lg text-accent-ink/70 leading-relaxed">
          {item.description}
        </p>
        <div className="flex flex-wrap gap-2 mt-6">
          {item.tags.map((tag) => (
            <Chip key={tag} className="text-xs">
              {tag}
            </Chip>
          ))}
        </div>
      </header>

      <Card className="p-6 md:p-8">
        <CardContent className="p-0 prose prose-lg max-w-none">
          {GUIDE_COMPONENTS[slug]}
        </CardContent>
      </Card>

      <GuideNavigation prev={prev} next={next} />
    </div>
  );
}
