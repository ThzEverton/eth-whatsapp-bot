import { questions } from "../data/questions.js";
import { pick } from "./helpers.js";
import type { Game } from "./game-types.js";
export const quizFrom = (
  pool: readonly (typeof questions)[number][],
): Game => ({
  create(recent) {
    const q = pick(pool, recent, (q) => q.answer);
    return {
      answer: q.answer,
      acceptedAnswers: [q.correct.toLowerCase()],
      prompt: `🧠 QUIZ\n\n${q.question}\n\n${q.options.map((s, i) => `${"ABCD"[i]}) ${s}`).join("\n")}\n\nResponda A, B, C ou D (ou /r C).`,
      data: {},
    };
  },
  guess(r, t) {
    return {
      valid: /^[a-d]$/i.test(t),
      win: r.acceptedAnswers.includes(t.toLowerCase()),
    };
  },
});
export const quiz = quizFrom(questions);
