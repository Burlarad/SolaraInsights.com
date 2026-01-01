"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import type { NumerologyResponse, NumerologySystem } from "@/types/numerology";
import type { NumerologyInsight } from "@/types/numerologyAI";
import {
  getPinnacleMeaning,
  getChallengeMeaning,
  getPersonalYearMeaning,
  getPersonalYearKeyword,
  getLuckyNumberMeaning,
  getKarmicDebtMeaning,
  getKarmicDebtLabel,
} from "@/lib/numerology";
import { getNumberMeaning } from "@/lib/numerology/meanings";
import { useTranslations } from "next-intl";

export default function NumerologyPage() {
  const [data, setData] = useState<NumerologyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [system, setSystem] = useState<NumerologySystem>("pythagorean");
  const t = useTranslations("numerology");
  const tCommon = useTranslations("common");

  // AI-generated interpretations (stone tablet - computed once per user)
  // TODO: Fetch AI interpretations from /api/numerology/interpret
  const [insight, setInsight] = useState<NumerologyInsight | null>(null);

  useEffect(() => {
    async function loadNumerology() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/numerology?system=${system}`);
        const result = await response.json();

        if (!response.ok) {
          if (result.code === "MISSING_BIRTH_NAME") {
            setError("birth_name_required");
          } else if (result.code === "MISSING_BIRTH_DATE") {
            setError("birth_date_required");
          } else {
            setError(result.message || "Failed to load numerology profile");
          }
          return;
        }

        setData(result);
      } catch (err: any) {
        console.error("Error loading numerology:", err);
        setError("Failed to load numerology profile. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadNumerology();
  }, [system]);

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
        <SanctuaryTabs />
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-accent-gold/30 border-t-accent-gold animate-spin" />
            <span className="text-accent-ink/60">{t("calculating")}</span>
          </div>
        </div>
      </div>
    );
  }

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
        <SanctuaryTabs />
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
        <SanctuaryTabs />
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
        <SanctuaryTabs />
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

  const { profile, cycles } = data;
  const { coreNumbers, pinnacles, challenges, luckyNumbers, karmicDebt } = profile;

  // Calculate current age and pinnacle
  const birthYear = parseInt(profile.input.birthDate.split("-")[0]);
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;

  const getCurrentPinnacle = () => {
    if (currentAge < pinnacles.first.endAge) return { ...pinnacles.first, period: "First" };
    if (currentAge < pinnacles.second.endAge) return { ...pinnacles.second, period: "Second" };
    if (currentAge < pinnacles.third.endAge) return { ...pinnacles.third, period: "Third" };
    return { ...pinnacles.fourth, period: "Fourth" };
  };

  const currentPinnacle = getCurrentPinnacle();

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
      <div className="flex items-center justify-between gap-4">
        <SanctuaryTabs />
        <div className="flex gap-2 p-1 bg-white/50 rounded-full flex-shrink-0">
          <button
            onClick={() => setSystem("pythagorean")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              system === "pythagorean"
                ? "bg-accent-ink text-white"
                : "text-accent-ink hover:bg-white/80"
            }`}
          >
            {t("systems.pythagorean")}
          </button>
          <button
            onClick={() => setSystem("chaldean")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              system === "chaldean"
                ? "bg-accent-ink text-white"
                : "text-accent-ink hover:bg-white/80"
            }`}
          >
            {t("systems.chaldean")}
          </button>
        </div>
      </div>

      {/* Core Numbers Grid */}
      <section>
        <h2 className="text-lg font-semibold text-accent-gold mb-4">{t("coreNumbers.title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CoreNumberCard
            label={t("coreNumbers.lifePath")}
            number={coreNumbers.lifePath.value}
            master={coreNumbers.lifePath.master}
            contextDescription={t("coreNumbers.lifePathDesc")}
          />
          <CoreNumberCard
            label={t("coreNumbers.expression")}
            number={coreNumbers.expression.value}
            master={coreNumbers.expression.master}
            contextDescription={t("coreNumbers.expressionDesc")}
          />
          <CoreNumberCard
            label={t("coreNumbers.soulUrge")}
            number={coreNumbers.soulUrge.value}
            master={coreNumbers.soulUrge.master}
            contextDescription={t("coreNumbers.soulUrgeDesc")}
          />
          <CoreNumberCard
            label={t("coreNumbers.personality")}
            number={coreNumbers.personality.value}
            master={coreNumbers.personality.master}
            contextDescription={t("coreNumbers.personalityDesc")}
          />
          <CoreNumberCard
            label={t("coreNumbers.birthday")}
            number={coreNumbers.birthday.value}
            master={coreNumbers.birthday.master}
            contextDescription={t("coreNumbers.birthdayDesc")}
          />
          <CoreNumberCard
            label={t("coreNumbers.maturity")}
            number={coreNumbers.maturity.value}
            master={coreNumbers.maturity.master}
            contextDescription={t("coreNumbers.maturityDesc")}
          />
        </div>
      </section>

      {/* Personal Cycles */}
      <section>
        <h2 className="text-lg font-semibold text-accent-gold mb-4">{t("cycles.title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Personal Year */}
          <Card className="bg-white border-border-subtle">
            <CardContent className="p-5">
              <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">
                {t("cycles.personalYear")}
              </p>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-3xl font-bold text-accent-gold">{cycles.personalYear}</p>
                <span className="text-sm font-medium text-accent-ink/70">
                  {getNumberMeaning(cycles.personalYear).keyword}
                </span>
              </div>
              <p className="text-sm text-accent-ink/80 leading-relaxed">
                {getNumberMeaning(cycles.personalYear).yearGuidance}
              </p>
            </CardContent>
          </Card>

          {/* Personal Month */}
          <Card className="bg-white border-border-subtle">
            <CardContent className="p-5">
              <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">
                {t("cycles.personalMonth")}
              </p>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-3xl font-bold text-accent-gold">{cycles.personalMonth}</p>
                <span className="text-sm font-medium text-accent-ink/70">
                  {getNumberMeaning(cycles.personalMonth).keyword}
                </span>
              </div>
              <p className="text-sm text-accent-ink/80 leading-relaxed">
                {getNumberMeaning(cycles.personalMonth).monthGuidance}
              </p>
            </CardContent>
          </Card>

          {/* Personal Day */}
          <Card className="bg-white border-border-subtle">
            <CardContent className="p-5">
              <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">
                {t("cycles.personalDay")}
              </p>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-3xl font-bold text-accent-gold">{cycles.personalDay}</p>
                <span className="text-sm font-medium text-accent-ink/70">
                  {getNumberMeaning(cycles.personalDay).keyword}
                </span>
              </div>
              <p className="text-sm text-accent-ink/80 leading-relaxed">
                {getNumberMeaning(cycles.personalDay).dayGuidance}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Current Pinnacle */}
      <section>
        <h2 className="text-lg font-semibold text-accent-gold mb-4">{t("lifePeriods.title")}</h2>
        <Card className="bg-gradient-to-br from-accent-gold/5 to-transparent border-accent-gold/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-accent-ink/60">{t("lifePeriods.currentPinnacle")}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-accent-gold">{currentPinnacle.number}</p>
                  <span className="text-sm font-medium text-accent-ink/70">
                    {getNumberMeaning(currentPinnacle.number).keyword}
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
            <p className="text-accent-ink/80">{getNumberMeaning(currentPinnacle.number).description}</p>
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
              const pinnacleMeaning = getNumberMeaning(p.number);

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
                      {pinnacleMeaning.keyword}
                    </span>
                  </div>
                  <p className="text-xs text-accent-ink/50 mb-2">
                    {t("lifePeriods.ages")} {p.startAge || 0} - {p.endAge || t("lifePeriods.onwards")}
                  </p>
                  <p className="text-xs text-accent-ink/70 line-clamp-2">
                    {pinnacleMeaning.brief}
                  </p>
                </div>
              );
            }
          )}
        </div>
      </section>

      {/* Challenges */}
      <section>
        <h2 className="text-lg font-semibold text-accent-gold mb-4">{t("challenges.title")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[challenges.first, challenges.second, challenges.third, challenges.fourth].map(
            (c, i) => {
              const challengeMeaning = getNumberMeaning(c);
              return (
                <Card key={i} className="bg-white border-border-subtle">
                  <CardContent className="p-4">
                    <p className="text-xs text-accent-ink/60 mb-1">
                      {t(`challenges.${["first", "second", "third", "main"][i]}`)}
                    </p>
                    <div className="flex items-baseline gap-2 mb-2">
                      <p className="text-2xl font-bold text-accent-ink">{c}</p>
                      <span className="text-xs font-medium text-accent-ink/60">
                        {challengeMeaning.keyword}
                      </span>
                    </div>
                    <p className="text-xs text-accent-ink/70 line-clamp-2">
                      {getChallengeMeaning(c)}
                    </p>
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      </section>

      {/* Lucky Numbers */}
      <section>
        <h2 className="text-lg font-semibold text-accent-gold mb-4">{t("luckyNumbers.title")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {luckyNumbers.all.map((num, i) => {
            const numMeaning = getNumberMeaning(num);
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
                    {numMeaning.keyword}
                  </p>
                  {isMaster && (
                    <p className="text-xs text-accent-gold font-medium mb-1">{tCommon("masterNumber")}</p>
                  )}
                  <p className="text-xs text-accent-ink/60">{numMeaning.energy}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Karmic Debt */}
      {karmicDebt.hasKarmicDebt && (
        <section>
          <h2 className="text-lg font-semibold text-accent-gold mb-4">{t("karmicDebt.title")}</h2>
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
                        Karmic Debt {num}: {getKarmicDebtLabel(num as 13 | 14 | 16 | 19)}
                      </p>
                      <p className="text-sm text-accent-ink/70 mt-1">
                        {getKarmicDebtMeaning(num as 13 | 14 | 16 | 19)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Core Number Card Component
function CoreNumberCard({
  label,
  number,
  master,
  contextDescription,
}: {
  label: string;
  number: number;
  master?: number;
  contextDescription: string;
}) {
  const meaning = getNumberMeaning(master || number);

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
            {meaning.keyword}
          </span>
        </div>
        <p className="text-xs text-accent-ink/50 mb-3">{contextDescription}</p>
        <p className="text-sm text-accent-ink/80 leading-relaxed">
          {meaning.description}
        </p>
      </CardContent>
    </Card>
  );
}
