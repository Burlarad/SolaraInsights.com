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
              <p>
                We exist to bring light where the world has grown heavy. In a time of
                division, distraction, and relentless noise, Solara offers a different
                kind of space—one rooted in calm, clarity, and care.
              </p>
              <p>
                We believe that understanding yourself isn&apos;t a luxury. It&apos;s survival.
                And that the tools to do so—astrology, tarot, reflection—shouldn&apos;t be
                gatekept, fear-based, or overwhelming.
              </p>
              <p>
                Solara is what happens when ancient wisdom meets modern emotional
                intelligence. It&apos;s a sanctuary built for the seekers, the sensitive,
                the ones who refuse to numb out.
              </p>
            </div>
          </section>

          {/* The Spirit Behind the Light */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              The Spirit Behind the Light
            </h2>
            <div className="space-y-4 text-lg text-accent-ink/80 leading-relaxed-plus">
              <p>Solara is built for:</p>
              <ul className="list-none space-y-3 ml-6">
                <li className="flex items-start gap-3">
                  <span className="text-accent-gold mt-1">✦</span>
                  <span>
                    The rule-breakers and dreamers who know there&apos;s more to life than
                    what they&apos;ve been sold.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent-gold mt-1">✦</span>
                  <span>
                    Those who blend ancient astrology with modern insight, trusting both
                    the cosmos and their own intuition.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent-gold mt-1">✦</span>
                  <span>
                    Anyone who believes that being human is messy, beautiful, and worth
                    celebrating—not fixing.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent-gold mt-1">✦</span>
                  <span>
                    People who value emotional intelligence as much as intellectual
                    knowledge.
                  </span>
                </li>
              </ul>
              <p>
                We don&apos;t traffic in absolutes. We don&apos;t promise to &quot;fix&quot; you. We reflect
                your sky back to you—gently, honestly, and with deep respect for your
                agency and free will.
              </p>
            </div>
          </section>

          {/* Our Work in the World */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Our Work in the World
            </h2>
            <div className="space-y-4 text-lg text-accent-ink/80 leading-relaxed-plus">
              <p>
                Solara isn&apos;t just a digital product. It&apos;s a commitment to doing good in
                the world—starting with the lives most vulnerable.
              </p>
              <p>
                Through the <strong>Solara Foundation</strong>, a portion of every
                subscription directly supports families in crisis: refugees, displaced
                communities, and those navigating systems designed to fail them.
              </p>
              <p>
                We believe in protecting lives on Earth—not just reflecting the stars
                above it. Philanthropy isn&apos;t a side mission. It&apos;s baked into everything
                we do.
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
                If you&apos;ve been searching for a space that feels honest, human, and
                hopeful—you&apos;ve found it.
              </p>
              <p>
                Solara is here. The light is on. And there&apos;s room for you exactly as you
                are.
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
