import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConfigStore } from "../config/settings.js";
import { ConfigCommand } from "../commands/config.js";
import { PermissionService } from "../services/permission-service.js";
import { GameManager } from "../games/game-manager.js";
import { MessageHandler } from "../bot/message-handler.js";
import type { WAMessage } from "@whiskeysockets/baileys";
import type { Send } from "../games/game-types.js";
const A = "123@g.us",
  OWNER = "5511@s.whatsapp.net",
  USER = "5522@s.whatsapp.net";
let store: ConfigStore,
  manager: GameManager,
  admin: ConfigCommand,
  handler: MessageHandler,
  send: Send;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(2000000000000);
  store = new ConfigStore([A]);
  send = vi.fn(async () => "q");
  manager = new GameManager(store, send);
  manager.ready = true;
  admin = new ConfigCommand(new PermissionService(OWNER), manager, send);
  handler = new MessageHandler(manager, admin, async () => null);
});
afterEach(() => {
  manager.shutdown();
  vi.useRealTimers();
});
const raw = (text = "/jogo quiz", sender = USER, chat = A): WAMessage => ({
  key: { id: "m1", remoteJid: chat, participant: sender, fromMe: false },
  message: { conversation: text },
  messageTimestamp: Date.now() / 1000,
});
describe("Autorização e entrada", () => {
  it("usuário comum não altera config", async () => {
    await admin.execute(A, USER, ["jogos", "off"]);
    expect(store.get(A).enabled).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });
  it("administrador do grupo não recebe privilégio", async () => {
    await handler.handle(
      { ...raw("/config jogos off"), pushName: "Administrador" },
      "notify",
    );
    expect(store.get(A).enabled).toBe(true);
  });
  it("proprietário autenticado altera config", async () => {
    await admin.execute(A, OWNER, ["jogos", "off"]);
    expect(store.get(A).enabled).toBe(false);
  });
  it("nome do proprietário não autoriza outro remetente", async () => {
    await handler.handle(
      { ...raw("/config jogos off"), pushName: OWNER },
      "notify",
    );
    expect(store.get(A).enabled).toBe(true);
  });
  it("LID mapeado autentica proprietário", async () => {
    handler = new MessageHandler(manager, admin, async () => OWNER);
    await handler.handle(raw("/config jogos off", "777@lid"), "notify");
    expect(store.get(A).enabled).toBe(false);
  });
  it("LID não resolvido falha com segurança", async () => {
    await handler.handle(raw("/config jogos off", "777@lid"), "notify");
    expect(store.get(A).enabled).toBe(true);
  });
  it("participantAlt não verificado não concede privilégio", async () => {
    const m = raw("/config jogos off", "777@lid");
    m.key.participantAlt = OWNER;
    await handler.handle(m, "notify");
    expect(store.get(A).enabled).toBe(true);
  });
  it("LID explicitamente cadastrado é autorizado", async () => {
    admin = new ConfigCommand(new PermissionService("777@lid"), manager, send);
    await admin.execute(A, "777@lid", ["jogos", "off"]);
    expect(store.get(A).enabled).toBe(false);
  });
  it("proprietário LID continua autorizado quando PN é resolvido", async () => {
    admin = new ConfigCommand(new PermissionService("777@lid"), manager, send);
    handler = new MessageHandler(manager, admin, async () => OWNER);
    await handler.handle(raw("/config jogos off", "777@lid"), "notify");
    expect(store.get(A).enabled).toBe(false);
  });
  it("evento aguardando identidade não cruza uma reconexão", async () => {
    let release!: (s: string) => void;
    handler = new MessageHandler(
      manager,
      admin,
      () => new Promise((r) => (release = r)),
    );
    const pending = handler.handle(
      raw("/config jogos off", "777@lid"),
      "notify",
    );
    manager.disconnect();
    manager.ready = true;
    release(OWNER);
    await pending;
    expect(store.get(A).enabled).toBe(true);
  });
  it("LID sem mapeamento participa dos jogos sem receber privilégios", async () => {
    await handler.handle(raw("/jogo quiz", "777@lid"), "notify");
    expect(manager.session(A)?.startedBy).toBe("777@lid");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("mantém identidade de jogo quando o mapeamento LID aparece depois", async () => {
    const resolve = vi.fn(async (): Promise<string | null> => null);
    handler = new MessageHandler(manager, admin, resolve);
    const request = vi.spyOn(manager, "request");
    await handler.handle(raw("/jogo", "777@lid"), "notify");
    resolve.mockResolvedValue(USER);
    const next = raw("/jogo quiz", "777@lid");
    next.key.id = "m2";
    await handler.handle(next, "notify");
    expect(request.mock.calls.map(call => call[1])).toEqual(["777@lid", "777@lid"]);
  });
  it.each(["notify", "append"])("aceita /jogo recente da conta proprietária em %s sem loop", async type => {
    handler = new MessageHandler(manager, admin, async () => null, () => {}, () => OWNER);
    const m = raw();
    m.key.fromMe = true;
    await handler.handle(m, type);
    expect(manager.session(A)?.startedBy).toBe(OWNER);
    const response = raw("Pergunta do bot");
    response.key.fromMe = true;
    response.key.id = "response";
    await handler.handle(response, type);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("mensagem do bot é ignorada", async () => {
    const m = raw();
    m.key.fromMe = true;
    await handler.handle(m, "notify");
    expect(manager.session(A)).toBeUndefined();
  });
  it("histórico append e requestId são ignorados", async () => {
    await handler.handle(raw(), "append");
    await handler.handle(raw(), "notify", "sync");
    expect(send).not.toHaveBeenCalled();
  });
  it("mensagem anterior ao boot é ignorada", async () => {
    const m = raw();
    m.messageTimestamp = Date.now() / 1000 - 1;
    await handler.handle(m, "notify");
    expect(send).not.toHaveBeenCalled();
  });
  it("duplicata de comando é ignorada", async () => {
    await handler.handle(raw(), "notify");
    await handler.handle(raw(), "notify");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("mensagem privada de jogo é ignorada", async () => {
    await handler.handle(raw("/jogo quiz", USER, USER), "notify");
    expect(send).not.toHaveBeenCalled();
  });
  it("comando privado autorizado permite gerir grupo", async () => {
    await handler.handle(
      raw(`/config grupo ${A} jogos off`, OWNER, OWNER),
      "notify",
    );
    expect(store.get(A).enabled).toBe(false);
  });
  it("grupo não autorizado é ignorado", async () => {
    await handler.handle(raw("/jogo quiz", USER, "456@g.us"), "notify");
    expect(send).not.toHaveBeenCalled();
  });
  it("conteúdo editado ou revogado não aciona comando", async () => {
    await handler.handle(
      {
        ...raw(),
        message: {
          protocolMessage: { editedMessage: { conversation: "/jogo quiz" } },
        },
      },
      "notify",
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("malformados não derrubam processo", async () => {
    for (const m of [
      null,
      {},
      { key: {} },
      { ...raw(), message: { conversation: 12 } },
      { ...raw(), messageTimestamp: "NaN" },
    ])
      await expect(
        handler.handle(m as WAMessage, "notify"),
      ).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
  it("texto excessivo não é processado", async () => {
    await handler.handle(raw("a".repeat(501)), "notify");
    expect(send).not.toHaveBeenCalled();
  });
  it("comando malformado e texto normal não alteram config", async () => {
    for (const text of [
      "config jogos off",
      "/config jogos off extra",
      "/config  jogos off",
      "/config jogos\noff",
    ]) {
      const m = raw(text, OWNER);
      m.key.id = text;
      await handler.handle(m, "notify");
    }
    expect(store.get(A).enabled).toBe(true);
  });
  it("valida limites de tempo e intervalo", async () => {
    for (const args of [
      ["tempo", "9"],
      ["cooldown", "-1"],
      ["intervalo", "100", "1"],
      ["tempo", "90x"],
    ])
      await admin.execute(A, OWNER, args);
    expect(store.get(A).duration.quiz).toBe(60);
    expect(store.get(A).cooldown).toBe(20);
    expect(store.get(A).numberMax).toBe(100);
  });
  it("configurações não vazam entre grupos", async () => {
    store.groups.add("456@g.us");
    await admin.execute(A, OWNER, ["tempo", "quiz", "90"]);
    expect(store.get(A).duration.quiz).toBe(90);
    expect(store.get("456@g.us").duration.quiz).toBe(60);
  });
});
