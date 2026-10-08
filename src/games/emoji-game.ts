import { emojis } from "../data/emojis.js";
import { normalize } from "../utils/normalize.js";
import { pick } from "./helpers.js";
import type { Game } from "./game-types.js";
export const emojiGameFrom = (
  pool: readonly (typeof emojis)[number][],
): Game => ({
  create(recent) {
    const e = pick(pool, recent, (e) => e.answer);
    return {
      answer: e.answer,
      acceptedAnswers: [e.answer, ...e.aliases].map(normalize),
      prompt: `🎭 ADIVINHE PELOS EMOJIS\n\n${e.emoji}\n\nDica: ${e.hint}`,
      data: {},
    };
  },
  guess(r, t) {
    return {
      valid: t.length > 0,
      win: r.acceptedAnswers.includes(normalize(t)),
    };
  },
});
export const emojiGame = emojiGameFrom(emojis);
