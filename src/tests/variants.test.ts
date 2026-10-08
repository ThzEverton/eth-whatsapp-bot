import { describe, it, expect } from "vitest";
import { themes, validVariant } from "../data/variants.js";
import { gameTypes } from "../games/game-types.js";
import { gameFor } from "../games/registry.js";
import { defaults } from "../config/settings.js";
import { routeGame } from "../bot/command-router.js";
import { GameManager } from "../games/game-manager.js";
import { ConfigStore } from "../config/settings.js";
import { PermissionService } from "../services/permission-service.js";

describe("21 varia??es por modalidade", () => {
  it("tem IDs ?nicos, 21 temas e vocabul?rio exclusivo com pistas", () => {
    expect(themes).toHaveLength(21);
    expect(new Set(themes.map((t) => t.id)).size).toBe(21);
    for (const theme of themes) {
      expect(theme.entries.length).toBeGreaterThanOrEqual(4);
      expect(new Set(theme.entries.map((e) => e.word)).size).toBe(
        theme.entries.length,
      );
      for (const e of theme.entries) {
        expect(e.hint.length).toBeGreaterThan(10);
        expect(e.emoji).toBeTruthy();
      }
    }
    expect(validVariant("desconhecido")).toBe(false);
  });
  for (const type of gameTypes)
    it(`${type}: todas as varia??es produzem partidas solucion?veis`, () => {
      const prompts = new Set<string>();
      for (const theme of themes) {
        const settings = defaults();
        settings.variants![type] = theme.id;
        const game = gameFor(type, settings);
        const round = game.create([]);
        expect(round.prompt).toContain(theme.name);
        expect(
          game.guess(
            round,
            type === "quiz" ? round.acceptedAnswers[0]! : round.answer,
          ).win,
        ).toBe(true);
        expect(game.guess(round, "resposta errada").win).not.toBe(true);
        prompts.add(round.prompt);
      }
      expect(prompts.size).toBe(21);
    });
  it("/jogo aceita tema por rodada e rejeita tema desconhecido", async () => {
    const store = new ConfigStore(["123@g.us"]);
    const sent: string[] = [];
    const manager = new GameManager(store, async (_, text) => {
      sent.push(text);
      return "question";
    });
    manager.ready = true;
    const base = {
      groupId: "123@g.us",
      senderId: "1@s.whatsapp.net",
      messageId: "m1",
      timestamp: Date.now(),
    };
    try {
      await routeGame({ ...base, text: "/jogo quiz inexistente" }, manager);
      expect(manager.session(base.groupId)).toBeUndefined();
      await routeGame({ ...base, text: "/jogo quiz espaco" }, manager);
      expect(manager.session(base.groupId)?.status).toBe("ACTIVE");
      expect(sent[0]).toContain("Espa?o");
      expect(store.get(base.groupId).variants?.quiz).toBe("classico");
    } finally {
      manager.shutdown();
    }
  });
  it("somente a conta autenticada assume a propriedade quando n?o h? propriet?rio fixo", () => {
    let self: string | undefined;
    const permission = new PermissionService(() => self);
    expect(permission.isOwner("")).toBe(false);
    expect(permission.isOwner("5511999999999@s.whatsapp.net")).toBe(false);
    self = "5511999999999:12@s.whatsapp.net";
    expect(permission.isOwner("5511999999999@s.whatsapp.net")).toBe(true);
    expect(permission.isOwner("5511888888888@s.whatsapp.net")).toBe(false);
  });
});
