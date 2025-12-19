/**
 * Fun rotating error messages for Solara.
 * Each category has 10 messages that rotate on retry.
 * Use {X} placeholder for retry time.
 */

export const ERROR_MESSAGE_CATEGORIES = [
  "cooldown_429",
  "rate_limited_429",
  "still_generating_503",
  "budget_503",
  "service_503",
  "validation_400",
  "provider_500",
  "non_json_response",
] as const;

export type ErrorMessageCategory = (typeof ERROR_MESSAGE_CATEGORIES)[number];

export const ERROR_MESSAGES: Record<ErrorMessageCategory, string[]> = {
  // Cooldown - user needs to wait a few seconds
  cooldown_429: [
    "The stars need {X} to realign. Take a breath.",
    "Mercury isn't in retrograde, but you are moving too fast. {X} to go.",
    "Even cosmic wisdom needs a moment. Back in {X}.",
    "Your chart is still settling. Give it {X}.",
    "The universe is catching up to you. {X} remaining.",
    "Slow down, stargazer. The cosmos will be ready in {X}.",
    "A brief pause in the celestial broadcast. Resuming in {X}.",
    "The oracle is recharging. Please wait {X}.",
    "Patience, seeker. The stars speak again in {X}.",
    "Your energy is powerful! Let the cosmos rest for {X}.",
  ],

  // Rate limited - user hit hourly/daily limit
  rate_limited_429: [
    "You've consulted the stars quite a bit! Rest and return in {X}.",
    "The cosmos requests a breather. Try again in {X}.",
    "Even astrologers need coffee breaks. Back in {X}.",
    "Your curiosity is admirable! The stars reset in {X}.",
    "The celestial hotline is busy. Queue resets in {X}.",
    "You've reached your cosmic quota. Refills in {X}.",
    "The universe loves your enthusiasm! Limits reset in {X}.",
    "Time to touch grass, stargazer. Return in {X}.",
    "The oracle needs to meditate. Available again in {X}.",
    "Too many wishes on the stars. Try again in {X}.",
  ],

  // Still generating - lock is held, another request is processing
  still_generating_503: [
    "The stars are already brewing your insight. Hang tight!",
    "Your cosmic reading is in the cauldron. Almost ready!",
    "The oracle is mid-vision. Just a moment more.",
    "Celestial gears are turning. Your insight approaches.",
    "The universe is writing in the stars. Please wait.",
    "Your reading is being woven from stardust. Almost there!",
    "The cosmos is composing your message. Stay tuned.",
    "A constellation is forming just for you. Nearly done!",
    "The astral plane is busy with your request. Patience.",
    "Your insight is crystallizing. Just a few more seconds.",
  ],

  // Budget exceeded - system spending limit hit
  budget_503: [
    "The cosmic treasury needs to restock. Try again later.",
    "Even the stars have budgets. We'll be back soon.",
    "The oracle is on a brief sabbatical. Check back later.",
    "Celestial resources are replenishing. Try again shortly.",
    "The universe is recalibrating. Back online soon.",
    "Our star power is recharging. Please try again later.",
    "The astral coffers are refilling. Return in a bit.",
    "Cosmic maintenance in progress. We'll be right back.",
    "The zodiac wheel is getting oiled. Try again soon.",
    "Even infinite wisdom needs a moment. Back shortly.",
  ],

  // Generic service unavailable
  service_503: [
    "The stars are momentarily clouded. Try again shortly.",
    "Our celestial connection is flickering. One moment.",
    "The cosmic signal is weak right now. Please retry.",
    "The oracle is between dimensions. Try again soon.",
    "Starlink is recalibrating. Back in a moment.",
    "The astral server is dreaming. Wake it with a retry.",
    "Cosmic interference detected. Please try again.",
    "The universe hit a small snag. Retry in a moment.",
    "Our crystal ball is foggy. Clearing up shortly.",
    "The zodiac is taking five. Try again soon.",
  ],

  // Validation error - bad input
  validation_400: [
    "The stars couldn't parse that. Check your input.",
    "Something looks off in your request. Please review.",
    "The oracle needs clearer instructions. Try again.",
    "Your cosmic query has a typo in the stars. Fix and retry.",
    "The celestial form wasn't filled correctly. Check it.",
    "Invalid star coordinates. Please correct your input.",
    "The universe couldn't understand that. Rephrase?",
    "Your request didn't align with the zodiac. Adjust it.",
    "The astral parser is confused. Check your details.",
    "Missing or malformed data. The stars need more info.",
  ],

  // Provider error - OpenAI or external service failed
  provider_500: [
    "The cosmic provider had a hiccup. Trying again might help.",
    "Our star channel encountered static. Please retry.",
    "The oracle's connection dropped. Give it another shot.",
    "Celestial communications experienced turbulence. Try again.",
    "The astral API is having a moment. Retry shortly.",
    "Something went wrong in the cosmos. Please try again.",
    "The universe threw an exception. Our apologies!",
    "A glitch in the matrix of stars. Retry recommended.",
    "The zodiac wheel spun off track. Trying again should help.",
    "Cosmic error encountered. The stars suggest a retry.",
  ],

  // Non-JSON response - server returned HTML or other format
  non_json_response: [
    "The stars sent hieroglyphics instead of wisdom. Retrying...",
    "Our cosmic translator got confused. Try again.",
    "The oracle spoke in tongues. Let's try that again.",
    "Received stardust instead of data. Please retry.",
    "The celestial signal was scrambled. One more try?",
    "The universe responded in Klingon. Retry for English.",
    "Our astral decoder needs a reset. Try again.",
    "The cosmic response was... unexpected. Retry?",
    "The stars sent a postcard instead of a reading. Retry.",
    "Celestial formatting error. Give it another shot.",
  ],
};
