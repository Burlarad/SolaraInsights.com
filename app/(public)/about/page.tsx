import { Card, CardContent } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-5xl font-bold text-center mb-12">About Solara Insights</h1>

      <Card className="p-12">
        <CardContent className="space-y-12 p-0">
          {/* Reason for Existence */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Reason for Existence
            </h2>
            <div className="space-y-4 text-lg text-accent-ink/80 leading-relaxed-plus">
              <p className="font-medium text-accent-ink">
                Because so many around us have lost faith, we exist to bring the light to conquer darkness.
              </p>
              <p>
                The world has become loud, divided, and heavy. We&apos;re here to remind people that hope still lives inside them and that goodness in humanity is not gone—it&apos;s waiting to be seen.
              </p>
              <p>
                Solara Insights was created to guide people back to that light with wonder, and care.
              </p>
            </div>
          </section>

          {/* The Spirit Behind the Light */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              The Spirit Behind the Light
            </h2>
            <div className="space-y-4 text-lg text-accent-ink/80 leading-relaxed-plus">
              <p className="font-medium text-accent-ink">
                We are the rule-breakers, the earth-shakers and the light in the dark.
              </p>
              <p>We&apos;re dreamers.</p>
              <p>We&apos;re rebels with open hearts challenging the status quo.</p>
              <p>We blend ancient astrology with modern insight, art and humanity.</p>
              <p>We don&apos;t preach perfection. We celebrate the messy, magical human journey.</p>
              <p>Here, every sign, every soul, every story matters.</p>
            </div>
          </section>

          {/* Our Work in the World */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Our Work in the World
            </h2>
            <div className="space-y-4 text-lg text-accent-ink/80 leading-relaxed-plus">
              <p>
                We bring astrological fun and genuine connection to your everyday life—so self-discovery feels joyful, not judgmental.
              </p>
              <p>
                Every chart, every horoscope, every spark of guidance is crafted to help you know yourself better and feel lighter doing it.
              </p>
              <p>
                But Solara isn&apos;t just about the fun. It&apos;s about protecting the lives here on Earth.
              </p>
              <p>
                Every dollar you spend here helps restore hope, keep families together, and rebuild lives through The Solara Foundation.
              </p>
              <p>
                When you grow brighter, others do too.
              </p>
              <p>
                That&apos;s how we heal—one insight, one act of kindness, one family at a time.
              </p>
            </div>
          </section>

          {/* Welcome Home */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Welcome Home
            </h2>
            <div className="space-y-4 text-lg text-accent-ink/80 leading-relaxed-plus">
              <p>
                If you&apos;ve been searching for a space that feels honest, human, and full of heart—you&apos;ve found it.
              </p>
              <p className="font-medium text-accent-ink">
                Solara Insights—where faith in humanity finds its light.
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
