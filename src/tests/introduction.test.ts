import { it, expect, vi } from "vitest";
import { ConfigStore } from "../config/settings.js";
import { GameManager } from "../games/game-manager.js";
import { ConfigCommand } from "../commands/config.js";
import { PermissionService } from "../services/permission-service.js";
import { MessageHandler } from "../bot/message-handler.js";

it.each(["append", "ephemeral"] as const)(
  "processa /bot recente do celular em %s",
  async (variant) => {
    vi.useFakeTimers();
    vi.setSystemTime(2000000000000);
    const group = "123@g.us",
      owner = "5518930855282@s.whatsapp.net";
    const send = vi.fn(async () => "sent");
    const manager = new GameManager(new ConfigStore([group]), send);
    manager.ready = true;
    const handler = new MessageHandler(
      manager,
      new ConfigCommand(new PermissionService(owner), manager, send),
      async () => null,
      () => {},
      () => owner,
    );
    try {
      await handler.handle(
        {
          key: { remoteJid: group, id: "new-own", fromMe: true },
          message:
            variant === "ephemeral"
              ? { ephemeralMessage: { message: { conversation: "/bot" } } }
              : { conversation: "/bot" },
          messageTimestamp: Date.now() / 1000,
        },
        variant === "append" ? "append" : "notify",
      );
      expect(send).toHaveBeenCalledTimes(1);
      await handler.handle(
        {
          key: { remoteJid: group, id: "old-own", fromMe: true },
          message: { conversation: "/bot" },
          messageTimestamp: Date.now() / 1000 - 60,
        },
        "append",
      );
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      manager.shutdown();
      vi.useRealTimers();
    }
  },
);

it("apresenta /bot de participante LID sem mapeamento para número", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(2000000000000);
  const group = "123@g.us";
  const send = vi.fn(async () => "sent");
  const manager = new GameManager(new ConfigStore([group]), send);
  manager.ready = true;
  const admin = new ConfigCommand(
    new PermissionService("5518930855282@s.whatsapp.net"),
    manager,
    send,
  );
  const handler = new MessageHandler(manager, admin, async () => null);
  try {
    await handler.handle(
      {
        key: { remoteJid: group, participant: "123456@lid", id: "lid-intro" },
        message: { conversation: "/bot" },
        messageTimestamp: Date.now() / 1000,
      },
      "notify",
    );
    expect(send).toHaveBeenCalledWith(
      group,
      expect.stringContaining("bot de jogos da ETH"),
      undefined,
    );
    expect(manager.session(group)).toBeUndefined();
  } finally {
    manager.shutdown();
    vi.useRealTimers();
  }
});

it("apresenta ETH no /bot enviado pelo proprietário no próprio número, sem loop", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(2000000000000);
  const group = "123@g.us",
    owner = "5518930855282@s.whatsapp.net";
  const send = vi.fn(async () => "sent");
  const manager = new GameManager(new ConfigStore([group]), send);
  manager.ready = true;
  const admin = new ConfigCommand(new PermissionService(owner), manager, send);
  const handler = new MessageHandler(
    manager,
    admin,
    async () => null,
    () => {},
    () => owner,
  );
  try {
    await handler.handle(
      {
        key: { remoteJid: group, id: "own-command", fromMe: true },
        message: { conversation: "/bot" },
        messageTimestamp: Date.now() / 1000,
      },
      "notify",
    );
    expect(send).toHaveBeenCalledWith(
      group,
      expect.stringContaining("bot de jogos da ETH, em fase de teste"),
      undefined,
    );
    await handler.handle(
      {
        key: { remoteJid: group, id: "own-reply", fromMe: true },
        message: {
          conversation: "🎮 Olá! Sou o bot de jogos da ETH, em fase de teste.",
        },
        messageTimestamp: Date.now() / 1000,
      },
      "notify",
    );
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    manager.shutdown();
    vi.useRealTimers();
  }
});

it("não apresenta nem envia mensagens a grupos não autorizados", async () => {
  const send = vi.fn(async () => "sent");
  const manager = new GameManager(new ConfigStore(["123@g.us"]), send);
  manager.ready = true;
  await manager.introduce("456@g.us");
  expect(send).not.toHaveBeenCalled();
  manager.shutdown();
});

it("limita spam do /bot sem criar partida", async () => {
  const send = vi.fn(async () => "sent");
  const manager = new GameManager(new ConfigStore(["123@g.us"]), send);
  manager.ready = true;
  await Promise.all([
    manager.introduce("123@g.us"),
    manager.introduce("123@g.us"),
  ]);
  expect(send).toHaveBeenCalledTimes(1);
  expect(manager.session("123@g.us")).toBeUndefined();
  manager.shutdown();
});
