import type { WAMessage } from "@whiskeysockets/baileys";
import { ConfigCommand } from "../commands/config.js";
import { GameManager } from "../games/game-manager.js";
import { MessageDedup } from "../services/message-dedup.js";
import { groupJid, userJid } from "../utils/normalize.js";
import { routeGame } from "./command-router.js";
import { logger } from "../utils/logger.js";
export type ResolveLid = (id: string) => Promise<string | null>;
export class MessageHandler {
  private dedup = new MessageDedup();
  private boot = Date.now();
  private gameIdentities = new Map<string, string>();
  private botMessageIds = new Map<string, number>();

  markBotMessage(chat: string, id: string) {
    const now = Date.now();
    this.botMessageIds.set(chat + ":" + id, now);
    for (const [key, when] of this.botMessageIds) {
      if (when >= now - 300000 && this.botMessageIds.size <= 5000) break;
      this.botMessageIds.delete(key);
    }
  }
  constructor(
    private manager: GameManager,
    private config: ConfigCommand,
    private resolve: ResolveLid,
    private error: (e: unknown) => void = () => {},
    private authenticatedSelf: () => string | undefined = () => undefined,
  ) {}
  // Mensagem digitada por uma pessoa no painel: o envio foi confirmado pelo
  // WhatsApp, mas o eco messages.upsert pode nao chegar ou vir como append.
  // Trata a mensagem uma unica vez, sem confundir com respostas geradas pelo bot.
  async handlePanelSent(chat: string, id: string, text: string) {
    try {
      if (
        !this.manager.ready ||
        !groupJid(chat) ||
        !this.manager.config.groups.has(chat) ||
        !id ||
        !text.trim() ||
        text.length > 500
      ) return;
      const sender = userJid(this.authenticatedSelf());
      if (!sender) {
        logger.warn({ groupId: chat }, "Mensagem do painel sem remetente autenticado");
        return;
      }
      if (this.dedup.seen(chat + ":" + id)) return;
      await routeGame(
        {
          groupId: chat,
          senderId: sender,
          messageId: id,
          text: text.trim(),
          timestamp: Date.now(),
        },
        this.manager,
      );
    } catch (e) {
      this.error(e);
    }
  }
  async handle(raw: WAMessage, type: string, requestId?: string) {
    try {
      const chat = raw?.key?.remoteJid,
        id = raw?.key?.id;
      if (
        !this.manager.ready ||
        !chat ||
        !id ||
        id.length > 200 ||
        raw.messageStubType
      )
        return;
      let content = raw.message;
      // Mensagens temporárias/dispositivos preservam o texto original; edições nunca são desembrulhadas.
      for (
        let i = 0;
        i < 3 && content && !content.protocolMessage && !content.editedMessage;
        i++
      ) {
        const inner =
          content.ephemeralMessage?.message ||
          content.deviceSentMessage?.message;
        if (!inner) break;
        content = inner;
      }
      // só conteúdo textual novo; sem unwrap de edições/protocolo/histórico
      if (!content || content.protocolMessage || content.editedMessage) return;
      const keys = Object.keys(content).filter(
        (k) => k !== "messageContextInfo",
      );
      if (
        keys.length !== 1 ||
        !["conversation", "extendedTextMessage"].includes(keys[0]!)
      )
        return;
      const text = content.conversation ?? content.extendedTextMessage?.text;
      if (typeof text !== "string" || !text.trim() || text.length > 500) return;
      const isIntroduction = text.trim() === "/bot";
      const ownCommand =
        isIntroduction ||
        /^\/jogo(?: (quiz|numero|palavra|emoji|forca)(?: [a-z]+)?)?$/.test(
          text.trim(),
        );
      const selfOwner = this.config.isOwner(this.authenticatedSelf() || "");
      if (ownCommand && !isIntroduction)
        logger.info(
          { eventType: type, fromMe: !!raw.key.fromMe, ownerMatched: selfOwner },
          "Comando de jogo observado",
        );
      if (isIntroduction)
        logger.info(
          {
            eventType: type,
            fromMe: !!raw.key.fromMe,
            authorizedGroup: this.manager.config.groups.has(chat),
            selfOwner,
            ageSeconds:
              (Date.now() - Number(raw.messageTimestamp) * 1000) / 1000,
          },
          "Comando /bot recebido",
        );
      // O Baileys costuma classificar mensagens do proprio aparelho como
      // "append". Elas podem iniciar jogos mesmo sem serem comandos de /config.
      // Durante partidas, tambem aceita palpites do numero conectado.
      // Mensagens geradas pelo bot sao marcadas na conexao e ignoradas aqui.
      const outgoingGame =
        !!raw.key.fromMe && (ownCommand || !!this.manager.session(chat));
      if (requestId || (type !== "notify" && !(type === "append" && outgoingGame))) {
        if (ownCommand) logger.info({ reason: requestId ? "historico" : "tipo_de_evento" }, "Comando de jogo ignorado");
        return;
      }
      if (raw.key.fromMe && this.botMessageIds.has(chat + ":" + id)) return;
      if (raw.key.fromMe && !outgoingGame) return;
      const timestamp = Number(raw.messageTimestamp) * 1000,
        now = Date.now();
      if (
        !Number.isFinite(timestamp) ||
        timestamp < Math.ceil(this.boot / 1000) * 1000 ||
        timestamp < now - 15000 ||
        timestamp > now + 5000 ||
        this.dedup.seen(chat + ":" + id)
      )
        return;
      const group = groupJid(chat);
      if (!group && !userJid(chat)) return;
      const configMatch = /^\/config(?: (\S+(?: \S+)*))?$/.exec(text.trim());
      if (!group && !configMatch) return;
      if (group && !this.manager.config.groups.has(chat)) return;
      const sessionId = this.manager.session(chat)?.gameId;
      const generation = this.manager.generation;
      const primary = userJid(
        raw.key.fromMe
          ? this.authenticatedSelf()
          : group
            ? raw.key.participant
            : chat,
      );
      if (!primary) return;
      // LID é resolvido exclusivamente pelo repositório autenticado do Baileys.
      let sender = primary;
      if (primary.endsWith("@lid")) {
        const pn = userJid(await this.resolve(primary));
        if (pn?.endsWith("@s.whatsapp.net")) sender = pn;
      }
      if (!this.manager.ready || generation !== this.manager.generation) return;
      if (configMatch) {
        await this.config.execute(
          chat,
          this.config.isOwner(primary) ? primary : sender,
          configMatch[1]?.split(" ") || [],
        );
        return;
      }
      if (text.trim() === "/bot") {
        await this.manager.introduce(chat);
        return;
      }
      // Mantém a identidade dos jogos estável mesmo se o mapeamento PN chegar depois.
      const gameSender = this.gameIdentities.get(primary) || sender;
      this.gameIdentities.set(primary, gameSender);
      const isStart =
        text.trim() === "/jogo" || text.trim().startsWith("/jogo ");
      if (!isStart && this.manager.session(chat)?.gameId !== sessionId) return;
      await routeGame(
        {
          groupId: chat,
          senderId: gameSender,
          messageId: id,
          text: text.trim(),
          timestamp,
          quotedId:
            content.extendedTextMessage?.contextInfo?.stanzaId || undefined,
        },
        this.manager,
      );
      if (ownCommand)
        logger.info({ eventType: type, fromMe: !!raw.key.fromMe }, "Comando encaminhado ao motor de jogos");
    } catch (e) {
      this.error(e);
    }
  }
}
