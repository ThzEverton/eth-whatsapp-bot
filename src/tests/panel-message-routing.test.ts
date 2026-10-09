import { afterEach, expect, it, vi } from "vitest";
import { ConfigStore } from "../config/settings.js";
import { ConfigCommand } from "../commands/config.js";
import { PermissionService } from "../services/permission-service.js";
import { GameManager } from "../games/game-manager.js";
import { MessageHandler } from "../bot/message-handler.js";

const group = "120363430060189010@g.us";
const owner = "5511999999999@s.whatsapp.net";
afterEach(() => vi.useRealTimers());

function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(2000000000000);
  const sent: string[] = [];
  const manager = new GameManager(new ConfigStore([group]), async (_, text) => {
    sent.push(text);
    return "out-" + sent.length;
  });
  manager.ready = true;
  const handler = new MessageHandler(
    manager,
    new ConfigCommand(new PermissionService(owner), manager, async () => "configured"),
    async () => null,
    (error) => { throw error; },
    () => owner,
  );
  return { manager, handler, sent };
}

it("mensagem /jogo digitada no painel abre o menu sem eco do WhatsApp", async () => {
  const { manager, handler, sent } = setup();
  try {
    await handler.handlePanelSent(group, "typed-1", "/jogo");
    expect(sent.filter((text) => text.includes("CENTRAL"))).toHaveLength(1);
    expect(manager.session(group)?.status).toBe("SELECTING");
    // Uma notificacao de retorno da propria mensagem nao pode iniciar outra rodada.
    await handler.handle(
      {
        key: { remoteJid: group, id: "typed-1", fromMe: true },
        message: { conversation: "/jogo" },
        messageTimestamp: Date.now() / 1000,
      },
      "notify",
    );
    expect(sent.filter((text) => text.includes("CENTRAL"))).toHaveLength(1);
    expect(manager.session(group)?.status).toBe("SELECTING");
  } finally {
    manager.shutdown();
  }
});

it("resposta do painel encerra partida com um unico vencedor, sem loops", async () => {
  const { manager, handler, sent } = setup();
  try {
    await handler.handlePanelSent(group, "typed-1", "/jogo quiz");
    expect(manager.session(group)?.status).toBe("ACTIVE");
    const answer = manager.session(group)!.answer!;
    await handler.handlePanelSent(group, "typed-2", answer);
    expect(sent.filter((text) => text.includes("TEMOS UM VENCEDOR"))).toHaveLength(1);
    expect(manager.session(group)).toBeUndefined();
    await handler.handlePanelSent(group, "typed-2", answer);
    expect(sent.filter((text) => text.includes("TEMOS UM VENCEDOR"))).toHaveLength(1);
  } finally {
    manager.shutdown();
  }
});

it("texto comum enviado pelo painel nao inicia jogo ou respostas automaticas", async () => {
  const { manager, handler, sent } = setup();
  try {
    await handler.handlePanelSent(group, "typed-3", "Bom dia, pessoal!");
    expect(sent).toHaveLength(0);
    expect(manager.session(group)).toBeUndefined();
  } finally {
    manager.shutdown();
  }
});

it("painel nao inicia jogos em grupos nao autorizados", async () => {
  const { manager, handler, sent } = setup();
  try {
    await handler.handlePanelSent("456@g.us", "typed-4", "/jogo");
    expect(sent).toHaveLength(0);
  } finally {
    manager.shutdown();
  }
});
