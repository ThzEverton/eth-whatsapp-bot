import { randomInt } from "node:crypto";
import { integer } from "../utils/normalize.js";
import type { Game } from "./game-types.js";
export const guessNumber = (min: number, max: number): Game => ({
  create() {
    if (
      !Number.isSafeInteger(min) ||
      !Number.isSafeInteger(max) ||
      min >= max ||
      min < 1 ||
      max > 1000000
    )
      throw new Error("Intervalo inválido");
    const answer = String(randomInt(min, max + 1));
    return {
      answer,
      acceptedAnswers: [answer],
      prompt: `🔢 ADIVINHE O NÚMERO\n\nNúmero inteiro entre ${min} e ${max}. Quem acertar primeiro vence!`,
      data: { min, max },
    };
  },
  guess(r, t) {
    const n = integer(t, r.data.min!, r.data.max!);
    return {
      valid: n !== undefined,
      win: n !== undefined && String(n) === r.answer,
    };
  },
});
