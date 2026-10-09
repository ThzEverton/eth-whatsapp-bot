import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GameManager } from "../games/game-manager.js";
import { ConfigStore } from "../config/settings.js";
import type { Incoming, Send, GameType } from "../games/game-types.js";
const A = "123@g.us",
  B = "456@g.us",
  U = "5511@s.whatsapp.net",
  V = "5522@s.whatsapp.net";
let config: ConfigStore,
  manager: GameManager,
  sent: { jid: string; text: string; mentions?: string[] }[],
  send: Send,
  seq: number;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(2000000000000);
  seq = 0;
  sent = [];
  config = new ConfigStore([A, B]);
  const c = config.get(A);
  c.cooldown = 0;
  c.guessCooldown = 0;
  config.set(A, c);
  config.set(B, c);
  send = vi.fn(async (jid, text, mentions) => {
    sent.push({ jid, text, mentions });
    return `q${++seq}`;
  });
  manager = new GameManager(config, send);
  manager.ready = true;
});
afterEach(() => {
  manager.shutdown();
  vi.useRealTimers();
});
const msg = (
  text: string,
  senderId = U,
  groupId = A,
  id = `m${++seq}`,
): Incoming => ({
  text,
  senderId,
  groupId,
  messageId: id,
  timestamp: Date.now(),
});
const answer = () => manager.session(A)!.acceptedAnswers![0]!;
const wins = () => sent.filter((m) => m.text.includes("TEMOS UM VENCEDOR"));
describe("Integridade das partidas", () => {
  it("reserva uma única partida com solicitações simultâneas", async () => {
    await Promise.all([
      manager.request(A, U, "quiz"),
      manager.request(A, V, "numero"),
    ]);
    expect(sent.filter((m) => m.text.includes("Tempo:"))).toHaveLength(1);
    expect(manager.session(A)?.gameType).toBe("quiz");
  });
  it("reserva permanece durante envio assíncrono", async () => {
    let release!: (s: string) => void;
    const slow = vi.fn(() => new Promise<string>((r) => (release = r)));
    manager = new GameManager(config, slow);
    manager.ready = true;
    const p = manager.request(A, U, "quiz");
    await Promise.resolve();
    expect(manager.session(A)?.status).toBe("STARTING");
    const p2 = manager.request(A, V, "numero");
    release("q");
    await p;
    await Promise.resolve();
    release("busy");
    await p2;
    expect(manager.session(A)?.gameType).toBe("quiz");
  });
  it("duas respostas corretas têm um único vencedor", async () => {
    await manager.request(A, U, "quiz");
    await Promise.all([
      manager.answer(msg(answer(), U)),
      manager.answer(msg(answer(), V)),
    ]);
    expect(wins()).toHaveLength(1);
    expect(wins()[0]!.mentions).toEqual([U]);
    expect(manager.session(A)).toBeUndefined();
  });
  it("duas respostas por extenso têm somente um vencedor", async () => {
    await manager.request(A, U, "quiz");
    const text = manager.session(A)!.answer!;
    await Promise.all([
      manager.answer(msg(text, U)),
      manager.answer(msg(text, V)),
    ]);
    expect(wins()).toHaveLength(1);
    expect(manager.session(A)).toBeUndefined();
  });
  it("aceita resposta rapida no mesmo segundo em que a pergunta aparece", async () => {
    vi.setSystemTime(2000000000450);
    await manager.request(A, U, "quiz");
    const correct = answer();
    await manager.answer(msg(correct));
    expect(wins()).toHaveLength(1);
    expect(manager.session(A)).toBeUndefined();
  });
  it("duplicata de resposta gera uma vitória", async () => {
    await manager.request(A, U, "quiz");
    const m = msg(answer());
    await Promise.all([manager.answer(m), manager.answer(m)]);
    expect(wins()).toHaveLength(1);
  });
  it("erro não encerra nem revela resposta", async () => {
    await manager.request(A, U, "quiz");
    const wrong = "abcd".split("").find((x) => x !== answer())!;
    await manager.answer(msg(wrong));
    expect(manager.session(A)?.status).toBe("ACTIVE");
    expect(sent).toHaveLength(1);
  });
  it("resposta após deadline é rejeitada mesmo antes de callback do timer", async () => {
    await manager.request(A, U, "quiz");
    const a = answer();
    vi.setSystemTime(Date.now() + 61000);
    await manager.answer(msg(a));
    expect(wins()).toHaveLength(0);
    expect(manager.session(A)).toBeUndefined();
  });
  it("timeout anterior não encerra próxima partida", async () => {
    await manager.request(A, U, "quiz");
    await manager.cancel(A);
    await manager.request(A, U, "forca");
    const id = manager.session(A)!.gameId;
    await vi.advanceTimersByTimeAsync(61000);
    expect(manager.session(A)?.gameId).toBe(id);
    expect(manager.session(A)?.status).toBe("ACTIVE");
  });
  it("grupos são independentes", async () => {
    await Promise.all([
      manager.request(A, U, "quiz"),
      manager.request(B, V, "numero"),
    ]);
    await manager.answer(msg(answer()));
    expect(manager.session(A)).toBeUndefined();
    expect(manager.session(B)?.status).toBe("ACTIVE");
  });
  it("mensagem anterior à publicação é ignorada", async () => {
    await manager.request(A, U, "quiz");
    await manager.answer({ ...msg(answer()), timestamp: Date.now() - 1000 });
    expect(manager.session(A)?.status).toBe("ACTIVE");
  });
  it("falha no envio cancela reserva", async () => {
    manager = new GameManager(config, async () => {
      throw new Error("offline");
    });
    manager.ready = true;
    await manager.request(A, U, "quiz");
    expect(manager.session(A)).toBeUndefined();
  });
  it("forca termina com palavra completa", async () => {
    await manager.request(A, U, "forca");
    await manager.answer(msg(manager.session(A)!.answer!));
    expect(wins()).toHaveLength(1);
  });
  it("última letra correta da forca declara vencedor", async () => {
    await manager.request(A, U, "forca");
    for (const c of new Set(manager.session(A)!.answer!))
      await manager.answer(msg(c));
    expect(wins()).toHaveLength(1);
  });
  it("forca perde após seis letras erradas", async () => {
    await manager.request(A, U, "forca");
    const word = manager.session(A)!.answer!;
    for (const c of [..."abcdefghijklmnopqrstuvwxyz"]
      .filter((c) => !word.includes(c))
      .slice(0, 6))
      await manager.answer(msg(c));
    expect(manager.session(A)).toBeUndefined();
    expect(wins()).toHaveLength(0);
    expect(sent.at(-1)!.text).toContain("sem vencedor");
  });
  it("letra repetida não gasta tentativa", async () => {
    await manager.request(A, U, "forca");
    const c = [..."abcdefghijklmnopqrstuvwxyz"].find(
      (c) => !manager.session(A)!.answer!.includes(c),
    )!;
    await manager.answer(msg(c));
    await manager.answer(msg(c));
    expect(manager.session(A)?.roundData?.data.remaining).toBe(5);
  });
  it("múltiplos encerramentos geram um resultado", async () => {
    await manager.request(A, U, "quiz");
    await Promise.all([
      manager.cancel(A),
      manager.cancel(A),
      manager.cancel(A),
    ]);
    expect(sent.filter((m) => m.text.includes("encerrada pelo"))).toHaveLength(
      1,
    );
  });
  it("cooldown individual não pode ser contornado com IDs diferentes", async () => {
    const c = config.get(A);
    c.guessCooldown = 2;
    config.set(A, c);
    await manager.request(A, U, "quiz");
    const a = answer();
    const wrong = "abcd".split("").find((x) => x !== a)!;
    await Promise.all([
      manager.answer(msg(wrong)),
      manager.answer(msg(a)),
      manager.answer(msg(a)),
    ]);
    expect(wins()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    await manager.answer(msg(a));
    expect(wins()).toHaveLength(1);
  });
  it("novo gerenciador não recupera partidas", async () => {
    await manager.request(A, U, "quiz");
    const fresh = new GameManager(config, send);
    fresh.ready = true;
    expect(fresh.session(A)).toBeUndefined();
    await fresh.answer(msg(answer()));
    expect(wins()).toHaveLength(0);
    fresh.shutdown();
  });
  it("resposta citando rodada antiga não ganha nova", async () => {
    await manager.request(A, U, "quiz");
    const old = manager.session(A)!;
    await manager.cancel(A);
    await vi.advanceTimersByTimeAsync(1000);
    await manager.request(A, U, "quiz");
    await manager.answer({ ...msg(answer()), quotedId: old.questionMessageId });
    expect(wins()).toHaveLength(0);
  });
  it("evento na fila da sessão antiga não finaliza nova", async () => {
    await manager.request(A, U, "quiz");
    const p = manager.cancel(A),
      p2 = manager.request(A, U, "quiz"),
      p3 = manager.answer(msg(answer()));
    await Promise.all([p, p2, p3]);
    expect(manager.session(A)?.status).toBe("ACTIVE");
    expect(wins()).toHaveLength(0);
  });
  it("vitória fica atômica enquanto envio aguarda rede", async () => {
    let release!: () => void;
    const transport: Send = async (jid, text, mentions) => {
      sent.push({ jid, text, mentions });
      if (text.includes("TEMOS")) await new Promise<void>((r) => (release = r));
      return `q${++seq}`;
    };
    manager = new GameManager(config, transport);
    manager.ready = true;
    await manager.request(A, U, "quiz");
    const a = answer();
    const p = manager.answer(msg(a));
    await Promise.resolve();
    expect(manager.session(A)?.status).toBe("FINISHING");
    const p2 = manager.answer(msg(a, V));
    release();
    await Promise.all([p, p2]);
    expect(wins()).toHaveLength(1);
  });
  it("falha ao enviar vitória não libera outro vencedor", async () => {
    manager = new GameManager(config, async (jid, text) => {
      sent.push({ jid, text });
      if (text.includes("TEMOS")) throw new Error("send failed");
      return "q";
    });
    manager.ready = true;
    await manager.request(A, U, "quiz");
    const a = answer();
    await Promise.all([manager.answer(msg(a)), manager.answer(msg(a, V))]);
    expect(wins()).toHaveLength(1);
    expect(manager.session(A)).toBeUndefined();
  });
  it("seleção bloqueia outros menus e expira", async () => {
    await Promise.all([manager.request(A, U), manager.request(A, V)]);
    expect(sent.filter((m) => m.text.includes("CENTRAL"))).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(manager.session(A)).toBeUndefined();
  });
  it("modalidade selecionada começa na mesma reserva", async () => {
    await manager.request(A, U);
    const id = manager.session(A)?.gameId;
    await manager.request(A, V, "numero");
    expect(manager.session(A)?.gameId).toBe(id);
    expect(manager.session(A)?.status).toBe("ACTIVE");
  });
  it("desconexão cancela partidas e bloqueia novos jogos", async () => {
    await manager.request(A, U, "quiz");
    manager.disconnect();
    await manager.request(B, U, "quiz");
    expect(manager.session(A)).toBeUndefined();
    expect(manager.session(B)).toBeUndefined();
  });
  it("desconexão durante publicação não deixa rodada invisível", async () => {
    let release!: (s: string) => void;
    manager = new GameManager(config, () => new Promise((r) => (release = r)));
    manager.ready = true;
    const p = manager.request(A, U, "quiz");
    await Promise.resolve();
    manager.disconnect();
    release("q");
    await p;
    expect(manager.session(A)).toBeUndefined();
  });
  it("intervalo entre partidas é respeitado", async () => {
    const c = config.get(A);
    c.cooldown = 20;
    config.set(A, c);
    await manager.request(A, U, "quiz");
    await manager.cancel(A);
    await manager.request(A, V, "numero");
    expect(manager.session(A)).toBeUndefined();
    await vi.advanceTimersByTimeAsync(20000);
    await manager.request(A, V, "numero");
    expect(manager.session(A)?.status).toBe("ACTIVE");
  });
  it("não processa grupo não autorizado", async () => {
    await manager.request("789@g.us", U, "quiz");
    expect(sent).toHaveLength(0);
  });
  it("nenhuma resposta é aceita durante STARTING", async () => {
    let release!: (s: string) => void;
    manager = new GameManager(config, () => new Promise((r) => (release = r)));
    manager.ready = true;
    const p = manager.request(A, U, "quiz");
    await Promise.resolve();
    await manager.answer(msg(answer()));
    expect(manager.session(A)?.status).toBe("STARTING");
    release("q");
    await p;
  });
  it("resposta antiga sem citação não encerra nova sessão", async () => {
    await manager.request(A, U, "quiz");
    const m = msg(answer());
    await manager.cancel(A);
    await vi.advanceTimersByTimeAsync(1000);
    await manager.request(A, U, "quiz");
    await manager.answer({ ...m, text: answer() });
    expect(wins()).toHaveLength(0);
  });
  it.each(["numero", "palavra", "emoji"] as GameType[])(
    "%s aceita resposta válida e encerra",
    async (type) => {
      await manager.request(A, U, type);
      await manager.answer(msg(answer()));
      expect(wins()).toHaveLength(1);
    },
  );
});
