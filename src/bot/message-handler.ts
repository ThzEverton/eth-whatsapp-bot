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
  constructor(
    private manager: GameManager,
    private config: ConfigCommand,
    private resolve: ResolveLid,
    private error: (e: unknown) => void = () => {},
    private authenticatedSelf: () => string | undefined = () => undefined,
  ) {}
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
      const liveOwnCommand =
        type === "append" && raw.key.fromMe && ownCommand && selfOwner;
      if (requestId || (type !== "notify" && !liveOwnCommand)) return;
      if (
        raw.key.fromMe &&
        (!ownCommand || !this.config.isOwner(this.authenticatedSelf() || ""))
      )
        return;
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
    } catch (e) {
      this.error(e);
    }
  }
}
