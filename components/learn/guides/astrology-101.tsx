export function GuideAstrology101() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold mb-4">What Astrology Is</h2>
        <p className="mb-4">
          Astrology is an ancient symbolic language that uses the positions of
          celestial bodies to understand patterns in human experience. Think of
          it as a map — not a script.
        </p>
        <p className="mb-4">
          Your birth chart (also called a natal chart) is a snapshot of the sky
          at the exact moment you were born. It shows where each planet was
          positioned relative to Earth.
        </p>
        <p>
          This chart doesn&apos;t determine who you are. It reflects tendencies,
          themes, and timing. You always have choice.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">What Astrology Isn&apos;t</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Not fortune-telling.</strong> Astrology describes patterns,
            not fixed outcomes. &quot;Mercury retrograde&quot; doesn&apos;t mean your life
            will fall apart.
          </li>
          <li>
            <strong>Not deterministic.</strong> Your chart shows potentials, not
            prisons. Two people with identical charts will live very different
            lives.
          </li>
          <li>
            <strong>Not just your Sun sign.</strong> Horoscopes in magazines use
            only one of many placements. Your full chart has 10+ planets across
            12 houses.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">The Three Main Components</h2>
        <p className="mb-4">Every chart has three core building blocks:</p>
        <ul className="list-disc pl-6 space-y-3">
          <li>
            <strong>Planets</strong> — The &quot;what.&quot; Each planet represents a
            different part of your psyche (Mercury = mind, Venus = values, Mars
            = drive, etc.).
          </li>
          <li>
            <strong>Signs</strong> — The &quot;how.&quot; The zodiac sign a planet is in
            colors how that energy expresses itself (Aries = direct, Pisces =
            intuitive, etc.).
          </li>
          <li>
            <strong>Houses</strong> — The &quot;where.&quot; The 12 houses represent life
            areas (1st house = self, 7th house = partnerships, 10th house =
            career, etc.).
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">A Simple Example</h2>
        <p className="mb-4">
          Let&apos;s say someone has <strong>Venus in Taurus in the 3rd house</strong>.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Venus</strong> (planet) = love, beauty, values
          </li>
          <li>
            <strong>Taurus</strong> (sign) = steady, sensual, security-focused
          </li>
          <li>
            <strong>3rd house</strong> (house) = communication, learning, local
            environment
          </li>
        </ul>
        <p className="mt-4">
          Translation: This person may express affection through words, enjoy
          learning about art or aesthetics, and find comfort in familiar
          neighborhoods and routines.
        </p>
      </section>

      <section className="bg-accent-muted/30 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Key Takeaways</h3>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>
            Astrology is a symbolic language, not a prediction machine
          </li>
          <li>
            Your chart shows tendencies, not fate — you always have choice
          </li>
          <li>
            Planets (what) + Signs (how) + Houses (where) = the basic formula
          </li>
        </ul>
      </section>

      <section className="bg-accent-lavender/20 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Try This</h3>
        <p className="text-sm mb-2">
          Look up your birth chart (you&apos;ll need your birth date, time, and
          location). Don&apos;t try to understand everything — just notice:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>What sign is your Sun in?</li>
          <li>What sign is your Moon in?</li>
          <li>What sign is your Rising (Ascendant)?</li>
        </ul>
        <p className="text-sm mt-2">
          These three form your &quot;Big Three&quot; — we&apos;ll cover them in the next
          lesson.
        </p>
      </section>

      <section className="border-l-4 border-accent-gold/50 pl-4">
        <h3 className="font-semibold mb-3">Common Misconceptions</h3>
        <ul className="space-y-3 text-sm">
          <li>
            <strong>&quot;Astrology told me I&apos;m destined to...&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              Astrology doesn&apos;t tell you what will happen. It shows themes and
              timing you might work with.
            </span>
          </li>
          <li>
            <strong>&quot;My sign is incompatible with their sign.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              Sun sign compatibility is a tiny fraction of the picture. Full
              chart comparison (synastry) is far more nuanced.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
