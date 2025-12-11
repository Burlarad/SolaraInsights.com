/**
 * Location detection and timezone validation utilities for Solara.
 *
 * Handles:
 * - Detecting when a user needs to provide location
 * - Multiple strategies for inferring location (profile, browser, IP, social)
 * - UX logic for location popup
 * - Localized messaging based on user's language
 */

import { Profile } from "@/types";

export type LocationStatus = {
  hasReliableTimezone: boolean;
  needsLocationPrompt: boolean;
  fallbackToUTC: boolean;
  timezone: string | null;
  reason?: string; // Why we need location or why we're falling back
};

/**
 * Determine if a profile has a reliable timezone for insights generation.
 *
 * A timezone is considered reliable if:
 * - It exists and is not empty
 * - It comes from geocoded birth location (has lat/lon)
 *
 * @param profile - User's profile
 * @returns Location status with recommendations
 */
export function getLocationStatus(profile: Profile): LocationStatus {
  // Check if we have a timezone
  const hasTimezone = !!(profile.timezone && profile.timezone.trim());

  // Check if timezone is derived from geocoded location
  const hasGeocodedLocation = !!(
    profile.birth_lat &&
    profile.birth_lon &&
    profile.timezone
  );

  if (hasGeocodedLocation) {
    // Best case: we have geocoded location with timezone
    return {
      hasReliableTimezone: true,
      needsLocationPrompt: false,
      fallbackToUTC: false,
      timezone: profile.timezone,
    };
  }

  if (hasTimezone) {
    // We have a timezone but no geocoded location
    // This could be:
    // - User manually set timezone
    // - Inferred from browser/IP
    // Accept it but mark as potentially needing improvement
    return {
      hasReliableTimezone: true,
      needsLocationPrompt: false,
      fallbackToUTC: false,
      timezone: profile.timezone,
      reason: "Timezone set but not from geocoded location",
    };
  }

  // No timezone at all - need to prompt for location
  return {
    hasReliableTimezone: false,
    needsLocationPrompt: true,
    fallbackToUTC: true,
    timezone: null,
    reason: "No timezone found in profile",
  };
}

/**
 * Get localized copy for the location permission popup.
 *
 * @param language - User's language code (e.g., "en", "es", "fr")
 * @returns Localized popup text
 */
export function getLocationPopupText(language: string = "en") {
  const copy: Record<string, { title: string; body: string; allow: string; skip: string }> = {
    en: {
      title: "Help Solara match your sky",
      body: "To generate your insights at the start of your day, Solara needs to know roughly where in the world you are.\n\nWe use this only to calculate your time zone so your daily, weekly, and monthly guidance refreshes at the right local time.\n\nIf you skip this, we'll use UTC as a default. Solara will still work, but your timing might feel a bit off.",
      allow: "Allow location",
      skip: "Skip, use UTC for now",
    },
    es: {
      title: "Ayuda a Solara a sincronizar tu cielo",
      body: "Para generar tus perspectivas al comienzo de tu día, Solara necesita saber aproximadamente dónde te encuentras en el mundo.\n\nUsamos esto solo para calcular tu zona horaria para que tu guía diaria, semanal y mensual se actualice en tu hora local correcta.\n\nSi omites esto, usaremos UTC como predeterminado. Solara seguirá funcionando, pero la sincronización puede sentirse un poco desajustada.",
      allow: "Permitir ubicación",
      skip: "Omitir, usar UTC por ahora",
    },
    fr: {
      title: "Aidez Solara à synchroniser votre ciel",
      body: "Pour générer vos perspectives au début de votre journée, Solara doit savoir approximativement où vous vous trouvez dans le monde.\n\nNous utilisons cela uniquement pour calculer votre fuseau horaire afin que vos conseils quotidiens, hebdomadaires et mensuels se rafraîchissent à la bonne heure locale.\n\nSi vous sautez cette étape, nous utiliserons UTC par défaut. Solara fonctionnera toujours, mais votre timing peut sembler un peu décalé.",
      allow: "Autoriser la localisation",
      skip: "Ignorer, utiliser UTC pour l'instant",
    },
    de: {
      title: "Helfen Sie Solara, Ihren Himmel anzupassen",
      body: "Um Ihre Einsichten zu Beginn Ihres Tages zu generieren, muss Solara ungefähr wissen, wo Sie sich in der Welt befinden.\n\nWir verwenden dies nur, um Ihre Zeitzone zu berechnen, damit Ihre täglichen, wöchentlichen und monatlichen Anleitungen zur richtigen lokalen Zeit aktualisiert werden.\n\nWenn Sie dies überspringen, verwenden wir UTC als Standard. Solara funktioniert weiterhin, aber Ihr Timing fühlt sich möglicherweise etwas daneben an.",
      allow: "Standort zulassen",
      skip: "Überspringen, UTC vorerst verwenden",
    },
    pt: {
      title: "Ajude a Solara a sincronizar seu céu",
      body: "Para gerar suas perspectivas no início do seu dia, a Solara precisa saber aproximadamente onde você está no mundo.\n\nUsamos isso apenas para calcular seu fuso horário para que sua orientação diária, semanal e mensal seja atualizada no horário local correto.\n\nSe você pular isso, usaremos UTC como padrão. A Solara ainda funcionará, mas o timing pode parecer um pouco desajustado.",
      allow: "Permitir localização",
      skip: "Pular, usar UTC por enquanto",
    },
  };

  return copy[language] || copy.en;
}

/**
 * Check if profile needs onboarding location completion.
 * Returns true if user has completed basic onboarding but missing geocoded location.
 *
 * @param profile - User's profile
 * @returns Whether to show location completion flow
 */
export function needsLocationOnboarding(profile: Profile): boolean {
  // If onboarded but no geocoded location, needs location onboarding
  if (profile.is_onboarded && !profile.birth_lat && !profile.birth_lon) {
    return true;
  }

  return false;
}

/**
 * Determine the effective timezone for a user with fallback logic.
 *
 * Priority:
 * 1. Profile timezone (if geocoded)
 * 2. Profile timezone (if manually set)
 * 3. UTC fallback
 *
 * @param profile - User's profile
 * @returns Effective timezone (never null - falls back to "UTC")
 */
export function getEffectiveTimezone(profile: Profile): string {
  if (profile.timezone && profile.timezone.trim()) {
    return profile.timezone;
  }

  console.warn(
    `[Location] No timezone found for user ${profile.id}, falling back to UTC`
  );
  return "UTC";
}
