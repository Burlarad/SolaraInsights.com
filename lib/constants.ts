// Zodiac signs ordered starting with Capricorn (winter solstice)
export const ZODIAC_SIGNS = [
  { name: "Capricorn", key: "capricorn", symbol: "♑︎" },
  { name: "Aquarius", key: "aquarius", symbol: "♒︎" },
  { name: "Pisces", key: "pisces", symbol: "♓︎" },
  { name: "Aries", key: "aries", symbol: "♈︎" },
  { name: "Taurus", key: "taurus", symbol: "♉︎" },
  { name: "Gemini", key: "gemini", symbol: "♊︎" },
  { name: "Cancer", key: "cancer", symbol: "♋︎" },
  { name: "Leo", key: "leo", symbol: "♌︎" },
  { name: "Virgo", key: "virgo", symbol: "♍︎" },
  { name: "Libra", key: "libra", symbol: "♎︎" },
  { name: "Scorpio", key: "scorpio", symbol: "♏︎" },
  { name: "Sagittarius", key: "sagittarius", symbol: "♐︎" },
] as const;

// Keys for timeframe and experience toggles (translate using i18n)
export const TIMEFRAME_KEYS = ["today", "week", "month"] as const;
export const EXPERIENCE_KEYS = ["horoscope", "tarot", "compatibility"] as const;

export type TimeframeKey = (typeof TIMEFRAME_KEYS)[number];
export type ExperienceKey = (typeof EXPERIENCE_KEYS)[number];
