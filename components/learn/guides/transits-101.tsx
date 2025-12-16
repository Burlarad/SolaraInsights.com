export function GuideTransits101() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold mb-4">What is a Transit?</h2>
        <p className="mb-4">
          A transit happens when a planet in the current sky forms an angle to a
          planet or point in your birth chart. Your natal chart is fixed — it&apos;s
          a snapshot of the sky when you were born. But the planets keep moving,
          and as they do, they activate different parts of your chart.
        </p>
        <p className="mb-4">
          Think of your birth chart as a stage. Transits are the lighting
          changes — they don&apos;t alter the stage itself, but they illuminate
          different areas at different times.
        </p>
        <div className="bg-accent-muted/20 rounded-lg p-4">
          <p className="text-sm text-accent-ink/70">
            <strong>Example:</strong> If you have your natal Moon at 15° Cancer,
            and Saturn is currently at 15° Capricorn, Saturn is making an
            opposition transit to your Moon. This might coincide with a period
            of emotional heaviness or increased responsibility around home/family.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Why Birth Time Accuracy Matters
        </h2>
        <p className="mb-4">
          The houses and angles in your chart (Ascendant, Midheaven, etc.) change
          roughly every 4 minutes. If your birth time is off by 30 minutes, your
          house placements could be significantly different.
        </p>
        <p className="mb-4">
          This matters for transits because:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Transits to angles (ASC, MC, IC, DSC) are among the most noticeable
          </li>
          <li>
            House transits determine which life area is activated
          </li>
          <li>
            Without accurate birth time, stick to transits to your natal planets
            (which don&apos;t depend on houses)
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Slow vs Fast Transits</h2>
        <p className="mb-4">
          Not all transits carry equal weight. The speed of the transiting planet
          determines how long you&apos;ll feel its influence.
        </p>

        <div className="space-y-4">
          <div className="bg-accent-muted/20 rounded-lg p-4">
            <p className="font-medium mb-2">Fast Transits (days to weeks)</p>
            <p className="text-sm text-accent-ink/70 mb-2">
              Moon, Mercury, Venus, Sun, Mars
            </p>
            <p className="text-sm text-accent-ink/70">
              These create day-to-day mood shifts and minor events. The Moon
              moves through a sign every 2.5 days. Mercury takes about 3 weeks
              per sign. These transits are fleeting — don&apos;t over-analyze them.
            </p>
          </div>

          <div className="bg-accent-muted/20 rounded-lg p-4">
            <p className="font-medium mb-2">Medium Transits (months)</p>
            <p className="text-sm text-accent-ink/70 mb-2">Jupiter, Saturn</p>
            <p className="text-sm text-accent-ink/70">
              Jupiter spends about a year in each sign. Saturn takes 2-3 years.
              These bring noticeable themes and life chapters. A Saturn transit
              to your Sun might span several months and mark a period of increased
              responsibility.
            </p>
          </div>

          <div className="bg-accent-muted/20 rounded-lg p-4">
            <p className="font-medium mb-2">Slow Transits (years)</p>
            <p className="text-sm text-accent-ink/70 mb-2">
              Uranus, Neptune, Pluto
            </p>
            <p className="text-sm text-accent-ink/70">
              These planets move so slowly that their transits define entire life
              periods. Uranus takes 7 years per sign. Neptune and Pluto even
              longer. When they aspect your natal planets, expect gradual but
              profound shifts.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">
          The Main Transit Aspects
        </h2>
        <p className="mb-4">
          The angle between the transiting planet and your natal point determines
          the type of energy:
        </p>
        <div className="grid gap-3">
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-24">Conjunction</span>
            <div className="text-sm text-accent-ink/70">
              0° — Intensification. The transit planet merges with your natal
              point, amplifying both energies.
            </div>
          </div>
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-24">Square</span>
            <div className="text-sm text-accent-ink/70">
              90° — Friction and growth. Challenges that push you to act or
              change. Uncomfortable but productive.
            </div>
          </div>
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-24">Opposition</span>
            <div className="text-sm text-accent-ink/70">
              180° — Awareness through contrast. Often involves other people or
              external events reflecting something back to you.
            </div>
          </div>
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-24">Trine</span>
            <div className="text-sm text-accent-ink/70">
              120° — Flow and ease. Opportunities that feel natural. Can be so
              smooth you miss them if you&apos;re not paying attention.
            </div>
          </div>
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-24">Sextile</span>
            <div className="text-sm text-accent-ink/70">
              60° — Gentle opportunities. Requires some effort to activate but
              generally supportive.
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Using Transits for Planning (Not Dependency)
        </h2>
        <p className="mb-4">
          Transits are best used as context, not commands. They describe the
          weather, not your destiny.
        </p>
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <span className="text-green-600 font-bold">Do:</span>
            <ul className="list-disc pl-4 space-y-1 text-sm">
              <li>Note when major transits are active so you can be patient with yourself</li>
              <li>Plan important launches/events during supportive transits if possible</li>
              <li>Use challenging transits as cues to slow down or reflect</li>
            </ul>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-red-600 font-bold">Don&apos;t:</span>
            <ul className="list-disc pl-4 space-y-1 text-sm">
              <li>Refuse to act because a transit looks &quot;bad&quot;</li>
              <li>Blame transits for choices you made</li>
              <li>Check transits daily and let them dictate your mood</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Example: Saturn Transiting Your 10th House</h2>
        <p className="mb-4">
          Saturn spends about 2-3 years in each house. When it moves through your
          10th house (career, public reputation), you might experience:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Increased pressure or scrutiny at work</li>
          <li>A desire to take your career more seriously</li>
          <li>Delays or obstacles that ultimately build resilience</li>
          <li>Recognition that comes slowly but feels earned</li>
        </ul>
        <p className="mt-4 text-sm text-accent-ink/70">
          This doesn&apos;t mean everyone with this transit has a hard time — it means
          the themes of hard work, structure, and accountability become prominent
          in your professional life.
        </p>
      </section>

      <section className="bg-accent-muted/30 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Key Takeaways</h3>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>
            Transits are current planets activating your birth chart — the sky
            talking to your natal blueprint
          </li>
          <li>
            Slow transits (Saturn, Uranus, Neptune, Pluto) define life chapters;
            fast transits (Moon, Mercury) create daily ripples
          </li>
          <li>
            Birth time accuracy matters most for house and angle transits
          </li>
          <li>
            Use transits as context for self-understanding, not as excuses or
            rigid predictions
          </li>
        </ul>
      </section>

      <section className="bg-accent-lavender/20 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Try This</h3>
        <p className="text-sm mb-3">
          Look up where Saturn is currently transiting in your chart:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Which house is Saturn moving through?</li>
          <li>What themes from that house have felt prominent lately?</li>
          <li>
            Write down one way you&apos;ve been building something slowly in that
            area — even if it feels frustrating.
          </li>
        </ul>
      </section>

      <section className="border-l-4 border-accent-gold/50 pl-4">
        <h3 className="font-semibold mb-3">Common Misconceptions</h3>
        <ul className="space-y-3 text-sm">
          <li>
            <strong>&quot;Bad transits mean bad things will happen.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              Challenging transits (squares, oppositions) often correlate with
              growth, not disaster. They push you out of comfort zones.
            </span>
          </li>
          <li>
            <strong>&quot;I should wait for the perfect transit to act.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              There&apos;s no perfect time. Transits provide context, but your
              decisions and effort matter more than any planetary alignment.
            </span>
          </li>
          <li>
            <strong>&quot;Transits affect everyone the same way.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              How a transit lands depends on your natal chart, current life
              circumstances, and how you respond. The same transit can manifest
              very differently for different people.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
