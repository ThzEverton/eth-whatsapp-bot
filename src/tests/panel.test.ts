import { afterEach, describe, expect, it, vi } from "vitest";
import { Panel } from "../bot/panel.js";
import { ConfigStore, defaults } from "../config/settings.js";
import { GameManager } from "../games/game-manager.js";
import type { WAMessage } from "@whiskeysockets/baileys";

const files = vi.hoisted(() => new Map<string, string>());
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => {}),
  readFile: vi.fn(async (file: string) => {
    if (!files.has(file)) throw Error("ENOENT");
    return files.get(file);
  }),
  writeFile: vi.fn(async (file: string, data: string) => {
    files.set(file, data);
  }),
  rename: vi.fn(async (from: string, to: string) => {
    files.set(to, files.get(from)!);
  }),
}));
let panel: Panel;
afterEach(() => {
  panel?.stop();
  files.clear();
});
describe("painel local", () => {
  it("exige chave, registra mensagens uma vez e valida ações sem modificar configurações inválidas", async () => {
    const id = "120363000000000000@g.us";
    const store = new ConfigStore([id]);
    const send = vi.fn(async () => "sent-id");
    const manager = new GameManager(store, send);
    manager.ready = true;
    const account = {
      disconnect: vi.fn(async () => {}),
      connect: vi.fn(async () => {}),
    };
    panel = new Panel(manager, send, account);
    await panel.start();
    const info = JSON.parse(files.get("runtime/panel.json")!);
    const url = `http://127.0.0.1:${info.port}`;
    const headers = {
      Authorization: `Bearer ${info.token}`,
      "Content-Type": "application/json",
    };
    expect((await fetch(url + "/state")).status).toBe(403);
    const message = {
      key: {
        remoteJid: id,
        id: "incoming",
        participant: "5511999999999@s.whatsapp.net",
      },
      message: { conversation: "Olá" },
      messageTimestamp: Math.floor(Date.now() / 1000),
    } as WAMessage;
    panel.record(message);
    panel.record(message);
    panel.sent(id, "outgoing", "Resposta");
    panel.connectionState("qr", "qr-de-teste");
    await vi.waitFor(async () => {
      const s = await (await fetch(url + "/state", { headers })).json();
      expect(s.connection.qr).toMatch(/^data:image\/png;base64,/);
    });
    panel.connectionState("connected");
    const state = await (await fetch(url + "/state", { headers })).json();
    expect(state.messages).toHaveLength(2);
    expect(state.connection.qr).toBe("");
    expect(state.variants).toHaveLength(22);
    expect(state.messages[0].text).toBe("Olá");
    expect(state.messages[1].outgoing).toBe(true);
    const post = (body: unknown) =>
      fetch(url + "/action", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    expect((await post({ type: "disconnect-account" })).status).toBe(200);
    expect(account.disconnect).toHaveBeenCalledOnce();
    expect((await post({ type: "connect-account" })).status).toBe(200);
    expect(account.connect).toHaveBeenCalledOnce();
    expect(
      (
        await post({
          type: "settings",
          chat: id,
          settings: { ...defaults(), cooldown: -1 },
        })
      ).status,
    ).toBe(400);
    expect(store.get(id).cooldown).toBe(20);
    expect(
      (
        await post({
          type: "settings",
          chat: id,
          settings: {
            ...defaults(),
            variants: { ...defaults().variants, quiz: "invalido" },
          },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post({
          type: "start",
          chat: id,
          game: "quiz",
          variant: "invalido",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post({
          type: "settings",
          chat: id,
          settings: { ...defaults(), cooldown: 45 },
        })
      ).status,
    ).toBe(200);
    expect(store.get(id).cooldown).toBe(45);
    expect(
      (await post({ type: "send", chat: id, text: "  Mensagem  " })).status,
    ).toBe(200);
    expect(send).toHaveBeenCalledWith(id, "Mensagem");
    expect((await post({ type: "send", chat: id, text: " " })).status).toBe(
      400,
    );
    expect(
      (await post({ type: "authorize", chat: id, allowed: false })).status,
    ).toBe(200);
    expect(store.groups.has(id)).toBe(false);
  });
});
