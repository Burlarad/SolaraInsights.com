"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import type { NumerologySystem, CycleNumbers } from "@/types/numerology";
import { useTranslations } from "next-intl";

// ============================================================================
// TYPES
// ============================================================================

type NumerologyNarrativeSection = {
  heading: string;
  body: string;
};

type NumerologyNarrative = {
  sections: NumerologyNarrativeSection[];
};

type NumerologyNumber = {
  value: number;
  master?: number;
};

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

type Challenges = {
  first: number;
  second: number;
  third: number;
  fourth: number;
};

type LuckyNumbers = {
  primary: number;
  secondary: number[];
  all: number[];
};

type KarmicDebt = {
  hasKarmicDebt: boolean;
  numbers: number[];
  sources?: { number: number; source: string }[];
};

type NumerologyComputeResult = {
  coreNumbers: CoreNumbers;
  pinnacles: Pinnacles;
  challenges: Challenges;
  luckyNumbers: LuckyNumbers;
  karmicDebt: KarmicDebt;
};

type ShelfEntry = {
  book_key: string;
  label: string | null;
  last_opened_at: string;
  created_at: string;
};

type NumerologyLibraryResponse = {
  numerology: NumerologyComputeResult;
  narrative: NumerologyNarrative | null;
  cycles: CycleNumbers;
  numerology_key: string;
  input: { first_name: string; middle_name?: string; last_name: string; birth_date: string };
  is_official: boolean;
  mode: string;
  system: string;
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function NumerologyPage() {
  const [data, setData] = useState<NumerologyLibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [system, setSystem] = useState<NumerologySystem>("pythagorean");
  const t = useTranslations("numerology");
  const tCommon = useTranslations("common");

  // Shelf state
  const [shelf, setShelf] = useState<ShelfEntry[]>([]);
  const [officialKey, setOfficialKey] = useState<string | null>(null);
  const [currentBookKey, setCurrentBookKey] = useState<string | null>(null);

  // Checkout form state
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutBirthDate, setCheckoutBirthDate] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Appendix expand state
  const [appendixOpen, setAppendixOpen] = useState(false);

  // ---- Shelf fetch ----
  const refreshShelf = useCallback(async () => {
    try {
      const res = await fetch("/api/numerology-library");
      if (res.ok) {
        const json = await res.json();
        setShelf(json.shelf || []);
        setOfficialKey(json.official_key || null);
      }
    } catch {
      // non-critical
    }
  }, []);

  // ---- Load book by key ----
  const loadBookByKey = useCallback(
    async (bookKey: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/numerology-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "load", book_key: bookKey, system }),
        });
        const result = await res.json();
        if (!res.ok) {
          setError(result.message || "Failed to load book");
          return;
        }
        setData(result);
        setCurrentBookKey(result.numerology_key);
        await refreshShelf();
      } catch {
        setError("Failed to load book. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [system, refreshShelf]
  );

  // ---- Initial load: fetch shelf + official ----
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);

      // Fetch shelf first
      await refreshShelf();

      // Load official numerology
      try {
        const res = await fetch("/api/numerology-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "official", system }),
        });
        const result = await res.json();

        if (!res.ok) {
          const code = result?.errorCode || result?.code;
          if (code === "MISSING_NAME" || code === "MISSING_BIRTH_NAME") {
            setError("birth_name_required");
          } else if (code === "MISSING_BIRTH_DATE") {
            setError("birth_date_required");
          } else {
            setError(result.message || "Failed to load numerology profile");
          }
          return;
        }

        setData(result);
        setCurrentBookKey(result.numerology_key);
        await refreshShelf();
      } catch (err: any) {
        console.error("Error loading numerology:", err);
        setError("Failed to load numerology profile. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [system, refreshShelf]);

  // ---- Checkout handler ----
  const handleCheckout = async () => {
    if (!checkoutName.trim() || !checkoutBirthDate) return;

    setCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/numerology-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "checkout",
          system,
          input: {
            full_name: checkoutName.trim(),
            birth_date: checkoutBirthDate,
          },
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.message || "Failed to generate numerology");
        return;
      }

      setData(result);
      setCurrentBookKey(result.numerology_key);
      setShowCheckoutForm(false);
      setCheckoutName("");
      setCheckoutBirthDate("");
      await refreshShelf();
    } catch {
      setError("Failed to generate numerology. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ---- Return to official ----
  const handleReturnToOfficial = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/numerology-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "official", system }),
      });
      const result = await res.json();
      if (res.ok) {
        setData(result);
        setCurrentBookKey(result.numerology_key);
        await refreshShelf();
      }
    } catch {
      setError("Failed to load official numerology.");
    } finally {
      setLoading(false);
    }
  };

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div className="flex justify-center items-center pt-4 pb-8">
          <SolaraLogo />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-accent-ink/70">{t("subtitle")}</p>
        </div>
        <div className="flex justify-center">
          <SanctuaryTabs />
        </div>
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-accent-gold/30 border-t-accent-gold animate-spin" />
            <span className="text-accent-ink/60">{t("calculating")}</span>
          </div>
        </div>
      </div>
    );
  }

  // ---- ERROR STATES ----
  if (error === "birth_name_required") {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div className="flex justify-center items-center pt-4 pb-8">
          <SolaraLogo />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-accent-ink/70">{t("subtitle")}</p>
        </div>
        <div className="flex justify-center">
          <SanctuaryTabs />
        </div>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-12 text-center space-y-4">
            <h2 className="text-xl font-semibold text-accent-ink">{t("errors.nameRequired")}</h2>
            <p className="text-accent-ink/70 max-w-md mx-auto">
              {t("errors.nameRequiredMessage")}
            </p>
            <Button variant="gold" asChild>
              <a href="/settings">{tCommon("goToSettings")}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error === "birth_date_required") {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div className="flex justify-center items-center pt-4 pb-8">
          <SolaraLogo />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-accent-ink/70">{t("subtitle")}</p>
        </div>
        <div className="flex justify-center">
          <SanctuaryTabs />
        </div>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-12 text-center space-y-4">
            <h2 className="text-xl font-semibold text-accent-ink">{t("errors.birthDateRequired")}</h2>
            <p className="text-accent-ink/70 max-w-md mx-auto">
              {t("errors.birthDateRequiredMessage")}
            </p>
            <Button variant="gold" asChild>
              <a href="/settings">{tCommon("goToSettings")}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div className="flex justify-center items-center pt-4 pb-8">
          <SolaraLogo />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-accent-ink/70">{t("subtitle")}</p>
        </div>
        <div className="flex justify-center">
          <SanctuaryTabs />
        </div>
        <Card className="border-danger-soft/20">
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-accent-ink/70">{error || t("errors.loadFailed")}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              {tCommon("tryAgain")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- MAIN CONTENT ----
  const { numerology, narrative, cycles } = data;
  const { coreNumbers, pinnacles, challenges, luckyNumbers, karmicDebt } = numerology;

  const birthYear = parseInt(data.input.birth_date.split("-")[0]);
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;

  const getCurrentPinnacle = () => {
    if (currentAge < pinnacles.first.endAge) return { ...pinnacles.first, period: "First" };
    if (currentAge < pinnacles.second.endAge) return { ...pinnacles.second, period: "Second" };
    if (currentAge < pinnacles.third.endAge) return { ...pinnacles.third, period: "Third" };
    return { ...pinnacles.fourth, period: "Fourth" };
  };
  const currentPinnacle = getCurrentPinnacle();

  // Shelf helpers
  const shelfIndex = shelf.findIndex((s) => s.book_key === currentBookKey);
  const isViewingOfficial = currentBookKey === officialKey;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Solara Logo */}
      <div className="flex justify-center items-center pt-4 pb-8">
        <SolaraLogo />
      </div>

      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-accent-ink/70">{t("subtitle")}</p>
      </div>

      {/* Navigation + System Toggle */}
      <div className="flex flex-col items-center gap-4">
        <SanctuaryTabs />
        <div className="flex gap-2 p-1 bg-white/50 rounded-full">
          <button
            onClick={() => setSystem("pythagorean")}
            className={`px-4 py-2 rounded-full font-cursive text-xl font-normal transition-all ${
              system === "pythagorean"
                ? "bg-accent-ink text-white"
                : "text-accent-ink hover:bg-white/80"
            }`}
          >
            {t("systems.pythagorean")}
          </button>
          <button
            onClick={() => setSystem("chaldean")}
            className={`px-4 py-2 rounded-full font-cursive text-xl font-normal transition-all ${
              system === "chaldean"
                ? "bg-accent-ink text-white"
                : "text-accent-ink hover:bg-white/80"
            }`}
          >
            {t("systems.chaldean")}
          </button>
        </div>
      </div>

      {/* ====== SHELF COUNTER + BOOK SWITCHER ====== */}
      {shelf.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/60 rounded-xl p-4 border border-border-subtle">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-accent-ink/70">
              Book {shelfIndex >= 0 ? shelfIndex + 1 : 1} of {shelf.length}
            </span>
            {shelf.length > 1 && (
              <select
                className="text-sm border border-border-subtle rounded-lg px-3 py-1.5 bg-white text-accent-ink"
                value={currentBookKey || ""}
                onChange={(e) => {
                  if (e.target.value && e.target.value !== currentBookKey) {
                    if (e.target.value === officialKey) {
                      handleReturnToOfficial();
                    } else {
                      loadBookByKey(e.target.value);
                    }
                  }
                }}
              >
                {shelf.map((entry) => (
                  <option key={entry.book_key} value={entry.book_key}>
                    {entry.label || "Book"}{entry.book_key === officialKey ? " (Official)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isViewingOfficial && officialKey && (
              <Button variant="outline" size="sm" onClick={handleReturnToOfficial}>
                Return to Official
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCheckoutForm(!showCheckoutForm)}
            >
              {showCheckoutForm ? "Cancel" : "Checkout Another Book"}
            </Button>
          </div>
        </div>
      )}

      {/* ====== CHECKOUT FORM ====== */}
      {showCheckoutForm && (
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
                  value={checkoutName}
                  onChange={(e) => setCheckoutName(e.target.value)}
                  placeholder="e.g. John David Smith"
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-accent-ink/70 block mb-1">Birth Date</label>
                <input
                  type="date"
                  value={checkoutBirthDate}
                  onChange={(e) => setCheckoutBirthDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-white"
                />
              </div>
            </div>
            <Button
              variant="gold"
              onClick={handleCheckout}
              disabled={checkoutLoading || !checkoutName.trim() || !checkoutBirthDate}
            >
              {checkoutLoading ? "Generating..." : "Generate Numerology Book"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ====== NARRATIVE (MAIN CONTENT — TOP) ====== */}
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

      {/* ====== PERSONAL CYCLES (time-sensitive, shown between narrative and appendix) ====== */}
      {cycles && (
        <section>
          <h2 className="text-lg font-semibold text-accent-gold mb-4">{t("cycles.title")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border-border-subtle">
              <CardContent className="p-5">
                <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">
                  {t("cycles.personalYear")}
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold text-accent-gold">{cycles.personalYear}</p>
                  <span className="text-sm font-medium text-accent-ink/70">
                    {t(`numbers.${cycles.personalYear}.keyword`)}
                  </span>
                </div>
                <p className="text-sm text-accent-ink/80 leading-relaxed">
                  {t(`numbers.${cycles.personalYear}.yearGuidance`)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-border-subtle">
              <CardContent className="p-5">
                <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">
                  {t("cycles.personalMonth")}
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold text-accent-gold">{cycles.personalMonth}</p>
                  <span className="text-sm font-medium text-accent-ink/70">
                    {t(`numbers.${cycles.personalMonth}.keyword`)}
                  </span>
                </div>
                <p className="text-sm text-accent-ink/80 leading-relaxed">
                  {t(`numbers.${cycles.personalMonth}.monthGuidance`)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-border-subtle">
              <CardContent className="p-5">
                <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">
                  {t("cycles.personalDay")}
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold text-accent-gold">{cycles.personalDay}</p>
                  <span className="text-sm font-medium text-accent-ink/70">
                    {t(`numbers.${cycles.personalDay}.keyword`)}
                  </span>
                </div>
                <p className="text-sm text-accent-ink/80 leading-relaxed">
                  {t(`numbers.${cycles.personalDay}.dayGuidance`)}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* ====== APPENDIX (NUMBERS — collapsible, secondary) ====== */}
      <section>
        <button
          onClick={() => setAppendixOpen(!appendixOpen)}
          className="flex items-center gap-2 text-lg font-semibold text-accent-gold mb-4 hover:opacity-80 transition-opacity"
        >
          <span className={`transition-transform ${appendixOpen ? "rotate-90" : ""}`}>
            &#9654;
          </span>
          Numbers &amp; Meanings
        </button>

        {appendixOpen && (
          <div className="space-y-8">
            {/* Core Numbers Grid */}
            <div>
              <h3 className="text-base font-semibold text-accent-ink/80 mb-3">{t("coreNumbers.title")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <CoreNumberCard
                  label={t("coreNumbers.lifePath")}
                  number={coreNumbers.lifePath.value}
                  master={coreNumbers.lifePath.master}
                  contextDescription={t("coreNumbers.lifePathDesc")}
                  t={t}
                />
                <CoreNumberCard
                  label={t("coreNumbers.expression")}
                  number={coreNumbers.expression.value}
                  master={coreNumbers.expression.master}
                  contextDescription={t("coreNumbers.expressionDesc")}
                  t={t}
                />
                <CoreNumberCard
                  label={t("coreNumbers.soulUrge")}
                  number={coreNumbers.soulUrge.value}
                  master={coreNumbers.soulUrge.master}
                  contextDescription={t("coreNumbers.soulUrgeDesc")}
                  t={t}
                />
                <CoreNumberCard
                  label={t("coreNumbers.personality")}
                  number={coreNumbers.personality.value}
                  master={coreNumbers.personality.master}
                  contextDescription={t("coreNumbers.personalityDesc")}
                  t={t}
                />
                <CoreNumberCard
                  label={t("coreNumbers.birthday")}
                  number={coreNumbers.birthday.value}
                  master={coreNumbers.birthday.master}
                  contextDescription={t("coreNumbers.birthdayDesc")}
                  t={t}
                />
                <CoreNumberCard
                  label={t("coreNumbers.maturity")}
                  number={coreNumbers.maturity.value}
                  master={coreNumbers.maturity.master}
                  contextDescription={t("coreNumbers.maturityDesc")}
                  t={t}
                />
              </div>
            </div>

            {/* Current Pinnacle */}
            <div>
              <h3 className="text-base font-semibold text-accent-ink/80 mb-3">{t("lifePeriods.title")}</h3>
              <Card className="bg-gradient-to-br from-accent-gold/5 to-transparent border-accent-gold/20">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm text-accent-ink/60">{t("lifePeriods.currentPinnacle")}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-bold text-accent-gold">{currentPinnacle.number}</p>
                        <span className="text-sm font-medium text-accent-ink/70">
                          {t(`numbers.${currentPinnacle.number}.keyword`)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-accent-ink/60">{currentPinnacle.period} {t("lifePeriods.period")}</p>
                      <p className="text-sm text-accent-ink/70">
                        {t("lifePeriods.ages")} {currentPinnacle.startAge || 0} - {currentPinnacle.endAge || t("lifePeriods.onwards")}
                      </p>
                    </div>
                  </div>
                  <p className="text-accent-ink/80">{t(`numbers.${currentPinnacle.number}.description`)}</p>
                </CardContent>
              </Card>

              {/* All Pinnacles Timeline */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {[pinnacles.first, pinnacles.second, pinnacles.third, pinnacles.fourth].map(
                  (p, i) => {
                    const isActive =
                      (i === 0 && currentAge < pinnacles.first.endAge) ||
                      (i === 1 && currentAge >= pinnacles.first.endAge && currentAge < pinnacles.second.endAge) ||
                      (i === 2 && currentAge >= pinnacles.second.endAge && currentAge < pinnacles.third.endAge) ||
                      (i === 3 && currentAge >= pinnacles.third.endAge);

                    return (
                      <div
                        key={i}
                        className={`p-4 rounded-lg ${
                          isActive
                            ? "bg-accent-gold/20 border border-accent-gold/40"
                            : "bg-white border border-border-subtle"
                        }`}
                      >
                        <p className="text-xs text-accent-ink/60 mb-1">
                          {t(`lifePeriods.pinnacles.${["first", "second", "third", "fourth"][i]}`)}
                        </p>
                        <div className="flex items-baseline gap-2 mb-1">
                          <p className={`text-2xl font-bold ${isActive ? "text-accent-gold" : "text-accent-ink"}`}>
                            {p.number}
                          </p>
                          <span className="text-xs font-medium text-accent-ink/60">
                            {t(`numbers.${p.number}.keyword`)}
                          </span>
                        </div>
                        <p className="text-xs text-accent-ink/50 mb-2">
                          {t("lifePeriods.ages")} {p.startAge || 0} - {p.endAge || t("lifePeriods.onwards")}
                        </p>
                        <p className="text-xs text-accent-ink/70 line-clamp-2">
                          {t(`numbers.${p.number}.brief`)}
                        </p>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Challenges */}
            <div>
              <h3 className="text-base font-semibold text-accent-ink/80 mb-3">{t("challenges.title")}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[challenges.first, challenges.second, challenges.third, challenges.fourth].map(
                  (c, i) => (
                    <Card key={i} className="bg-white border-border-subtle">
                      <CardContent className="p-4">
                        <p className="text-xs text-accent-ink/60 mb-1">
                          {t(`challenges.${["first", "second", "third", "main"][i]}`)}
                        </p>
                        <div className="flex items-baseline gap-2 mb-2">
                          <p className="text-2xl font-bold text-accent-ink">{c}</p>
                          <span className="text-xs font-medium text-accent-ink/60">
                            {t(`numbers.${c}.keyword`)}
                          </span>
                        </div>
                        <p className="text-xs text-accent-ink/70 line-clamp-2">
                          {t(`challengeMeanings.${c}`)}
                        </p>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            </div>

            {/* Lucky Numbers */}
            <div>
              <h3 className="text-base font-semibold text-accent-ink/80 mb-3">{t("luckyNumbers.title")}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {luckyNumbers.all.map((num, i) => {
                  const isMaster = num === 11 || num === 22 || num === 33;
                  return (
                    <Card
                      key={i}
                      className={`border-border-subtle ${
                        i === 0 ? "bg-accent-gold/10 border-accent-gold/30" : "bg-white"
                      }`}
                    >
                      <CardContent className="p-4 text-center">
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3 ${
                            i === 0
                              ? "bg-accent-gold text-white"
                              : "bg-accent-gold/10 text-accent-gold border border-accent-gold/30"
                          }`}
                        >
                          {num}
                        </div>
                        <p className="text-sm font-medium text-accent-ink mb-1">
                          {t(`numbers.${num}.keyword`)}
                        </p>
                        {isMaster && (
                          <p className="text-xs text-accent-gold font-medium mb-1">{tCommon("masterNumber")}</p>
                        )}
                        <p className="text-xs text-accent-ink/60">{t(`numbers.${num}.energy`)}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Karmic Debt */}
            {karmicDebt.hasKarmicDebt && (
              <div>
                <h3 className="text-base font-semibold text-accent-ink/80 mb-3">{t("karmicDebt.title")}</h3>
                <div className="space-y-4">
                  {karmicDebt.numbers.map((num) => (
                    <Card key={num} className="bg-white border-border-subtle">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xl flex-shrink-0">
                            {num}
                          </div>
                          <div>
                            <p className="font-medium text-accent-ink">
                              {t("karmicDebt.title")} {num}: {t(`karmicDebt.${num}.label`)}
                            </p>
                            <p className="text-sm text-accent-ink/70 mt-1">
                              {t(`karmicDebt.${num}.meaning`)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function CoreNumberCard({
  label,
  number,
  master,
  contextDescription,
  t,
}: {
  label: string;
  number: number;
  master?: number;
  contextDescription: string;
  t: (key: string) => string;
}) {
  const displayNumber = master || number;

  return (
    <Card className="bg-white border-border-subtle hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">{label}</p>
        <div className="flex items-baseline gap-2 mb-1">
          <p className="text-3xl font-bold text-accent-gold">{number}</p>
          {master && (
            <span className="text-sm text-accent-gold/60">({master})</span>
          )}
          <span className="text-sm font-medium text-accent-ink/70">
            {t(`numbers.${displayNumber}.keyword`)}
          </span>
        </div>
        <p className="text-xs text-accent-ink/50 mb-3">{contextDescription}</p>
        <p className="text-sm text-accent-ink/80 leading-relaxed">
          {t(`numbers.${displayNumber}.description`)}
        </p>
      </CardContent>
    </Card>
  );
}
