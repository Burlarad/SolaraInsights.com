export function GuideBigThree() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold mb-4">What Are the Big Three?</h2>
        <p className="mb-4">
          Your &quot;Big Three&quot; are the three most important placements in your
          birth chart. They form the core of who you are astrologically:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Sun Sign</strong> — Your identity direction
          </li>
          <li>
            <strong>Moon Sign</strong> — Your emotional needs
          </li>
          <li>
            <strong>Rising Sign</strong> — Your first impression
          </li>
        </ul>
        <p className="mt-4">
          When someone asks &quot;What&apos;s your sign?&quot; they&apos;re usually asking about
          your Sun. But the Moon and Rising are just as important.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Sun Sign: Your Core Self</h2>
        <p className="mb-4">
          The Sun represents your <strong>conscious identity</strong> — who you
          are becoming, your sense of purpose, and what energizes you.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Where you want to shine</li>
          <li>What makes you feel alive</li>
          <li>Your ego and willpower</li>
          <li>Life direction and purpose</li>
        </ul>
        <p className="mt-4 text-sm text-accent-ink/70">
          The Sun sign is determined by your birth date. It moves through one
          sign roughly every 30 days.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Moon Sign: Your Inner World
        </h2>
        <p className="mb-4">
          The Moon represents your <strong>emotional nature</strong> — how you
          feel, what you need to feel safe, and your instinctive reactions.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>What you need to feel secure</li>
          <li>How you process emotions</li>
          <li>Your comfort zone and habits</li>
          <li>What &quot;home&quot; feels like to you</li>
        </ul>
        <p className="mt-4 text-sm text-accent-ink/70">
          The Moon changes signs every 2–3 days, so you need your birth time for
          accuracy.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Rising Sign: Your Outer Layer
        </h2>
        <p className="mb-4">
          The Rising (or Ascendant) is the sign that was rising on the eastern
          horizon at your birth. It represents your{" "}
          <strong>approach to life</strong> and how others perceive you.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>First impressions you give</li>
          <li>How you start things</li>
          <li>Your physical presence and style</li>
          <li>The &quot;mask&quot; you wear in new situations</li>
        </ul>
        <p className="mt-4 text-sm text-accent-ink/70">
          The Rising changes signs every 2 hours, so accurate birth time is
          essential.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Same Sun, Different Experience
        </h2>
        <p className="mb-4">
          Two people with the same Sun sign can feel very different because of
          their Moon and Rising. For example:
        </p>
        <div className="space-y-4">
          <div className="bg-accent-muted/20 rounded-lg p-4">
            <p className="font-medium">Leo Sun, Cancer Moon, Virgo Rising</p>
            <p className="text-sm text-accent-ink/70 mt-1">
              Wants to shine (Leo) but needs emotional safety first (Cancer).
              Appears reserved and analytical (Virgo) until comfortable.
            </p>
          </div>
          <div className="bg-accent-muted/20 rounded-lg p-4">
            <p className="font-medium">Leo Sun, Aries Moon, Sagittarius Rising</p>
            <p className="text-sm text-accent-ink/70 mt-1">
              Wants to shine (Leo) and feels emotionally driven by action
              (Aries). Appears adventurous and optimistic (Sagittarius)
              immediately.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-accent-muted/30 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Key Takeaways</h3>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>
            Sun = who you&apos;re becoming | Moon = what you need | Rising = how
            you approach
          </li>
          <li>
            The Big Three work together — no single sign defines you
          </li>
          <li>
            Birth time matters: Moon and Rising require it for accuracy
          </li>
        </ul>
      </section>

      <section className="bg-accent-lavender/20 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Try This</h3>
        <p className="text-sm mb-3">
          Write one sentence for each of your Big Three:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>
            &quot;My Sun in [sign] means I feel most alive when...&quot;
          </li>
          <li>
            &quot;My Moon in [sign] means I need... to feel safe.&quot;
          </li>
          <li>
            &quot;My Rising in [sign] means people first see me as...&quot;
          </li>
        </ul>
      </section>

      <section className="border-l-4 border-accent-gold/50 pl-4">
        <h3 className="font-semibold mb-3">Common Misconceptions</h3>
        <ul className="space-y-3 text-sm">
          <li>
            <strong>&quot;My Sun sign describes everything about me.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              The Sun is important but it&apos;s one of 10+ placements. Moon and
              Rising add crucial nuance.
            </span>
          </li>
          <li>
            <strong>&quot;Rising sign is just how I look.&quot;</strong>
            <br />
            <span className="text-accent-ink/70">
              It&apos;s more than appearance — it&apos;s your instinctive approach to
              new situations and how you initiate action.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
