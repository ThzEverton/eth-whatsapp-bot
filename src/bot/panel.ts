import http from "node:http";
import QRCode from "qrcode";
import { variantCatalog, validVariant } from "../data/variants.js";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import type { WAMessage } from "@whiskeysockets/baileys";
import type { GameManager } from "../games/game-manager.js";
import { gameTypes, type GameType, type Send } from "../games/game-types.js";
import { groupJid, userJid } from "../utils/normalize.js";
import { GroupQueue } from "../services/group-queue.js";
import { logger } from "../utils/logger.js";

export class Panel {
  private connection = { status: "connecting", qr: "" };
  private qrGeneration = 0;
  connectionState(status: string, value?: string) {
    const generation = ++this.qrGeneration;
    this.connection = { status, qr: "" };
    if (value)
      void QRCode.toDataURL(value, { width: 320, margin: 2 })
        .then((qr) => {
          if (generation === this.qrGeneration) this.connection.qr = qr;
        })
        .catch((e) => logger.error({ err: e }, "Falha ao gerar QR do painel"));
  }
  private messages: {
    id: string;
    chat: string;
    sender: string;
    text: string;
    time: number;
    outgoing: boolean;
  }[] = [];
  private groups = new Map<string, string>();
  private queue = new GroupQueue();
  private token = randomBytes(32).toString("hex");
  private server?: http.Server;
  private saves = Promise.resolve();
  constructor(
    private manager: GameManager,
    private send: Send,
    private account?: {
      disconnect: () => Promise<void>;
      connect: () => Promise<void>;
    },
  ) {}
  group(id: string, name: string) {
    this.groups.set(id, name);
  }
  record(message: WAMessage) {
    const chat = message.key.remoteJid,
      id = message.key.id;
    if (!chat || !id || (!groupJid(chat) && !userJid(chat)) || !message.message)
      return;
    let content = message.message;
    for (let i = 0; i < 4; i++) {
      const inner =
        content.ephemeralMessage?.message ||
        content.deviceSentMessage?.message ||
        content.viewOnceMessage?.message ||
        content.viewOnceMessageV2?.message;
      if (!inner) break;
      content = inner;
    }
    if (content.protocolMessage || content.editedMessage) return;
    const text =
      content.conversation ??
      content.extendedTextMessage?.text ??
      content.imageMessage?.caption ??
      content.videoMessage?.caption ??
      (content.imageMessage
        ? "[Imagem]"
        : content.videoMessage
          ? "[Vídeo]"
          : content.audioMessage
            ? "[Áudio]"
            : content.documentMessage
              ? "[Documento] " + (content.documentMessage.fileName || "")
              : content.stickerMessage
                ? "[Figurinha]"
                : "[Mensagem sem texto]");
    this.add({
      id,
      chat,
      sender: message.pushName || message.key.participant || chat,
      text: text.slice(0, 10000),
      time: Number(message.messageTimestamp) * 1000 || Date.now(),
      outgoing: !!message.key.fromMe,
    });
  }
  sent(chat: string, id: string, text: string) {
    this.add({
      chat,
      id,
      sender: "Bot",
      text,
      time: Date.now(),
      outgoing: true,
    });
  }
  private add(message: Panel["messages"][number]) {
    if (
      this.messages.some((m) => m.chat === message.chat && m.id === message.id)
    )
      return;
    this.messages.push(message);
    this.messages = this.messages.slice(-2000);
    const data = JSON.stringify(this.messages);
    this.saves = this.saves
      .catch(() => {})
      .then(() => writeFile("runtime/messages.json.tmp", data, { mode: 0o600 }))
      .then(async () => {
        const { rename } = await import("node:fs/promises");
        await rename("runtime/messages.json.tmp", "runtime/messages.json");
      })
      .catch((e) => {
        logger.error({ err: e }, "Falha ao salvar mensagens do painel");
      });
  }
  async start() {
    await mkdir("runtime", { recursive: true });
    try {
      this.messages = JSON.parse(
        await readFile("runtime/messages.json", "utf8"),
      ).slice(-2000);
    } catch {}
    this.server = http.createServer(async (req, res) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      if (req.headers.authorization !== `Bearer ${this.token}`) {
        res.writeHead(403);
        res.end("{}");
        return;
      }
      try {
        if (req.method === "GET" && req.url === "/state") {
          const ids = new Set([
            ...this.groups.keys(),
            ...this.manager.config.groups,
            ...this.messages.map((m) => m.chat),
          ]);
          res.end(
            JSON.stringify({
              variants: variantCatalog,
              connection: this.connection,
              ready: this.manager.ready,
              pid: process.pid,
              messages: this.messages,
              chats: [...ids].map((id) => {
                const s = this.manager.session(id);
                return {
                  id,
                  name: this.groups.get(id) || id,
                  group: !!groupJid(id),
                  allowed: this.manager.config.groups.has(id),
                  settings: this.manager.config.get(id),
                  session: s
                    ? {
                        status: s.status,
                        type: s.gameType,
                        expiresAt: s.expiresAt,
                      }
                    : null,
                };
              }),
            }),
          );
          return;
        }
        if (req.method !== "POST" || req.url !== "/action") {
          res.writeHead(404);
          res.end("{}");
          return;
        }
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 20000)
            throw Error("Solicitação muito grande");
        }
        const action = JSON.parse(body);
        await this.queue.run("panel", async () => {
          if (
            action.type === "disconnect-account" ||
            action.type === "connect-account"
          ) {
            if (!this.account) throw Error("Controle da conta indisponível");
            if (action.type === "disconnect-account")
              await this.account.disconnect();
            else await this.account.connect();
            return;
          }
          const id = action.chat;
          if (typeof id !== "string" || (!groupJid(id) && !userJid(id)))
            throw Error("Conversa inválida");
          if (action.type === "send") {
            if (
              typeof action.text !== "string" ||
              !action.text.trim() ||
              action.text.length > 4000
            )
              throw Error("Escreva uma mensagem de até 4000 caracteres");
            await this.send(id, action.text.trim());
            return;
          }
          if (!groupJid(id)) throw Error("Selecione um grupo");
          if (action.type === "authorize") {
            if (typeof action.allowed !== "boolean")
              throw Error("Autorização inválida");
            if (action.allowed) this.manager.config.groups.add(id);
            else {
              this.manager.config.groups.delete(id);
              await this.manager.cancel(id);
            }
            await this.manager.config.save();
            return;
          }
          if (!this.manager.config.groups.has(id))
            throw Error("Autorize o grupo primeiro");
          if (action.type === "cancel") {
            await this.manager.cancel(id);
            return;
          }
          if (action.type === "start") {
            if (!this.manager.ready) throw Error("WhatsApp desconectado");
            if (!gameTypes.includes(action.game))
              throw Error("Modalidade inválida");
            if (
              !this.manager.config.get(id).enabled ||
              !this.manager.config.get(id).modes[action.game as GameType]
            )
              throw Error("Jogo desativado nas configurações");
            if (action.variant !== undefined && !validVariant(action.variant))
              throw Error("Variação inválida");
            const before = this.manager.session(id);
            if (before && before.status !== "SELECTING")
              throw Error("Já existe uma partida neste grupo");
            await this.manager.request(
              id,
              "panel",
              action.game,
              action.variant,
            );
            if (this.manager.session(id)?.status !== "ACTIVE")
              throw Error(
                "Não foi possível iniciar. Confira a conexão e aguarde o intervalo entre partidas.",
              );
            return;
          }
          if (action.type !== "settings") throw Error("Ação inválida");
          const s = action.settings;
          const integer = (v: number, min: number, max: number) =>
            Number.isInteger(v) && v >= min && v <= max;
          if (
            !s ||
            typeof s.enabled !== "boolean" ||
            gameTypes.some(
              (t) =>
                typeof s.modes?.[t] !== "boolean" ||
                !integer(s.duration?.[t], 10, 600),
            ) ||
            !integer(s.cooldown, 0, 3600) ||
            !integer(s.guessCooldown, 0, 60) ||
            !integer(s.numberMin, 1, 1000000) ||
            !integer(s.numberMax, 1, 1000000) ||
            s.numberMin >= s.numberMax
          )
            throw Error(
              "Configurações inválidas. Confira os limites dos campos.",
            );
          if (
            s.variants !== undefined &&
            gameTypes.some((t) => !validVariant(s.variants?.[t]))
          )
            throw Error("Variação inválida");
          this.manager.config.set(id, {
            variants: s.variants || this.manager.config.get(id).variants,
            enabled: s.enabled,
            modes: s.modes,
            duration: s.duration,
            cooldown: s.cooldown,
            guessCooldown: s.guessCooldown,
            numberMin: s.numberMin,
            numberMax: s.numberMax,
            selection: 30,
          });
          if (
            !s.enabled ||
            (this.manager.session(id)?.gameType &&
              !s.modes[this.manager.session(id)!.gameType!])
          )
            await this.manager.cancel(id);
          await this.manager.config.save();
        });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : "Falha na operação",
          }),
        );
      }
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(0, "127.0.0.1", resolve);
    });
    const address = this.server.address() as { port: number };
    await writeFile(
      "runtime/panel.json",
      JSON.stringify({
        port: address.port,
        token: this.token,
        pid: process.pid,
      }),
      { mode: 0o600 },
    );
  }
  stop() {
    this.server?.close();
  }
}
