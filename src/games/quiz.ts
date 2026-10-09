import { questions } from "../data/questions.js";
import { pick } from "./helpers.js";
import { normalize } from "../utils/normalize.js";
import type { Game } from "./game-types.js";

export const quizFrom = (
  pool: readonly (typeof questions)[number][],
): Game => ({
  create(recent) {
    const q = pick(pool, recent, (q) => q.answer);
    return {
      answer: q.answer,
      acceptedAnswers: [q.correct.toLowerCase(), normalize(q.answer)],
      prompt: `🧠 QUIZ\n\n${q.question}\n\n${q.options.map((s, i) => `${"ABCD"[i]}) ${s}`).join("\n")}\n\nResponda A, B, C ou D, ou escreva a alternativa por extenso.`,
      data: { options: q.options },
    };
  },
  guess(r, t) {
    const input = normalize(t);
    // Prioriza letras como alternativas; palavras devem corresponder exatamente a uma opção.
    const options = r.data.options || [];
    const valid = /^[a-d]$/.test(input) || options.some((s) => normalize(s) === input);
    const win = valid && r.acceptedAnswers.includes(input);
    return { valid, win };
  },
});
export const quiz = quizFrom(questions);
