import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
  type GroupMetadata,
} from "@whiskeysockets/baileys";
import qr from "qrcode-terminal";
import QRCode from "qrcode";
import { mkdir, chmod, rm, rename } from "node:fs/promises";
import { join, resolve, dirname, relative } from "node:path";
import { logger } from "../utils/logger.js";
import { MessageHandler } from "./message-handler.js";
import { GameManager } from "../games/game-manager.js";
import { ConfigCommand } from "../commands/config.js";
import { PermissionService } from "../services/permission-service.js";
import type { Send } from "../games/game-types.js";
import type { Panel } from "./panel.js";
export class Connection {
  panel?: Panel;
  private socket?: WASocket;
  private reconnect?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private connecting = false;
  private attempt = 0;
  private qrWrites = Promise.resolve();
  private credsWrites = Promise.resolve();
  private metadata = new Map<string, { value: GroupMetadata; until: number }>();
  constructor(
    private authDir: string,
    private owner: string,
    private manager: GameManager,
  ) {}
  send: Send = async (jid, text, mentions) => {
    const socket = this.socket;
    if (!this.manager.ready || !socket) throw new Error("Conexão indisponível");
    const sent = await socket.sendMessage(jid, { text, mentions });
    if (!sent?.key.id) throw new Error("Envio sem confirmação válida");
    this.panel?.sent(jid, sent.key.id, text);
    return sent.key.id;
  };
  async connect() {
    if (this.stopped || this.connecting) return;
    this.connecting = true;
    try {
      await mkdir(this.authDir, { recursive: true, mode: 0o700 });
      if (process.platform !== "win32") await chmod(this.authDir, 0o700);
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      if (this.stopped) return;
      const socket = makeWASocket({
        auth: state,
        logger: logger.child({ component: "baileys" }, { level: "warn" }),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        connectTimeoutMs: 30000,
        defaultQueryTimeoutMs: 15000,
        cachedGroupMetadata: async (jid) => {
          const item = this.metadata.get(jid);
          if (item && item.until > Date.now()) return item.value;
          return undefined;
        },
      });
      this.socket = socket;
      const admin = new ConfigCommand(
        new PermissionService(() => this.owner || socket.user?.id),
        this.manager,
        this.send,
      );
      const handler = new MessageHandler(
        this.manager,
        admin,
        (id) => socket.signalRepository.lidMapping.getPNForLID(id),
        (e) => logger.error({ err: e }, "Falha ao processar mensagem"),
        () => socket.user?.id,
      );
      socket.ev.on("creds.update", () => {
        if (this.socket !== socket) return;
        this.credsWrites = this.credsWrites
          .catch(() => {})
          .then(() => saveCreds());
        void this.credsWrites.catch((e) =>
          logger.error({ err: e }, "Falha ao salvar credenciais"),
        );
      });
      socket.ev.on("messages.upsert", (event) => {
        if (this.socket !== socket) return;
        for (const message of event.messages) {
          this.panel?.record(message);
          void handler.handle(message, event.type, event.requestId);
        }
      });
      socket.ev.on("groups.upsert", (groups) => {
        if (this.socket !== socket || this.stopped) return;
        for (const g of groups) {
          this.panel?.group(g.id, g.subject);
          this.metadata.set(g.id, { value: g, until: Date.now() + 300000 });
          logger.info(
            { groupId: g.id, groupName: g.subject },
            "Grupo disponível para autorização",
          );
        }
      });
      socket.ev.on("groups.update", (groups) => {
        if (this.socket !== socket || this.stopped) return;
        for (const g of groups)
          if (g.id) {
            this.metadata.delete(g.id);
            if (typeof g.subject === "string") {
              this.panel?.group(g.id, g.subject);
              logger.info(
                { groupId: g.id, groupName: g.subject },
                "Nome do grupo atualizado",
              );
            }
          }
      });
      socket.ev.on("group-participants.update", (g) => {
        this.metadata.delete(g.id);
      });
      socket.ev.on("connection.update", (update) => {
        if (this.socket !== socket || this.stopped) return;
        if (update.qr) {
          qr.generate(update.qr, { small: true });
          const value = update.qr;
          this.panel?.connectionState?.("qr", value);
          this.qrWrites = this.qrWrites
            .catch(() => {})
            .then(async () => {
              if (this.stopped || this.socket !== socket || this.manager.ready)
                return;
              const file = join(this.authDir, "qr.png");
              await QRCode.toFile(file, value, { width: 640, margin: 4 });
              if (process.platform !== "win32") await chmod(file, 0o600);
              logger.info(
                { qrFile: file },
                "QR salvo para leitura; expira automaticamente",
              );
            });
          void this.qrWrites.catch((e) =>
            logger.error({ err: e }, "Falha ao salvar QR"),
          );
        }
        if (update.connection === "open") {
          this.attempt = 0;
          this.manager.ready = true;
          this.panel?.connectionState?.("connected");
          this.clearQR();
          logger.info("WhatsApp conectado");
          void socket
            .groupFetchAllParticipating()
            .then((groups) => {
              for (const [id, value] of Object.entries(groups)) {
                this.panel?.group(id, value.subject);
                logger.info(
                  { groupId: id, groupName: value.subject },
                  "Grupo disponível para autorização",
                );
                this.metadata.set(id, { value, until: Date.now() + 300000 });
              }
            })
            .catch((e) =>
              logger.warn({ err: e }, "Não foi possível listar grupos"),
            );
        }
        if (update.connection === "close") {
          this.manager.disconnect();
          this.panel?.connectionState?.("disconnected");
          this.clearQR();
          socket.ev.removeAllListeners("messages.upsert");
          this.socket = undefined;
          const code = (
            update.lastDisconnect?.error as
              { output?: { statusCode?: number } } | undefined
          )?.output?.statusCode;
          logger.warn({ code }, "WhatsApp desconectado; partidas canceladas");
          if (
            code === DisconnectReason.loggedOut ||
            code === DisconnectReason.connectionReplaced ||
            code === DisconnectReason.badSession ||
            code === DisconnectReason.forbidden
          ) {
            this.stopped = true;
            logger.error(
              "Sessão encerrada. Corrija a autenticação e reinicie manualmente.",
            );
            return;
          }
          this.schedule();
        }
      });
    } catch (e) {
      logger.error({ err: e }, "Falha de conexão");
      this.schedule();
    } finally {
      this.connecting = false;
    }
  }
  async disconnectAccount() {
    const socket = this.socket;
    if (!socket || !this.manager.ready)
      throw Error("WhatsApp já está desconectado");
    const authPath = resolve(this.authDir);
    const workspacePath = resolve(process.cwd());
    const workspaceFromAuth = relative(authPath, workspacePath);
    if (
      authPath === dirname(authPath) ||
      authPath === workspacePath ||
      (!workspaceFromAuth.startsWith("..") && !workspaceFromAuth.includes(":"))
    ) {
      throw Error(
        "A pasta de autenticação deve ser uma pasta exclusiva da sessão",
      );
    }
    this.stopped = true;
    clearTimeout(this.reconnect);
    this.reconnect = undefined;
    this.manager.disconnect();
    this.panel?.connectionState?.("disconnecting");
    try {
      await socket.logout("Desconectado pelo painel");
      this.clearQR();
      socket.ev.removeAllListeners("creds.update");
      socket.ev.removeAllListeners("messages.upsert");
      this.socket = undefined;
      await this.credsWrites;
      await this.qrWrites;
      await rename(authPath, `${authPath}.disconnected-${Date.now()}`);
      this.panel?.connectionState?.("loggedout");
      logger.info(
        "Conta desconectada pelo painel; novo QR disponível ao conectar novamente",
      );
    } catch (e) {
      this.socket = undefined;
      this.panel?.connectionState?.("disconnected");
      throw e;
    } finally {
      socket.end(new Error("Conta desconectada pelo painel"));
    }
  }
  async connectAccount() {
    if (this.socket || this.connecting) return;
    this.stopped = false;
    this.panel?.connectionState?.("connecting");
    await this.connect();
  }
  private schedule() {
    if (this.stopped || this.reconnect) return;
    const delay =
      Math.min(60000, 1000 * 2 ** Math.min(this.attempt++, 6)) +
      Math.floor(Math.random() * 1000);
    this.reconnect = setTimeout(() => {
      this.reconnect = undefined;
      void this.connect();
    }, delay);
  }
  private clearQR() {
    this.qrWrites = this.qrWrites
      .catch(() => {})
      .then(() => rm(join(this.authDir, "qr.png"), { force: true }));
    void this.qrWrites.catch((e) =>
      logger.error({ err: e }, "Falha ao remover QR"),
    );
  }
  stop() {
    this.stopped = true;
    this.panel?.connectionState?.("offline");
    clearTimeout(this.reconnect);
    this.manager.shutdown();
    this.clearQR();
    this.socket?.end(new Error("Encerramento do processo"));
  }
}
