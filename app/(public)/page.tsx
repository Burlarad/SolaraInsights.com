import { HeroSection } from "@/components/home/HeroSection";
import { ZodiacGrid } from "@/components/home/ZodiacGrid";
import { SolaraPath } from "@/components/home/SolaraPath";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <ZodiacGrid />
      <SolaraPath />
    </div>
  );
}
