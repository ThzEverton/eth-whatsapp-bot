import { randomUUID } from "node:crypto";
import { ConfigStore } from "../config/settings.js";
import { GroupQueue } from "../services/group-queue.js";
import { CooldownService } from "../services/cooldown-service.js";
import { MessageDedup } from "../services/message-dedup.js";
import { validIncoming } from "../services/validation-service.js";
import { menu } from "../commands/jogo.js";
import { gameFor } from "./registry.js";
import type { GameSession } from "./game-session.js";
import type { GameType, Incoming, Send, Status } from "./game-types.js";
export class GameManager {
  private sessions = new Map<string, GameSession>();
  private queue = new GroupQueue();
  private dedup = new MessageDedup();
  private spam = new CooldownService();
  private cooldowns = new Map<string, number>();
  private recent = new Map<string, string[]>();
  ready = false;
  generation = 0;
  constructor(
    readonly config: ConfigStore,
    private send: Send,
    private onError: (e: unknown) => void = () => {},
  ) {}
  session(id: string) {
    const s = this.sessions.get(id);
    return s ? structuredClone({ ...s, timeoutHandle: undefined }) : undefined;
  }
  private async post(id: string, text: string, mentions?: string[]) {
    try {
      return await this.send(id, text, mentions);
    } catch (e) {
      this.onError(e);
      return undefined;
    }
  }
  async introduce(groupId: string) {
    if (
      !this.ready ||
      !this.config.groups.has(groupId) ||
      !this.spam.allow(groupId + ":intro", 10000)
    )
      return;
    await this.post(
      groupId,
      "🎮 Olá! Sou o bot de jogos da ETH, em fase de teste.\n\nVamos jogar juntos? Envie /jogo para ver os minigames disponíveis.",
    );
  }
  private timer(s: GameSession) {
    s.timeoutHandle = setTimeout(
      () => {
        void this.queue
          .run(s.groupId, async () => {
            const current = this.sessions.get(s.groupId);
            if (current?.gameId !== s.gameId) return;
            if (current.status === "SELECTING")
              await this.finish(
                current,
                "EXPIRED",
                "⌛ Seleção expirada. Use /jogo novamente.",
              );
            else if (current.status === "ACTIVE")
              await this.finish(
                current,
                "EXPIRED",
                `⏰ TEMPO ESGOTADO!\n\nNinguém acertou.\nResposta: ${current.answer}\n\nUma nova rodada poderá começar em breve.`,
              );
          })
          .catch(this.onError);
      },
      Math.max(0, s.expiresAt - Date.now()),
    );
  }
  request(groupId: string, sender: string, type?: GameType, variant?: string) {
    const generation = this.generation;
    return this.queue.run(groupId, async () => {
      const cfg = this.config.get(groupId);
      if (
        generation !== this.generation ||
        !this.ready ||
        !this.config.groups.has(groupId) ||
        !cfg.enabled
      )
        return;
      const old = this.sessions.get(groupId);
      if (old) {
        if (old.status === "SELECTING" && Date.now() >= old.expiresAt) {
          await this.finish(
            old,
            "EXPIRED",
            "⌛ Seleção expirada. Use /jogo novamente.",
          );
          return;
        }
        if (old.status === "SELECTING" && type) {
          await this.start(old, type, variant);
          return;
        }
        if (this.spam.allow(groupId + ":busy", 10000))
          await this.post(
            groupId,
            "🎮 Já existe uma partida em andamento! Participe da rodada atual.",
          );
        return;
      }
      if ((this.cooldowns.get(groupId) || 0) > Date.now()) {
        if (this.spam.allow(groupId + ":wait", 10000))
          await this.post(groupId, "⏳ Aguarde o intervalo entre partidas.");
        return;
      }
      if (type && !cfg.modes[type]) {
        await this.post(groupId, "Esta modalidade está desativada.");
        return;
      }
      const now = Date.now();
      const s: GameSession = {
        groupId,
        gameId: randomUUID(),
        status: type ? "STARTING" : "SELECTING",
        startedBy: sender,
        createdAt: now,
        expiresAt: now + cfg.selection * 1000,
      };
      this.sessions.set(groupId, s); // reserva antes do primeiro await
      if (type) await this.start(s, type, variant);
      else if (await this.post(groupId, menu)) {
        if (this.ready && this.sessions.get(groupId)?.gameId === s.gameId)
          this.timer(s);
      } else {
        await this.finish(s, "CANCELLED");
      }
    });
  }
  private async start(s: GameSession, type: GameType, variant?: string) {
    const cfg = this.config.get(s.groupId);
    if (!cfg.modes[type]) {
      await this.post(s.groupId, "Esta modalidade está desativada.");
      return;
    }
    if (!this.ready) {
      await this.finish(s, "CANCELLED");
      return;
    }
    clearTimeout(s.timeoutHandle);
    s.status = "STARTING";
    s.gameType = type;
    try {
      if (variant) cfg.variants = { ...cfg.variants!, [type]: variant };
      const key =
        s.groupId + ":" + type + ":" + (cfg.variants?.[type] || "classico");
      const recent = this.recent.get(key) || [];
      const round = gameFor(type, cfg).create(recent);
      s.roundData = round;
      s.answer = round.answer;
      s.acceptedAnswers = round.acceptedAnswers;
      const questionId = await this.post(
        s.groupId,
        `${round.prompt}\n\n⏱️ Tempo: ${cfg.duration[type]} segundos.`,
      );
      if (
        !questionId ||
        !this.ready ||
        this.sessions.get(s.groupId)?.gameId !== s.gameId
      ) {
        await this.finish(s, "CANCELLED");
        return;
      }
      s.questionMessageId = questionId;
      s.startedAt = Date.now();
      s.expiresAt = s.startedAt + cfg.duration[type] * 1000;
      s.status = "ACTIVE";
      this.recent.set(
        key,
        [...recent, round.answer].slice(
          -Math.min(20, type === "quiz" ? 20 : 5),
        ),
      );
      this.timer(s);
    } catch (e) {
      this.onError(e);
      await this.finish(s, "CANCELLED");
    }
  }
  answer(m: Incoming) {
    if (
      !validIncoming(m) ||
      !this.ready ||
      !this.config.groups.has(m.groupId) ||
      this.dedup.seen(m.groupId + ":" + m.messageId)
    )
      return Promise.resolve();
    const captured = this.sessions.get(m.groupId);
    if (
      !captured ||
      captured.status !== "ACTIVE" ||
      // O WhatsApp fornece horario em segundos. Aceitar o segundo inicial
      // evita perder respostas rapidas e ainda descarta mensagens de segundos anteriores.
      m.timestamp < Math.floor(captured.startedAt! / 1000) * 1000 ||
      m.timestamp > Date.now() + 5000 ||
      (m.quotedId && m.quotedId !== captured.questionMessageId)
    )
      return Promise.resolve();
    const gameId = captured.gameId;
    return this.queue.run(m.groupId, async () => {
      const s = this.sessions.get(m.groupId);
      if (!this.ready || !s || s.gameId !== gameId || s.status !== "ACTIVE")
        return;
      if (Date.now() >= s.expiresAt) {
        await this.finish(
          s,
          "EXPIRED",
          `⏰ TEMPO ESGOTADO!\nResposta: ${s.answer}`,
        );
        return;
      }
      const cfg = this.config.get(m.groupId);
      if (
        !this.spam.allow(`${m.groupId}:${m.senderId}`, cfg.guessCooldown * 1000)
      )
        return;
      const text = m.text.startsWith("/r ")
        ? m.text.slice(3).trim()
        : m.text.trim();
      if (text.startsWith("/")) return;
      const result = gameFor(s.gameType!, cfg).guess(s.roundData!, text);
      if (!result.valid) return;
      if (result.win) {
        s.winnerId = m.senderId;
        s.winnerMessageId = m.messageId;
        await this.finish(
          s,
          "FINISHED",
          `🏆 TEMOS UM VENCEDOR!\n\nParabéns, @${m.senderId.split("@")[0]}!\nPrimeiro acerto processado.\n\n✅ Resposta: ${s.answer}\n🎮 Rodada encerrada!`,
          [m.senderId],
        );
      } else if (result.loss)
        await this.finish(
          s,
          "FINISHED",
          `📝 Tentativas esgotadas!\nResposta: ${s.answer}\nRodada encerrada sem vencedor.`,
        );
      else if (result.update) await this.post(m.groupId, result.update);
    });
  }
  private async finish(
    s: GameSession,
    status: Status,
    text?: string,
    mentions?: string[],
  ) {
    if (
      this.sessions.get(s.groupId)?.gameId !== s.gameId ||
      s.status === "FINISHING"
    )
      return;
    s.status = "FINISHING";
    clearTimeout(s.timeoutHandle); // vencedor e bloqueio não dependem da rede
    try {
      if (text) await this.post(s.groupId, text, mentions);
    } finally {
      s.status = status;
      if (this.sessions.get(s.groupId)?.gameId === s.gameId) {
        this.sessions.delete(s.groupId);
        this.cooldowns.set(
          s.groupId,
          Date.now() + this.config.get(s.groupId).cooldown * 1000,
        );
      }
    }
  }
  cancel(id: string) {
    return this.queue.run(id, async () => {
      const s = this.sessions.get(id);
      if (s)
        await this.finish(
          s,
          "CANCELLED",
          "🛑 Rodada encerrada pelo proprietário.",
        );
    });
  }
  disconnect() {
    this.generation++;
    this.ready = false;
    for (const s of this.sessions.values()) {
      clearTimeout(s.timeoutHandle);
      s.status = "CANCELLED";
    }
    this.sessions.clear();
  }
  shutdown() {
    this.disconnect();
    this.spam.clear();
  }
}
