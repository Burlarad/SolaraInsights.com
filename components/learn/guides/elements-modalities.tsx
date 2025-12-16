export function GuideElementsModalities() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Why Signs Behave Differently
        </h2>
        <p className="mb-4">
          Ever wonder why some signs seem similar but act so differently? The
          answer lies in two systems that divide the zodiac:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Elements</strong> — Fire, Earth, Air, Water (energy type)
          </li>
          <li>
            <strong>Modalities</strong> — Cardinal, Fixed, Mutable (energy
            style)
          </li>
        </ul>
        <p className="mt-4">
          Every sign has one element and one modality. This combination explains
          a lot about how signs operate.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">The Four Elements</h2>

        <div className="space-y-4">
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="font-semibold text-red-800">
              Fire: Aries, Leo, Sagittarius
            </h3>
            <p className="text-sm mt-2">
              Passionate, energetic, action-oriented. Fire signs tend to be
              enthusiastic and direct. They initiate, inspire, and sometimes
              burn hot then cool quickly.
            </p>
            <p className="text-xs text-red-700 mt-2">
              Keywords: enthusiasm, courage, impulse, inspiration
            </p>
          </div>

          <div className="bg-amber-50 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800">
              Earth: Taurus, Virgo, Capricorn
            </h3>
            <p className="text-sm mt-2">
              Practical, grounded, security-focused. Earth signs tend to build
              tangible results. They value stability, patience, and real-world
              outcomes.
            </p>
            <p className="text-xs text-amber-700 mt-2">
              Keywords: stability, practicality, persistence, material
            </p>
          </div>

          <div className="bg-sky-50 rounded-lg p-4">
            <h3 className="font-semibold text-sky-800">
              Air: Gemini, Libra, Aquarius
            </h3>
            <p className="text-sm mt-2">
              Intellectual, social, idea-oriented. Air signs tend to analyze,
              communicate, and connect. They value fairness, concepts, and
              mental stimulation.
            </p>
            <p className="text-xs text-sky-700 mt-2">
              Keywords: communication, ideas, objectivity, connection
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800">
              Water: Cancer, Scorpio, Pisces
            </h3>
            <p className="text-sm mt-2">
              Emotional, intuitive, depth-seeking. Water signs tend to feel
              deeply and pick up on undercurrents. They value emotional truth
              and meaningful bonds.
            </p>
            <p className="text-xs text-blue-700 mt-2">
              Keywords: emotion, intuition, depth, sensitivity
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">The Three Modalities</h2>

        <div className="space-y-4">
          <div className="border-l-4 border-accent-gold pl-4">
            <h3 className="font-semibold">
              Cardinal: Aries, Cancer, Libra, Capricorn
            </h3>
            <p className="text-sm mt-2">
              Initiators. Cardinal signs start things, lead, and set direction.
              They&apos;re action-oriented but may struggle with follow-through.
            </p>
            <p className="text-xs text-accent-ink/70 mt-2">
              Season starters: each begins a new season (spring, summer, fall,
              winter)
            </p>
          </div>

          <div className="border-l-4 border-accent-ink/40 pl-4">
            <h3 className="font-semibold">
              Fixed: Taurus, Leo, Scorpio, Aquarius
            </h3>
            <p className="text-sm mt-2">
              Sustainers. Fixed signs dig in, persist, and stabilize. They&apos;re
              reliable but may resist change even when needed.
            </p>
            <p className="text-xs text-accent-ink/70 mt-2">
              Season peaks: each occurs at the height of a season
            </p>
          </div>

          <div className="border-l-4 border-accent-lavender pl-4">
            <h3 className="font-semibold">
              Mutable: Gemini, Virgo, Sagittarius, Pisces
            </h3>
            <p className="text-sm mt-2">
              Adapters. Mutable signs adjust, transition, and remain flexible.
              They&apos;re versatile but may lack consistency.
            </p>
            <p className="text-xs text-accent-ink/70 mt-2">
              Season endings: each concludes a season and prepares for the next
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">
          How Element + Modality Combine
        </h2>
        <p className="mb-4">
          Each sign has a unique element-modality combination. This explains why
          two Fire signs (like Aries and Leo) feel different:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Sign</th>
                <th className="text-left py-2">Element</th>
                <th className="text-left py-2">Modality</th>
                <th className="text-left py-2">Expression</th>
              </tr>
            </thead>
            <tbody className="text-accent-ink/80">
              <tr className="border-b">
                <td className="py-2">Aries</td>
                <td>Fire</td>
                <td>Cardinal</td>
                <td>Initiates with passion</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Leo</td>
                <td>Fire</td>
                <td>Fixed</td>
                <td>Sustains with passion</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Sagittarius</td>
                <td>Fire</td>
                <td>Mutable</td>
                <td>Adapts with passion</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-accent-ink/70">
          Same fire energy, but Aries starts fires, Leo maintains them, and
          Sagittarius spreads them around.
        </p>
      </section>

      <section className="bg-accent-muted/30 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Key Takeaways</h3>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>
            Elements show what kind of energy (Fire, Earth, Air, Water)
          </li>
          <li>
            Modalities show how that energy moves (Cardinal, Fixed, Mutable)
          </li>
          <li>
            Every sign has one element + one modality = unique combo
          </li>
        </ul>
      </section>

      <section className="bg-accent-lavender/20 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Try This</h3>
        <p className="text-sm mb-3">
          Look at your Big Three (Sun, Moon, Rising) and identify:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>What elements are dominant? Are you missing any?</li>
          <li>What modalities show up? Are you mostly Cardinal, Fixed, or Mutable?</li>
        </ul>
        <p className="text-sm mt-3">
          Example: Someone with Sun in Aries, Moon in Scorpio, Rising in Leo has
          lots of Fire + Fixed energy but no Air or Mutable.
        </p>
      </section>

      <section className="border-l-4 border-accent-gold/50 pl-4">
        <h3 className="font-semibold mb-3">Common Misconceptions</h3>
        <ul className="space-y-3 text-sm">
          <li>
            <strong>&quot;Fire signs are always angry.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              Fire is about enthusiasm and action, not just anger. It can be
              joyful, creative, or driven.
            </span>
          </li>
          <li>
            <strong>&quot;Fixed signs never change.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              Fixed signs do change — they just need more time and a compelling
              reason. Their strength is persistence, not rigidity.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
