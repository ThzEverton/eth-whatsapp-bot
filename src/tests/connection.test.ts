import { beforeEach, expect, it, vi } from "vitest";
import { rename } from "node:fs/promises";
import { Connection } from "../bot/connection.js";
import { ConfigStore } from "../config/settings.js";
import { GameManager } from "../games/game-manager.js";
import type { Panel } from "../bot/panel.js";

const socket = vi.hoisted(() => ({
  ev: { on: vi.fn(), removeAllListeners: vi.fn() },
  end: vi.fn(),
  logout: vi.fn(async () => {}),
}));
vi.mock("@whiskeysockets/baileys", () => ({
  default: () => socket,
  DisconnectReason: {},
  useMultiFileAuthState: async () => ({ state: {}, saveCreds: async () => {} }),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  chmod: vi.fn(),
  rm: vi.fn(),
  rename: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
vi.mock("../utils/logger.js", () => ({
  logger: { child: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

it("atualiza grupos criados e renomeados após conectar sem autorizar automaticamente", async () => {
  const store = new ConfigStore([]);
  const manager = new GameManager(store, async () => "sent");
  const connection = new Connection("unused", "5511999999999", manager);
  const group = vi.fn();
  connection.panel = { group } as unknown as Panel;
  await connection.connect();
  const emit = (event: string, payload: unknown) => {
    const listener = socket.ev.on.mock.calls.find(
      ([name]) => name === event,
    )?.[1];
    expect(listener).toBeTypeOf("function");
    listener(payload);
  };
  const id = "120363430060189010@g.us";
  emit("groups.upsert", [{ id, subject: "Novo grupo" }]);
  expect(group).toHaveBeenLastCalledWith(id, "Novo grupo");
  emit("groups.update", [{ id, subject: "Outro nome" }]);
  expect(group).toHaveBeenLastCalledWith(id, "Outro nome");
  emit("groups.update", [{ id, announce: true }]);
  expect(group).toHaveBeenCalledTimes(2);
  expect(store.groups.has(id)).toBe(false);
  connection.stop();
  emit("groups.upsert", [{ id, subject: "Evento antigo" }]);
  expect(group).toHaveBeenCalledTimes(2);
});

it("desconecta de verdade, arquiva a sessão e permite preparar um novo QR", async () => {
  const manager = new GameManager(new ConfigStore([]), async () => "sent");
  const connection = new Connection("unused", "", manager);
  const connectionState = vi.fn();
  connection.panel = { connectionState } as unknown as Panel;
  await connection.connect();
  manager.ready = true;
  await connection.disconnectAccount();
  expect(socket.logout).toHaveBeenCalledTimes(1);
  expect(rename).toHaveBeenCalledTimes(1);
  expect(String(vi.mocked(rename).mock.calls[0]![1])).toContain(
    "unused.disconnected-",
  );
  expect(manager.ready).toBe(false);
  expect(connectionState).toHaveBeenLastCalledWith("loggedout");
  const count = socket.ev.on.mock.calls.length;
  await connection.connectAccount();
  expect(socket.ev.on.mock.calls.length).toBeGreaterThan(count);
  expect(connectionState).toHaveBeenLastCalledWith("connecting");
  connection.stop();
});

it("não arquiva a sessão se o WhatsApp recusar o logout", async () => {
  const manager = new GameManager(new ConfigStore([]), async () => "sent");
  const connection = new Connection("unused", "", manager);
  await connection.connect();
  manager.ready = true;
  socket.logout.mockRejectedValueOnce(new Error("Falha de rede"));
  await expect(connection.disconnectAccount()).rejects.toThrow("Falha de rede");
  expect(rename).not.toHaveBeenCalled();
  expect(manager.ready).toBe(false);
  connection.stop();
});
