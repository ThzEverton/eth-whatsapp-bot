import { quiz, quizFrom } from "./quiz.js";
import { guessNumber } from "./guess-number.js";
import { scrambledWord, scrambledWordFrom } from "./scrambled-word.js";
import { emojiGame, emojiGameFrom } from "./emoji-game.js";
import { hangman, hangmanFrom } from "./hangman.js";
import { themes } from "../data/variants.js";
import type { Game, GameType } from "./game-types.js";
import type { Settings } from "../config/settings.js";

const numberClues = [
  (n: number) =>
    `No zool?gico, cada recinto tem 4 animais. Ao todo s?o ${n * 4}. Quantos recintos existem?`,
  (n: number) =>
    `Cada cesta tem 6 frutas. Foram colhidas ${n * 6} frutas. Quantas cestas foram preenchidas?`,
  (n: number) =>
    `Um cozinheiro preparou ${n + 12} por??es e serviu 12. Quantas restam?`,
  (n: number) =>
    `Um atleta completou ${n * 3} km em voltas de 3 km. Quantas voltas completou?`,
  (n: number) =>
    `Uma nave levou ${n + 7} sondas e lan?ou 7. Quantas ficaram a bordo?`,
  (n: number) =>
    `Uma reserva tinha ${n * 5} mudas. Cada ?rea recebeu 5. Quantas ?reas foram plantadas?`,
  (n: number) =>
    `Cada compasso tem 4 tempos. A m?sica tem ${n * 4} tempos. Quantos compassos s?o?`,
  (n: number) =>
    `Cada bicicleta tem 2 rodas. A garagem tem ${n * 2} rodas. Quantas bicicletas s?o?`,
  (n: number) =>
    `Uma equipe fez ${n + 15} atendimentos; 15 pela manh?. Quantos fez ? tarde?`,
  (n: number) =>
    `Cada caixa guarda 8 teclados. H? ${n * 8} teclados. Quantas caixas s?o?`,
  (n: number) =>
    `Uma casa tinha ${n + 9} l?mpadas; 9 foram retiradas. Quantas restam?`,
  (n: number) =>
    `Cada pacote tem 10 l?pis. A escola recebeu ${n * 10} l?pis. Quantos pacotes recebeu?`,
  (n: number) =>
    `Choveu ${n + 20} mm em dois dias; no primeiro foram 20 mm. Quanto choveu no segundo?`,
  (n: number) =>
    `Cada canteiro tem 7 flores. H? ${n * 7} flores. Quantos canteiros s?o?`,
  (n: number) =>
    `Cada polvo tem 8 bra?os. Juntos t?m ${n * 8} bra?os. Quantos polvos s?o?`,
  (n: number) =>
    `Cada caixa cont?m 12 bombons. Foram vendidos ${n * 12} bombons. Quantas caixas s?o?`,
  (n: number) =>
    `Uma trilha tem ${n + 25} km. J? foram percorridos 25 km. Quantos faltam?`,
  (n: number) =>
    `Cada mesa recebeu 5 bal?es. Foram usados ${n * 5} bal?es. Quantas mesas foram decoradas?`,
  (n: number) => `Cada par tem 2 luvas. H? ${n * 2} luvas. Quantos pares s?o?`,
  (n: number) =>
    `Cada estojo guarda 9 ferramentas. H? ${n * 9} ferramentas. Quantos estojos s?o?`,
  (n: number) =>
    `Um est?dio vendeu ${n + 30} ingressos; 30 foram cancelados. Quantos continuam v?lidos?`,
];

export const gameFor = (type: GameType, s: Settings): Game => {
  const classic = {
    quiz,
    numero: guessNumber(s.numberMin, s.numberMax),
    palavra: scrambledWord,
    emoji: emojiGame,
    forca: hangman,
  }[type];
  const index = themes.findIndex((t) => t.id === s.variants?.[type]);
  const theme = themes[index];
  if (!theme) return classic;
  const pool = theme.entries.map((e) => ({ word: e.word, hint: e.hint }));
  const thematic = {
    quiz: quizFrom(
      theme.entries.map((e) => ({
        question: e.hint + ". Qual ? a resposta?",
        answer: e.word,
        options: theme.entries.map((v) => v.word),
        correct: "ABCD"[theme.entries.indexOf(e)]!,
      })),
    ),
    numero: classic,
    palavra: scrambledWordFrom(pool),
    emoji: emojiGameFrom(
      theme.entries.map((e) => ({
        answer: e.word,
        hint: e.hint,
        emoji: e.emoji,
        aliases: [],
      })),
    ),
    forca: hangmanFrom(pool),
  }[type];
  return {
    ...thematic,
    create(recent) {
      const round = thematic.create(recent);
      if (type === "numero")
        round.prompt = `DESAFIO NUM?RICO ? ${theme.name}\n\n${numberClues[index]!(Number(round.answer))}\nResponda com um inteiro entre ${s.numberMin} e ${s.numberMax}.`;
      else round.prompt = `Varia??o: ${theme.name}\n\n${round.prompt}`;
      return round;
    },
  };
};
