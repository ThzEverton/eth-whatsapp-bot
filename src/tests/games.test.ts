import { it, expect } from "vitest";
import { questions } from "../data/questions.js";
import { quiz } from "../games/quiz.js";
import { guessNumber } from "../games/guess-number.js";
import { scramble } from "../games/scrambled-word.js";
import { emojiGame } from "../games/emoji-game.js";
import { integer, normalize } from "../utils/normalize.js";
import { MessageDedup } from "../services/message-dedup.js";
it("coleção tem ao menos 100 perguntas distintas e alternativas válidas", () => {
  expect(questions.length).toBeGreaterThanOrEqual(100);
  expect(new Set(questions.map((q) => q.question)).size).toBe(questions.length);
  for (const q of questions) {
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options).size).toBe(4);
    expect(q.options["ABCD".indexOf(q.correct)]).toBe(q.answer);
  }
});
it("quiz evita perguntas recentes", () => {
  const r = quiz.create([]);
  for (let i = 0; i < 30; i++)
    expect(quiz.create([r.answer]).answer).not.toBe(r.answer);
});
it("números rejeitam textos, decimais e valores fora do intervalo", () => {
  const g = guessNumber(1, 100),
    r = g.create([]);
  for (const t of ["1e2", "12abc", "1.0", "+1", "-1", "101", "0", "Infinity"])
    expect(g.guess(r, t).valid).toBe(false);
  expect(() => guessNumber(100, 1).create([])).toThrow();
});
it("embaralhamento difere do original e preserva letras", () => {
  for (let i = 0; i < 100; i++) {
    const s = scramble("banana");
    expect(s).not.toBe("banana");
    expect([...s].sort()).toEqual([..."banana"].sort());
  }
});
it("emoji aceita só aliases explícitos normalizados", () => {
  const r = emojiGame.create([]);
  expect(emojiGame.guess(r, r.answer.toUpperCase()).win).toBe(true);
  expect(emojiGame.guess(r, r.answer + " errado").win).toBe(false);
});
it("normalização unicode e números estritos", () => {
  expect(normalize("  JÚPITER  ")).toBe("jupiter");
  expect(integer("90x", 10, 600)).toBeUndefined();
});
it("dedup tem limite e expiração", () => {
  const d = new MessageDedup(2, 100);
  expect(d.seen("a", 0)).toBe(false);
  expect(d.seen("a", 1)).toBe(true);
  d.seen("b", 1);
  d.seen("c", 2);
  expect(d.seen("a", 3)).toBe(false);
  expect(d.seen("a", 104)).toBe(false);
});
