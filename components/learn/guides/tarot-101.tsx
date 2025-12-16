export function GuideTarot101() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold mb-4">What is Tarot?</h2>
        <p className="mb-4">
          Tarot is a tool for reflection, not fortune-telling. The 78 cards act
          as mirrors, helping you see situations from new angles and access
          your own intuition.
        </p>
        <p className="text-sm text-accent-ink/70">
          The cards don&apos;t predict fixed futures — they illuminate patterns,
          possibilities, and blind spots you might not see on your own.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">The Deck Structure</h2>
        <p className="mb-4">A standard tarot deck has 78 cards in two groups:</p>

        <div className="space-y-4">
          <div className="bg-accent-muted/20 rounded-lg p-4">
            <p className="font-medium mb-2">Major Arcana (22 cards)</p>
            <p className="text-sm text-accent-ink/70">
              Big life themes and spiritual lessons — The Fool, The Tower, The
              Star, etc. When these appear, pay attention. They point to
              significant turning points or deep psychological processes.
            </p>
          </div>

          <div className="bg-accent-muted/20 rounded-lg p-4">
            <p className="font-medium mb-2">Minor Arcana (56 cards)</p>
            <p className="text-sm text-accent-ink/70 mb-2">
              Day-to-day experiences across four suits:
            </p>
            <ul className="text-sm text-accent-ink/70 list-disc pl-6 space-y-1">
              <li>
                <strong>Wands</strong> — action, passion, creativity, willpower
              </li>
              <li>
                <strong>Cups</strong> — emotions, relationships, intuition
              </li>
              <li>
                <strong>Swords</strong> — thought, conflict, truth, decisions
              </li>
              <li>
                <strong>Pentacles</strong> — material world, money, health, work
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">How Spreads Work</h2>
        <p className="mb-4">
          A spread is a layout where each position has a meaning. The position
          gives context to the card that lands there.
        </p>
        <div className="grid gap-3">
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-24">Single Card</span>
            <p className="text-sm text-accent-ink/70">
              Quick daily insight or answer. Good for simple questions.
            </p>
          </div>
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-24">Three Card</span>
            <p className="text-sm text-accent-ink/70">
              Past/present/future or situation/challenge/advice. Versatile and
              readable.
            </p>
          </div>
          <div className="flex gap-4 p-3 bg-accent-muted/20 rounded-lg">
            <span className="font-bold text-accent-gold w-24">Celtic Cross</span>
            <p className="text-sm text-accent-ink/70">
              10-card comprehensive reading for complex questions. Takes
              practice.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Asking Good Questions</h2>
        <p className="mb-4">
          The best tarot questions are open-ended. They invite exploration
          rather than demanding yes/no answers.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-lg p-4">
            <p className="font-medium text-red-700 mb-2">Avoid</p>
            <ul className="text-sm text-red-600 space-y-1">
              <li>&quot;Will I get the job?&quot;</li>
              <li>&quot;Does he love me?&quot;</li>
              <li>&quot;When will X happen?&quot;</li>
            </ul>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="font-medium text-green-700 mb-2">Try</p>
            <ul className="text-sm text-green-600 space-y-1">
              <li>&quot;What do I need to know about this opportunity?&quot;</li>
              <li>&quot;What&apos;s blocking connection in this relationship?&quot;</li>
              <li>&quot;How can I move forward with X?&quot;</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Reading Reversals</h2>
        <p className="mb-4">
          When a card appears upside-down, it&apos;s called a &quot;reversal.&quot; There
          are several ways to interpret them:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>
            <strong>Blocked energy</strong> — the card&apos;s meaning is present but
            stuck or frustrated
          </li>
          <li>
            <strong>Internal expression</strong> — the energy is turned inward
            rather than outward
          </li>
          <li>
            <strong>Lessened intensity</strong> — a softer or weaker version of
            the upright meaning
          </li>
          <li>
            <strong>Shadow side</strong> — the unhealthy extreme of the card&apos;s
            energy
          </li>
        </ul>
        <p className="mt-4 text-sm text-accent-ink/70">
          Some readers don&apos;t use reversals at all. Find what works for you.
        </p>
      </section>

      <section className="bg-accent-muted/30 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Key Takeaways</h3>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>
            Tarot reflects, it doesn&apos;t predict — use it for clarity, not
            certainty
          </li>
          <li>
            Major Arcana = big themes; Minor Arcana = everyday situations
          </li>
          <li>
            Open-ended questions get more useful answers than yes/no questions
          </li>
          <li>
            Your intuitive response to a card matters more than memorized
            meanings
          </li>
        </ul>
      </section>

      <section className="bg-accent-lavender/20 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Try This</h3>
        <p className="text-sm mb-3">
          Pull a single card with this question:
        </p>
        <p className="text-sm italic mb-4">
          &quot;What do I need to pay attention to today?&quot;
        </p>
        <p className="text-sm text-accent-ink/70">
          Don&apos;t look up the meaning immediately. First, notice: What catches
          your eye in the image? What feeling does the card give you? Then
          check the meaning and see how your intuition compares.
        </p>
      </section>

      <section className="border-l-4 border-accent-gold/50 pl-4">
        <h3 className="font-semibold mb-3">Common Misconceptions</h3>
        <ul className="space-y-3 text-sm">
          <li>
            <strong>&quot;Tarot predicts the future.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              Tarot shows possibilities based on current patterns. The future
              isn&apos;t fixed — your choices shape it.
            </span>
          </li>
          <li>
            <strong>&quot;The Death card means someone will die.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              Death almost always represents transformation, endings that lead
              to new beginnings, or necessary change. It&apos;s rarely literal.
            </span>
          </li>
          <li>
            <strong>&quot;You need psychic abilities to read tarot.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              Tarot is a skill anyone can learn. It develops your intuition over
              time, but you don&apos;t need special powers to start.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
