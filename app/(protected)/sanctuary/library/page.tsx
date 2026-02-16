"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { PlacePicker, type PlaceSelection } from "@/components/shared/PlacePicker";
import { useSettings } from "@/providers/SettingsProvider";
import type { NumerologySystem, CycleNumbers } from "@/types/numerology";
import type { FullBirthChartInsight } from "@/types/natalAI";

// ============================================================================
// TYPES
// ============================================================================

type LibraryTab = "astrology" | "numerology" | "recent";

type ShelfEntry = {
  book_key: string;
  book_type?: string;
  label: string | null;
  last_opened_at: string;
  created_at: string;
};

// Astrology response from /api/birth-chart-library
type AstrologyBookResponse = {
  placements: any;
  insight: FullBirthChartInsight | null;
  chart_key: string;
  is_official: boolean;
  mode: string;
};

// Numerology types
type NumerologyNarrativeSection = { heading: string; body: string };
type NumerologyNarrative = { sections: NumerologyNarrativeSection[] };
type NumerologyNumber = { value: number; master?: number };
type CoreNumbers = {
  lifePath: NumerologyNumber;
  birthday: NumerologyNumber;
  expression: NumerologyNumber;
  soulUrge: NumerologyNumber;
  personality: NumerologyNumber;
  maturity: NumerologyNumber;
};
type Pinnacles = {
  first: { number: number; startAge: number; endAge: number };
  second: { number: number; startAge: number; endAge: number };
  third: { number: number; startAge: number; endAge: number };
  fourth: { number: number; startAge: number; endAge: null };
};
type NumerologyComputeResult = {
  coreNumbers: CoreNumbers;
  pinnacles: Pinnacles;
  challenges: { first: number; second: number; third: number; fourth: number };
  luckyNumbers: { primary: number; secondary: number[]; all: number[] };
  karmicDebt: { hasKarmicDebt: boolean; numbers: number[] };
};

type NumerologyBookResponse = {
  numerology: NumerologyComputeResult;
  narrative: NumerologyNarrative | null;
  cycles: CycleNumbers;
  numerology_key: string;
  input: { first_name: string; middle_name?: string; last_name: string; birth_date: string };
  is_official: boolean;
  mode: string;
  system: string;
};

// Unified recent entry (from library_checkouts)
type RecentEntry = ShelfEntry & { book_type: string };

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryTab>("astrology");

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="flex justify-center items-center pt-4 pb-8">
        <SolaraLogo />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-accent-ink/70">
          Your personal collection of astrology and numerology books.
        </p>
      </div>

      <div className="flex justify-center">
        <SanctuaryTabs />
      </div>

      {/* Library sub-tabs */}
      <div className="flex justify-center">
        <div className="inline-flex gap-1 p-1 bg-white/50 rounded-full">
          {(["astrology", "numerology", "recent"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-accent-ink text-white"
                  : "text-accent-ink hover:bg-white/80"
              }`}
            >
              {tab === "recent" ? "Recent Books" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "astrology" && <AstrologyTab />}
      {activeTab === "numerology" && <NumerologyTab />}
      {activeTab === "recent" && <RecentBooksTab />}
    </div>
  );
}

// ============================================================================
// ASTROLOGY TAB
// ============================================================================

function AstrologyTab() {
  const { profile } = useSettings();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<AstrologyBookResponse | null>(null);
  const [missingBirthTime, setMissingBirthTime] = useState(false);

  // Checkout form
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutDate, setCheckoutDate] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("");
  const [checkoutPlace, setCheckoutPlace] = useState<PlaceSelection | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Always load official on mount
  useEffect(() => {
    loadOfficial();
  }, []);

  async function loadOfficial() {
    setLoading(true);
    setError(null);
    setMissingBirthTime(false);

    try {
      const res = await fetch("/api/birth-chart-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "official" }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.errorCode === "INCOMPLETE_BIRTH_DATA") {
          setMissingBirthTime(true);
          setLoading(false);
          return;
        }
        setError(data.message || "Failed to load official chart.");
        setLoading(false);
        return;
      }

      setBook(data);
    } catch {
      setError("Failed to load astrology chart. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    if (!checkoutDate || !checkoutTime || !checkoutPlace) return;
    setCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/birth-chart-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "checkout",
          inputs: {
            birth_date: checkoutDate,
            birth_time: checkoutTime,
            birth_lat: checkoutPlace.birth_lat,
            birth_lon: checkoutPlace.birth_lon,
            timezone: checkoutPlace.timezone,
          },
          birth_city: checkoutPlace.birth_city || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to generate chart.");
        return;
      }

      setBook(data);
      setShowCheckout(false);
      setCheckoutDate("");
      setCheckoutTime("");
      setCheckoutPlace(null);
    } catch {
      setError("Failed to generate chart. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading astrology chart..." />;
  }

  if (missingBirthTime) {
    return (
      <div className="space-y-6">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-12 text-center space-y-4">
            <h2 className="text-xl font-semibold text-accent-ink">Birth Time Required</h2>
            <p className="text-accent-ink/70 max-w-md mx-auto">
              Your official astrology book requires an accurate birth time. Please add your birth time in Settings, or use the checkout form below to generate a chart with manual inputs.
            </p>
            <Button variant="gold" asChild>
              <a href="/settings">Go to Settings</a>
            </Button>
          </CardContent>
        </Card>
        <CheckoutButton show={showCheckout} onToggle={() => setShowCheckout(!showCheckout)} />
        {showCheckout && (
          <AstrologyCheckoutForm
            date={checkoutDate}
            time={checkoutTime}
            place={checkoutPlace}
            loading={checkoutLoading}
            onDateChange={setCheckoutDate}
            onTimeChange={setCheckoutTime}
            onPlaceChange={setCheckoutPlace}
            onSubmit={handleCheckout}
          />
        )}
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="space-y-4">
        <Card className="border-danger-soft/20">
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-accent-ink/70">{error || "Failed to load astrology chart."}</p>
            <Button variant="outline" onClick={loadOfficial}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const insight = book.insight;

  return (
    <div className="space-y-6">
      {/* Official badge */}
      {book.is_official && (
        <div className="flex items-center gap-2">
          <span className="inline-block px-3 py-1 bg-accent-gold/10 text-accent-gold text-xs font-medium rounded-full">
            Official Book
          </span>
        </div>
      )}
      {!book.is_official && (
        <div className="flex items-center gap-2">
          <span className="inline-block px-3 py-1 bg-accent-ink/5 text-accent-ink/60 text-xs font-medium rounded-full">
            Checkout
          </span>
          <Button variant="outline" size="sm" onClick={loadOfficial}>
            Return to Official
          </Button>
        </div>
      )}

      {/* Narrative content */}
      {insight && (
        <div className="space-y-6">
          {insight.coreSummary?.headline && (
            <h2 className="text-xl font-semibold text-accent-gold">{insight.coreSummary.headline}</h2>
          )}
          {insight.coreSummary?.overallVibe && (
            <div className="prose prose-sm max-w-none text-accent-ink/85 leading-relaxed">
              {insight.coreSummary.overallVibe.split("\n\n").map((p, i) => (
                <p key={i} className="mb-4 last:mb-0">{p}</p>
              ))}
            </div>
          )}
          {insight.coreSummary?.bigThree && (
            <div className="space-y-4">
              {Object.entries(insight.coreSummary.bigThree).map(([key, text]) => (
                <div key={key}>
                  <h3 className="text-base font-semibold text-accent-ink/80 mb-2 capitalize">{key}</h3>
                  <div className="prose prose-sm max-w-none text-accent-ink/80 leading-relaxed">
                    {String(text).split("\n\n").map((p, i) => (
                      <p key={i} className="mb-3 last:mb-0">{p}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!insight && (
        <Card className="bg-white/50">
          <CardContent className="py-8 text-center">
            <p className="text-accent-ink/60">
              Narrative is being generated. This may take a moment on first load.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Checkout section */}
      <CheckoutButton show={showCheckout} onToggle={() => setShowCheckout(!showCheckout)} />
      {showCheckout && (
        <AstrologyCheckoutForm
          date={checkoutDate}
          time={checkoutTime}
          place={checkoutPlace}
          loading={checkoutLoading}
          onDateChange={setCheckoutDate}
          onTimeChange={setCheckoutTime}
          onPlaceChange={setCheckoutPlace}
          onSubmit={handleCheckout}
        />
      )}
    </div>
  );
}

// ============================================================================
// NUMEROLOGY TAB
// ============================================================================

function NumerologyTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<NumerologyBookResponse | null>(null);
  const [system, setSystem] = useState<NumerologySystem>("pythagorean");
  const [appendixOpen, setAppendixOpen] = useState(false);

  // Checkout form
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutDate, setCheckoutDate] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Always load official on mount (and when system changes)
  useEffect(() => {
    loadOfficial();
  }, [system]);

  async function loadOfficial() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/numerology-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "official", system }),
      });
      const data = await res.json();

      if (!res.ok) {
        const code = data?.errorCode;
        if (code === "MISSING_NAME") {
          setError("Name is required. Please add your name in Settings.");
        } else if (code === "MISSING_BIRTH_DATE") {
          setError("Birth date is required. Please add your birth date in Settings.");
        } else {
          setError(data.message || "Failed to load numerology.");
        }
        setLoading(false);
        return;
      }

      setBook(data);
    } catch {
      setError("Failed to load numerology. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    if (!checkoutName.trim() || !checkoutDate) return;
    setCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/numerology-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "checkout",
          system,
          input: { full_name: checkoutName.trim(), birth_date: checkoutDate },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to generate numerology.");
        return;
      }

      setBook(data);
      setShowCheckout(false);
      setCheckoutName("");
      setCheckoutDate("");
    } catch {
      setError("Failed to generate numerology. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading numerology..." />;
  }

  if (error || !book) {
    return (
      <div className="space-y-4">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-accent-ink/70">{error || "Failed to load numerology."}</p>
            {error?.includes("Settings") ? (
              <Button variant="gold" asChild>
                <a href="/settings">Go to Settings</a>
              </Button>
            ) : (
              <Button variant="outline" onClick={loadOfficial}>
                Try Again
              </Button>
            )}
          </CardContent>
        </Card>
        <CheckoutButton show={showCheckout} onToggle={() => setShowCheckout(!showCheckout)} label="Checkout a Numerology Book" />
        {showCheckout && (
          <NumerologyCheckoutForm
            name={checkoutName}
            date={checkoutDate}
            loading={checkoutLoading}
            onNameChange={setCheckoutName}
            onDateChange={setCheckoutDate}
            onSubmit={handleCheckout}
          />
        )}
      </div>
    );
  }

  const { numerology, narrative, cycles } = book;

  return (
    <div className="space-y-6">
      {/* Official / Checkout badge */}
      {book.is_official && (
        <div className="flex items-center gap-2">
          <span className="inline-block px-3 py-1 bg-accent-gold/10 text-accent-gold text-xs font-medium rounded-full">
            Official Book
          </span>
        </div>
      )}
      {!book.is_official && (
        <div className="flex items-center gap-2">
          <span className="inline-block px-3 py-1 bg-accent-ink/5 text-accent-ink/60 text-xs font-medium rounded-full">
            Checkout
          </span>
          <Button variant="outline" size="sm" onClick={loadOfficial}>
            Return to Official
          </Button>
        </div>
      )}

      {/* System toggle */}
      <div className="flex justify-center">
        <div className="flex gap-2 p-1 bg-white/50 rounded-full">
          {(["pythagorean", "chaldean"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSystem(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                system === s ? "bg-accent-ink text-white" : "text-accent-ink hover:bg-white/80"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Narrative (MAIN content at top) */}
      {narrative && narrative.sections && narrative.sections.length > 0 && (
        <section className="space-y-6">
          {narrative.sections.map((section, i) => (
            <div key={i} className="space-y-3">
              <h2 className="text-lg font-semibold text-accent-gold">{section.heading}</h2>
              <div className="prose prose-sm max-w-none text-accent-ink/85 leading-relaxed">
                {section.body.split("\n\n").map((paragraph, j) => (
                  <p key={j} className="mb-4 last:mb-0">{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {!narrative && (
        <Card className="bg-white/50">
          <CardContent className="py-8 text-center">
            <p className="text-accent-ink/60">
              Narrative is being generated. This may take a moment on first load.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cycles */}
      {cycles && (
        <section>
          <h2 className="text-lg font-semibold text-accent-gold mb-4">Personal Cycles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { label: "Personal Year", value: cycles.personalYear },
              { label: "Personal Month", value: cycles.personalMonth },
              { label: "Personal Day", value: cycles.personalDay },
            ] as const).map((cycle) => (
              <Card key={cycle.label} className="bg-white border-border-subtle">
                <CardContent className="p-5">
                  <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">{cycle.label}</p>
                  <p className="text-3xl font-bold text-accent-gold">{cycle.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Appendix (collapsible numbers) */}
      <section>
        <button
          onClick={() => setAppendixOpen(!appendixOpen)}
          className="flex items-center gap-2 text-lg font-semibold text-accent-gold mb-4 hover:opacity-80 transition-opacity"
        >
          <span className={`transition-transform ${appendixOpen ? "rotate-90" : ""}`}>&#9654;</span>
          Numbers &amp; Meanings
        </button>
        {appendixOpen && (
          <div className="space-y-6">
            {/* Core Numbers */}
            <div>
              <h3 className="text-base font-semibold text-accent-ink/80 mb-3">Core Numbers</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {([
                  ["Life Path", numerology.coreNumbers.lifePath],
                  ["Expression", numerology.coreNumbers.expression],
                  ["Soul Urge", numerology.coreNumbers.soulUrge],
                  ["Personality", numerology.coreNumbers.personality],
                  ["Birthday", numerology.coreNumbers.birthday],
                  ["Maturity", numerology.coreNumbers.maturity],
                ] as [string, NumerologyNumber][]).map(([label, num]) => (
                  <Card key={label} className="bg-white border-border-subtle">
                    <CardContent className="p-4">
                      <p className="text-xs text-accent-ink/60 uppercase mb-1">{label}</p>
                      <p className="text-2xl font-bold text-accent-gold">
                        {num.value}
                        {num.master && <span className="text-sm text-accent-gold/60 ml-1">({num.master})</span>}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Lucky Numbers */}
            <div>
              <h3 className="text-base font-semibold text-accent-ink/80 mb-3">Lucky Numbers</h3>
              <div className="flex gap-3 flex-wrap">
                {numerology.luckyNumbers.all.map((num, i) => (
                  <div
                    key={i}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      i === 0 ? "bg-accent-gold text-white" : "bg-accent-gold/10 text-accent-gold border border-accent-gold/30"
                    }`}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>

            {/* Karmic Debt */}
            {numerology.karmicDebt.hasKarmicDebt && (
              <div>
                <h3 className="text-base font-semibold text-accent-ink/80 mb-3">Karmic Debt</h3>
                <div className="flex gap-3 flex-wrap">
                  {numerology.karmicDebt.numbers.map((num) => (
                    <div
                      key={num}
                      className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-lg"
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Checkout section */}
      <CheckoutButton show={showCheckout} onToggle={() => setShowCheckout(!showCheckout)} label="Checkout a Numerology Book" />
      {showCheckout && (
        <NumerologyCheckoutForm
          name={checkoutName}
          date={checkoutDate}
          loading={checkoutLoading}
          onNameChange={setCheckoutName}
          onDateChange={setCheckoutDate}
          onSubmit={handleCheckout}
        />
      )}
    </div>
  );
}

// ============================================================================
// RECENT BOOKS TAB
// ============================================================================

function RecentBooksTab() {
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "astrology" | "numerology">("all");
  const [openedBook, setOpenedBook] = useState<{
    type: "astrology" | "numerology";
    data: AstrologyBookResponse | NumerologyBookResponse;
  } | null>(null);
  const [bookLoading, setBookLoading] = useState(false);

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch both shelves in parallel
      const [astroRes, numRes] = await Promise.all([
        fetch("/api/birth-chart-library"),
        fetch("/api/numerology-library"),
      ]);

      const all: RecentEntry[] = [];

      if (astroRes.ok) {
        const astro = await astroRes.json();
        for (const entry of astro.shelf || []) {
          all.push({ ...entry, book_type: "astrology" });
        }
      }

      if (numRes.ok) {
        const num = await numRes.json();
        for (const entry of num.shelf || []) {
          all.push({ ...entry, book_type: "numerology" });
        }
      }

      // Sort by last_opened_at desc
      all.sort((a, b) => new Date(b.last_opened_at).getTime() - new Date(a.last_opened_at).getTime());
      setEntries(all);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  const handleOpen = async (entry: RecentEntry) => {
    setBookLoading(true);
    setOpenedBook(null);

    try {
      if (entry.book_type === "astrology") {
        const res = await fetch("/api/birth-chart-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "load", chart_key: entry.book_key }),
        });
        if (res.ok) {
          const data = await res.json();
          setOpenedBook({ type: "astrology", data });
          void fetchRecent(); // Refresh to update last_opened_at
        }
      } else {
        const res = await fetch("/api/numerology-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "load", book_key: entry.book_key }),
        });
        if (res.ok) {
          const data = await res.json();
          setOpenedBook({ type: "numerology", data });
          void fetchRecent();
        }
      }
    } catch {
      // ignore
    } finally {
      setBookLoading(false);
    }
  };

  const handleRemove = async (entry: RecentEntry) => {
    try {
      const res = await fetch("/api/library-checkouts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book_type: entry.book_type, book_key: entry.book_key }),
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => !(e.book_key === entry.book_key && e.book_type === entry.book_type)));
        if (openedBook && entry.book_key === (
          openedBook.type === "astrology"
            ? (openedBook.data as AstrologyBookResponse).chart_key
            : (openedBook.data as NumerologyBookResponse).numerology_key
        )) {
          setOpenedBook(null);
        }
      }
    } catch {
      // ignore
    }
  };

  const filtered = filter === "all" ? entries : entries.filter((e) => e.book_type === filter);

  if (loading) {
    return <LoadingSpinner message="Loading recent books..." />;
  }

  return (
    <div className="space-y-6">
      {/* Filter chips */}
      <div className="flex gap-2">
        {(["all", "astrology", "numerology"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? "bg-accent-gold/20 text-accent-gold border border-accent-gold/30"
                : "bg-white text-accent-ink/60 border border-border-subtle hover:bg-white/80"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Entry list */}
      {filtered.length === 0 && (
        <Card className="bg-white/50">
          <CardContent className="py-12 text-center">
            <p className="text-accent-ink/60">
              {filter === "all"
                ? "No books checked out yet. Use the Astrology or Numerology tabs to generate your first book."
                : `No ${filter} books in your recent history.`}
            </p>
          </CardContent>
        </Card>
      )}

      {filtered.map((entry) => (
        <Card key={`${entry.book_type}-${entry.book_key}`} className="bg-white border-border-subtle">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    entry.book_type === "astrology"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-purple-50 text-purple-600"
                  }`}
                >
                  {entry.book_type === "astrology" ? "Astrology" : "Numerology"}
                </span>
              </div>
              <p className="text-sm font-medium text-accent-ink truncate">
                {entry.label || "Book"}
              </p>
              <p className="text-xs text-accent-ink/50">
                {formatRelativeTime(entry.last_opened_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpen(entry)}
                disabled={bookLoading}
              >
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemove(entry)}
                className="text-red-500 hover:text-red-600 hover:border-red-200"
              >
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Opened book inline viewer */}
      {bookLoading && <LoadingSpinner message="Loading book..." />}

      {openedBook && openedBook.type === "astrology" && (
        <div className="space-y-4 pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-accent-gold">Astrology Book</h3>
            <Button variant="outline" size="sm" onClick={() => setOpenedBook(null)}>
              Close
            </Button>
          </div>
          <InlineAstrologyViewer book={openedBook.data as AstrologyBookResponse} />
        </div>
      )}

      {openedBook && openedBook.type === "numerology" && (
        <div className="space-y-4 pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-accent-gold">Numerology Book</h3>
            <Button variant="outline" size="sm" onClick={() => setOpenedBook(null)}>
              Close
            </Button>
          </div>
          <InlineNumerologyViewer book={openedBook.data as NumerologyBookResponse} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INLINE VIEWERS (for Recent Books "Open" action)
// ============================================================================

function InlineAstrologyViewer({ book }: { book: AstrologyBookResponse }) {
  const insight = book.insight;
  if (!insight) {
    return <p className="text-accent-ink/60 text-sm">No narrative available for this chart.</p>;
  }

  return (
    <div className="space-y-4">
      {insight.coreSummary?.headline && (
        <h2 className="text-xl font-semibold text-accent-gold">{insight.coreSummary.headline}</h2>
      )}
      {insight.coreSummary?.overallVibe && (
        <div className="prose prose-sm max-w-none text-accent-ink/85 leading-relaxed">
          {insight.coreSummary.overallVibe.split("\n\n").map((p, i) => (
            <p key={i} className="mb-4 last:mb-0">{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineNumerologyViewer({ book }: { book: NumerologyBookResponse }) {
  const narrative = book.narrative;
  if (!narrative || !narrative.sections?.length) {
    return <p className="text-accent-ink/60 text-sm">No narrative available for this book.</p>;
  }

  return (
    <div className="space-y-4">
      {narrative.sections.map((section, i) => (
        <div key={i} className="space-y-2">
          <h3 className="text-base font-semibold text-accent-gold">{section.heading}</h3>
          <div className="prose prose-sm max-w-none text-accent-ink/85 leading-relaxed">
            {section.body.split("\n\n").map((p, j) => (
              <p key={j} className="mb-3 last:mb-0">{p}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SHARED HELPERS / SUB-COMPONENTS
// ============================================================================

function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-accent-gold/30 border-t-accent-gold animate-spin" />
        <span className="text-accent-ink/60">{message}</span>
      </div>
    </div>
  );
}

function CheckoutButton({
  show,
  onToggle,
  label = "Checkout Another Book",
}: {
  show: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <div className="flex justify-center">
      <Button variant="outline" onClick={onToggle}>
        {show ? "Cancel" : label}
      </Button>
    </div>
  );
}

function AstrologyCheckoutForm({
  date,
  time,
  place,
  loading,
  onDateChange,
  onTimeChange,
  onPlaceChange,
  onSubmit,
}: {
  date: string;
  time: string;
  place: PlaceSelection | null;
  loading: boolean;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onPlaceChange: (v: PlaceSelection | null) => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="border-accent-gold/30 bg-accent-gold/5">
      <CardContent className="p-6 space-y-4">
        <h3 className="text-lg font-semibold text-accent-ink">Checkout an Astrology Book</h3>
        <p className="text-sm text-accent-ink/60">
          Enter birth details to generate an astrology chart for anyone.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-accent-ink/70 block mb-1">Birth Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-accent-ink/70 block mb-1">Birth Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-accent-ink/70 block mb-1">Birth Place</label>
            <PlacePicker
              onSelect={(p) => onPlaceChange(p)}
              onClear={() => onPlaceChange(null)}
              placeholder="Search city..."
            />
          </div>
        </div>
        <Button
          variant="gold"
          onClick={onSubmit}
          disabled={loading || !date || !time || !place}
        >
          {loading ? "Generating..." : "Generate Astrology Book"}
        </Button>
      </CardContent>
    </Card>
  );
}

function NumerologyCheckoutForm({
  name,
  date,
  loading,
  onNameChange,
  onDateChange,
  onSubmit,
}: {
  name: string;
  date: string;
  loading: boolean;
  onNameChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="border-accent-gold/30 bg-accent-gold/5">
      <CardContent className="p-6 space-y-4">
        <h3 className="text-lg font-semibold text-accent-ink">Checkout a Numerology Book</h3>
        <p className="text-sm text-accent-ink/60">
          Enter a name and birth date to generate a numerology profile for anyone.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-accent-ink/70 block mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. John David Smith"
              className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-accent-ink/70 block mb-1">Birth Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-white"
            />
          </div>
        </div>
        <Button
          variant="gold"
          onClick={onSubmit}
          disabled={loading || !name.trim() || !date}
        >
          {loading ? "Generating..." : "Generate Numerology Book"}
        </Button>
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
