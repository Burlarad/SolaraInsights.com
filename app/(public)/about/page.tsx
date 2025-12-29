import { Card, CardContent } from "@/components/ui/card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Solara Insights",
  description: "Learn about Solara Insights - our mission, values, and commitment to bringing clarity and connection to your cosmic journey.",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-5xl font-bold text-center mb-12">About Solara Insights</h1>

      <Card className="p-8 md:p-12">
        <CardContent className="space-y-12 p-0">
          {/* Why We Exist */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Why We Exist
            </h2>
            <div className="space-y-4 text-lg text-accent-ink/80 leading-relaxed">
              <p>
                In a world full of noise, we believe everyone deserves a moment of clarity.
              </p>
              <p>
                Solara Insights was created to help you understand yourself better&mdash;your
                strengths, your patterns, your relationships&mdash;through the timeless wisdom
                of astrology, made personal and accessible.
              </p>
              <p>
                We&apos;re here to bring light to your journey.
              </p>
            </div>
          </section>

          {/* What We Do */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              What We Do
            </h2>
            <div className="space-y-4 text-lg text-accent-ink/80 leading-relaxed">
              <p>
                Solara Insights is a personalized astrology platform that delivers horoscopes,
                birth chart interpretations, and relationship insights tailored specifically
                to you.
              </p>
              <p>
                Our content is generated using proprietary methods and trusted third-party
                services to create meaningful, personalized guidance based on your unique
                astrological profile.
              </p>
              <p>
                Whether you&apos;re exploring your natal chart, checking your daily horoscope,
                or understanding compatibility with someone special, we make astrology feel
                personal, not generic.
              </p>
            </div>
          </section>

          {/* Our Values */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Our Values
            </h2>
            <div className="space-y-6 text-lg text-accent-ink/80 leading-relaxed">
              <div>
                <p className="font-semibold text-accent-ink mb-2">Clarity over confusion</p>
                <p>
                  We cut through the noise to give you insights that actually make sense for
                  your life.
                </p>
              </div>
              <div>
                <p className="font-semibold text-accent-ink mb-2">Personalization matters</p>
                <p>
                  Your chart is unique. Your insights should be too.
                </p>
              </div>
              <div>
                <p className="font-semibold text-accent-ink mb-2">Privacy first</p>
                <p>
                  Your data is yours. We protect it fiercely.
                </p>
              </div>
              <div>
                <p className="font-semibold text-accent-ink mb-2">Giving back</p>
                <p>
                  10% of our profits support causes that bring light to others&mdash;because
                  when you grow brighter, the world does too.
                </p>
              </div>
            </div>
          </section>

          {/* Welcome Home */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Welcome Home
            </h2>
            <div className="space-y-4 text-lg text-accent-ink/80 leading-relaxed">
              <p>
                If you&apos;ve been searching for a space that feels honest, thoughtful, and
                full of heart&mdash;you&apos;ve found it.
              </p>
              <p className="font-medium text-accent-ink">
                Solara Insights&mdash;where your cosmic journey finds its clarity.
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
