/**
 * Output Validator Tests
 *
 * Tests the "Not Creepy" validator that ensures AI outputs
 * don't contain surveillance language or platform mentions.
 *
 * Location: lib/ai/outputValidator.ts
 */

import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock OpenAI client before importing outputValidator
vi.mock("@/lib/openai/client", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  OPENAI_MODELS: {
    fast: "gpt-4o-mini",
  },
}));

// Mock metrics to avoid side effects
vi.mock("@/lib/ai/metrics", () => ({
  incrementValidatorViolation: vi.fn(),
}));

import {
  validateOutputNotCreepy,
  validateJsonOutputNotCreepy,
} from "@/lib/ai/outputValidator";

describe("Output Validator", () => {
  describe("validateOutputNotCreepy()", () => {
    describe("passes clean content", () => {
      it("allows generic astrological content", () => {
        const text = "Your cosmic energy today suggests a time for reflection. Venus aligns with your natal moon, bringing emotional clarity.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(true);
        expect(result.matches).toHaveLength(0);
      });

      it("allows personality descriptions without surveillance language", () => {
        const text = "You tend to express yourself with warmth and creativity. Your communication style reflects a natural curiosity about the world.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(true);
        expect(result.matches).toHaveLength(0);
      });

      it("allows references to energy and patterns", () => {
        const text = "Your current energy pattern shows a blend of introspection and outward expression. This cosmic rhythm suggests...";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(true);
        expect(result.matches).toHaveLength(0);
      });
    });

    describe("blocks surveillance language", () => {
      it("blocks 'I saw your posts'", () => {
        const text = "I saw your posts about feeling stressed. The stars suggest taking a break.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });

      it("blocks 'I noticed your content'", () => {
        const text = "I noticed your content has been more reflective lately.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });

      it("blocks 'from what I can see'", () => {
        const text = "From what I can see in your activity, you've been busy.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });

      it("blocks 'I've been watching'", () => {
        const text = "I've been watching your journey and noticed growth.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });

      it("blocks 'you posted'", () => {
        const text = "When you posted about your new job, it aligned with Jupiter's transit.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });

      it("blocks 'in your recent posts'", () => {
        const text = "In your recent posts, I see a theme of transformation.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });

      it("blocks 'based on your posts'", () => {
        const text = "Based on your posts, your Mars energy is strong.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });

      it("blocks 'your social media'", () => {
        const text = "Your social media presence reflects your Mercury placement.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });
    });

    describe("blocks platform mentions", () => {
      it("blocks 'Instagram'", () => {
        const text = "Your Instagram aesthetic aligns with your Venus in Libra.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches).toContain("Instagram");
      });

      it("blocks 'Facebook'", () => {
        const text = "Your Facebook updates show a nurturing Cancer moon.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches).toContain("Facebook");
      });

      it("blocks 'Twitter'", () => {
        const text = "Your Twitter threads reveal your Gemini rising.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches).toContain("Twitter");
      });

      it("blocks 'TikTok'", () => {
        const text = "Your TikTok energy is very Leo sun.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches).toContain("TikTok");
      });

      it("blocks 'Reddit'", () => {
        const text = "Your Reddit comments show analytical Virgo energy.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches).toContain("Reddit");
      });

      it("blocks abbreviations like 'IG'", () => {
        const text = "Your IG presence is very artistic.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });
    });

    describe("blocks specific post references", () => {
      it("blocks 'your last post'", () => {
        const text = "Your last post about change reflects Saturn's influence.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });

      it("blocks 'when you posted about'", () => {
        const text = "When you posted about your move, Neptune was active.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });

      it("blocks 'that post you'", () => {
        const text = "That post you shared about self-care was very Pisces.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(0);
      });
    });

    describe("handles warnings", () => {
      it("flags but allows 'your online presence'", () => {
        const text = "Your online presence tends to be thoughtful.";
        const result = validateOutputNotCreepy(text);
        // This is a warning, not a block
        expect(result.warnings.length).toBeGreaterThan(0);
        // But it's still valid (warnings don't fail validation)
        expect(result.valid).toBe(true);
      });

      it("flags 'digital footprint'", () => {
        const text = "Your digital footprint shows creativity.";
        const result = validateOutputNotCreepy(text);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.valid).toBe(true);
      });
    });

    describe("handles edge cases", () => {
      it("handles empty string", () => {
        const result = validateOutputNotCreepy("");
        expect(result.valid).toBe(true);
        expect(result.matches).toHaveLength(0);
      });

      it("handles very long text without matches", () => {
        const text = "The cosmos ".repeat(1000) + "aligns in your favor.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(true);
      });

      it("case insensitive matching", () => {
        const text = "I SAW YOUR POSTS about the eclipse.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
      });

      it("catches multiple violations", () => {
        const text = "I saw your posts on Instagram about your Twitter thoughts.";
        const result = validateOutputNotCreepy(text);
        expect(result.valid).toBe(false);
        expect(result.matches.length).toBeGreaterThan(1);
      });
    });
  });

  describe("validateJsonOutputNotCreepy()", () => {
    it("validates all string values in nested object", () => {
      const obj = {
        personalNarrative: "I saw your posts about growth.",
        tarot: {
          guidance: "Your cosmic energy is rising.",
        },
      };
      const result = validateJsonOutputNotCreepy(obj);
      expect(result.valid).toBe(false);
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it("passes clean nested object", () => {
      const obj = {
        personalNarrative: "Your cosmic energy suggests transformation.",
        tarot: {
          guidance: "Trust the cosmic rhythm.",
        },
        themes: ["growth", "creativity", "balance"],
      };
      const result = validateJsonOutputNotCreepy(obj);
      expect(result.valid).toBe(true);
    });

    it("handles arrays of strings", () => {
      const obj = {
        themes: ["growth", "I saw your Instagram", "creativity"],
      };
      const result = validateJsonOutputNotCreepy(obj);
      expect(result.valid).toBe(false);
    });

    it("handles null and undefined values", () => {
      const obj = {
        text: "Valid cosmic text",
        empty: null,
        missing: undefined,
      };
      const result = validateJsonOutputNotCreepy(obj);
      expect(result.valid).toBe(true);
    });

    it("handles deeply nested structures", () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: "Your Facebook profile shows...",
            },
          },
        },
      };
      const result = validateJsonOutputNotCreepy(obj);
      expect(result.valid).toBe(false);
    });
  });
});
