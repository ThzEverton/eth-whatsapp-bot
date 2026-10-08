import { words } from "../data/words.js";
import { normalize } from "../utils/normalize.js";
import { pick } from "./helpers.js";
import type { Game, GameRound } from "./game-types.js";
export const board = (r: GameRound) =>
  `Palavra: ${[...r.data.word!].map((c) => (r.data.letters!.includes(c) ? c.toUpperCase() : "_")).join(" ")}\nTentativas restantes: ${r.data.remaining}\nLetras: ${r.data.letters!.join(", ").toUpperCase() || "nenhuma"}`;
export const hangmanFrom = (pool: readonly (typeof words)[number][]): Game => ({
  create(recent) {
    const w = pick(pool, recent, (w) => w.word);
    const r: GameRound = {
      answer: w.word,
      acceptedAnswers: [normalize(w.word)],
      prompt: "",
      data: { word: normalize(w.word), letters: [], remaining: 6 },
    };
    r.prompt = `📝 FORCA COLETIVA\n\n${board(r)}\n\nDica: ${w.hint}\nEnvie uma letra ou a palavra completa.`;
    return r;
  },
  guess(r, text) {
    const t = normalize(text);
    if (!/^[a-z]+$/.test(t)) return { valid: false };
    if (t === r.data.word) return { valid: true, win: true };
    if (t.length !== 1) return { valid: true };
    if (r.data.letters!.includes(t)) return { valid: false };
    r.data.letters!.push(t);
    if (!r.data.word!.includes(t)) r.data.remaining!--;
    return {
      valid: true,
      win: [...r.data.word!].every((c) => r.data.letters!.includes(c)),
      loss: r.data.remaining === 0,
      update: board(r),
    };
  },
});
export const hangman = hangmanFrom(words);
