import { randomInt } from "node:crypto";
import { words } from "../data/words.js";
import { normalize } from "../utils/normalize.js";
import { pick } from "./helpers.js";
import type { Game } from "./game-types.js";
export function scramble(word: string) {
  const a = [...word];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  if (a.join("") === word) {
    const j = a.findIndex((c) => c !== a[0]);
    if (j < 0) throw new Error("Palavra não embaralhável");
    [a[0], a[j]] = [a[j]!, a[0]!];
  }
  return a.join("");
}
export const scrambledWordFrom = (
  pool: readonly (typeof words)[number][],
): Game => ({
  create(recent) {
    const w = pick(pool, recent, (w) => w.word);
    return {
      answer: w.word,
      acceptedAnswers: [normalize(w.word)],
      prompt: `🔤 PALAVRA EMBARALHADA\n\n${[...scramble(w.word)].join(" — ").toUpperCase()}\n\nDica: ${w.hint}`,
      data: {},
    };
  },
  guess(r, t) {
    return {
      valid: /^[\p{L} ]+$/u.test(t),
      win: r.acceptedAnswers.includes(normalize(t)),
    };
  },
});
export const scrambledWord = scrambledWordFrom(words);
