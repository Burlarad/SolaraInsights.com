export function GuideNodesChironLilith() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold mb-4">Beyond the Planets</h2>
        <p className="mb-4">
          Your birth chart contains more than just planets. Several sensitive
          points add psychological and spiritual depth to your chart. Three of
          the most discussed are the Lunar Nodes, Chiron, and Lilith.
        </p>
        <p className="text-sm text-accent-ink/70">
          These aren&apos;t physical bodies like planets. The Nodes are mathematical
          points. Chiron is a &quot;centaur&quot; (between asteroid and comet). Lilith
          is typically the Moon&apos;s apogee. Yet they carry meaningful
          symbolism in astrological interpretation.
        </p>
      </section>

      {/* NODES SECTION */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          The Lunar Nodes: Growth vs. Comfort
        </h2>
        <p className="mb-4">
          The Lunar Nodes are where the Moon&apos;s orbit crosses the Sun&apos;s apparent
          path (the ecliptic). There are two: the North Node and the South Node,
          always exactly opposite each other.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-accent-muted/20 rounded-lg p-4">
            <p className="font-medium mb-2 text-accent-gold">North Node</p>
            <p className="text-sm text-accent-ink/70 mb-2">
              Direction of growth. Qualities you&apos;re learning to develop.
              Unfamiliar territory that stretches you.
            </p>
            <p className="text-sm italic text-accent-ink/60">
              &quot;Where you&apos;re going&quot;
            </p>
          </div>
          <div className="bg-accent-muted/20 rounded-lg p-4">
            <p className="font-medium mb-2 text-accent-gold">South Node</p>
            <p className="text-sm text-accent-ink/70 mb-2">
              Comfort zone. Skills and patterns that come naturally. Can become
              a crutch if overused.
            </p>
            <p className="text-sm italic text-accent-ink/60">
              &quot;Where you&apos;ve been&quot;
            </p>
          </div>
        </div>

        <p className="mb-4">
          <strong>The dynamic:</strong> The South Node represents abilities you
          already have — perhaps from past experiences, perhaps from early life.
          The North Node points toward what you&apos;re meant to develop. Growth
          involves moving toward the North Node while not abandoning the South
          Node&apos;s gifts.
        </p>

        <div className="bg-accent-lavender/20 rounded-lg p-4">
          <p className="font-medium mb-2">Example: North Node in Libra, South Node in Aries</p>
          <ul className="text-sm space-y-1">
            <li>
              <strong>South Node in Aries:</strong> Natural independence,
              self-reliance, quick action. May default to going it alone.
            </li>
            <li>
              <strong>North Node in Libra:</strong> Learning to collaborate,
              consider others&apos; perspectives, build partnerships.
            </li>
            <li>
              <strong>Growth path:</strong> Not abandoning independence, but
              learning when cooperation serves better.
            </li>
          </ul>
        </div>
      </section>

      {/* CHIRON SECTION */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Chiron: The Wounded Healer
        </h2>
        <p className="mb-4">
          In mythology, Chiron was a centaur who was a great healer — but carried
          an incurable wound himself. In astrology, Chiron represents our core
          wound and the wisdom that can emerge from it.
        </p>

        <div className="space-y-4">
          <div className="flex gap-3 items-start">
            <span className="text-accent-gold text-xl">→</span>
            <div>
              <p className="font-medium">What Chiron shows:</p>
              <p className="text-sm text-accent-ink/70">
                An area where you may feel inadequate, hurt, or &quot;broken&quot; in some
                way. A sensitive spot that doesn&apos;t fully heal but becomes a
                source of understanding.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-accent-gold text-xl">→</span>
            <div>
              <p className="font-medium">Chiron&apos;s gift:</p>
              <p className="text-sm text-accent-ink/70">
                Because you&apos;ve struggled with this wound, you may become
                especially helpful to others facing similar challenges. Your
                pain becomes your expertise.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-accent-muted/20 rounded-lg p-4 mt-4">
          <p className="font-medium mb-2">Example: Chiron in the 10th House</p>
          <ul className="text-sm space-y-1 text-accent-ink/70">
            <li>May feel perpetually &quot;not enough&quot; professionally</li>
            <li>Struggles with public recognition or authority</li>
            <li>
              Can become an excellent mentor or coach precisely because they
              understand impostor syndrome
            </li>
          </ul>
        </div>

        <p className="mt-4 text-sm text-accent-ink/70">
          <strong>Important:</strong> Chiron is not a curse. It&apos;s a tender
          place that, when tended with compassion, becomes a source of depth
          and service.
        </p>
      </section>

      {/* LILITH SECTION */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Lilith: The Shadow Voice
        </h2>
        <p className="mb-4">
          &quot;Lilith&quot; in astrology usually refers to Black Moon Lilith — the
          Moon&apos;s apogee (the point where the Moon is farthest from Earth).
          Named after a figure from mythology who refused to submit, Lilith
          represents the parts of ourselves that resist conformity.
        </p>

        <div className="space-y-4">
          <div className="flex gap-3 items-start">
            <span className="text-accent-gold text-xl">→</span>
            <div>
              <p className="font-medium">What Lilith may represent:</p>
              <ul className="text-sm text-accent-ink/70 list-disc pl-4 space-y-1">
                <li>Suppressed or rejected parts of yourself</li>
                <li>Fierce independence and refusal to comply</li>
                <li>Raw sexuality and primal instincts</li>
                <li>Where you may feel exiled or misunderstood</li>
                <li>The power that comes from embracing what society rejects</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-accent-muted/20 rounded-lg p-4 mt-4">
          <p className="font-medium mb-2">Example: Lilith in Gemini</p>
          <p className="text-sm text-accent-ink/70">
            May have felt silenced or that their ideas were &quot;too much.&quot; Can
            reclaim power through speaking uncomfortable truths, writing about
            taboo topics, or embracing unconventional communication styles.
          </p>
        </div>

        <div className="bg-amber-50 rounded-lg p-4 mt-4">
          <p className="font-medium text-amber-800 mb-2">A note on Lilith</p>
          <p className="text-sm text-amber-700">
            Lilith interpretations can veer into sensationalism. It&apos;s not about
            &quot;dark feminine energy&quot; or anything inherently dangerous. Think of
            Lilith as pointing to where you refuse to shrink — and where that
            refusal may have gotten you labeled as &quot;too much.&quot;
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Working With These Points
        </h2>
        <p className="mb-4">
          These sensitive points are not destiny. They describe themes and
          potentials, not fixed outcomes.
        </p>
        <div className="grid gap-3">
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-20">Nodes</span>
            <p className="text-sm text-accent-ink/70">
              Notice when you default to South Node patterns. Consciously choose
              North Node experiences sometimes, even if uncomfortable.
            </p>
          </div>
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-20">Chiron</span>
            <p className="text-sm text-accent-ink/70">
              Practice self-compassion around your Chiron themes. Look for how
              your wound has already made you wiser or more helpful to others.
            </p>
          </div>
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-20">Lilith</span>
            <p className="text-sm text-accent-ink/70">
              Identify where you&apos;ve suppressed parts of yourself. Consider
              whether reclaiming that energy serves your authenticity.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Don&apos;t Overidentify
        </h2>
        <p className="mb-4">
          A common trap with these points is turning them into identity anchors:
          &quot;I&apos;m a Chiron in the 7th person, so relationships will always hurt
          me.&quot;
        </p>
        <p className="mb-4 text-sm text-accent-ink/70">
          This is not how astrology works best. These placements describe
          tendencies and themes, not life sentences. You are not your Chiron
          wound. You are not your Lilith exile. You are a whole person who
          contains these themes among many others.
        </p>
        <p className="text-sm text-accent-ink/70">
          Use these placements for insight, not limitation.
        </p>
      </section>

      <section className="bg-accent-muted/30 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Key Takeaways</h3>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>
            <strong>North Node:</strong> Direction of growth — unfamiliar but
            stretching you
          </li>
          <li>
            <strong>South Node:</strong> Comfort zone — skills you have but may
            overuse
          </li>
          <li>
            <strong>Chiron:</strong> Core wound that becomes wisdom through
            compassion
          </li>
          <li>
            <strong>Lilith:</strong> Suppressed parts seeking reclamation — where
            you refuse to shrink
          </li>
          <li>
            These are themes to explore, not identities to adopt or boxes to trap
            yourself in
          </li>
        </ul>
      </section>

      <section className="bg-accent-lavender/20 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Try This</h3>
        <p className="text-sm mb-3">
          Look up your North Node sign and house placement:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>
            What qualities does this sign represent? Do they feel unfamiliar or
            aspirational?
          </li>
          <li>
            Think of a time you stretched toward those qualities. How did it
            feel?
          </li>
          <li>
            What&apos;s one small North Node action you could take this week?
          </li>
        </ul>
      </section>

      <section className="border-l-4 border-accent-gold/50 pl-4">
        <h3 className="font-semibold mb-3">Common Misconceptions</h3>
        <ul className="space-y-3 text-sm">
          <li>
            <strong>&quot;The South Node is bad and should be avoided.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              No — the South Node represents real skills and gifts. The issue is
              over-reliance, not the qualities themselves. Integration, not
              rejection.
            </span>
          </li>
          <li>
            <strong>&quot;Chiron means you&apos;ll always suffer in that area.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              Chiron shows a sensitive area, but sensitivity doesn&apos;t mean
              permanent suffering. Many people with strong Chiron placements do
              profound healing work precisely because of their wound.
            </span>
          </li>
          <li>
            <strong>&quot;Lilith is dark/dangerous/sexual energy.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              Lilith&apos;s energy is about autonomy and the parts of self that
              resist control. It can relate to sexuality, but also to any area
              where you&apos;ve been shamed for not fitting the mold.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
