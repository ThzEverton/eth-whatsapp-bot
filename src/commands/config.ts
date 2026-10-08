import { GroupQueue } from "../services/group-queue.js";
import { PermissionService } from "../services/permission-service.js";
import { groupJid, integer } from "../utils/normalize.js";
import { gameTypes, type Send, type GameType } from "../games/game-types.js";
import { GameManager } from "../games/game-manager.js";
export class ConfigCommand {
  private queue = new GroupQueue();
  constructor(
    private permissions: PermissionService,
    private manager: GameManager,
    private send: Send,
  ) {}
  isOwner(sender: string) {
    return this.permissions.isOwner(sender);
  }
  execute(chat: string, sender: string, args: string[]) {
    return this.queue.run("config", async () => {
      if (!this.permissions.isOwner(sender)) return; // não revela comandos a terceiros
      const store = this.manager.config;
      let target = chat;
      if (args[0] === "grupo" && args[1] && groupJid(args[1])) {
        target = args[1];
        args = args.slice(2);
      }
      const [cmd, a, b] = args;
      const cfg = store.get(target);
      const reply = (text: string) => this.send(chat, text);
      if (!cmd) {
        await reply(
          "⚙️ CONFIGURAÇÕES\n/config status\n/config jogos on|off\n/config modalidade quiz on|off\n/config tempo [quiz] 90\n/config cooldown 20\n/config palpites 2\n/config intervalo 1 100\n/config encerrar\n/config grupos listar|adicionar|remover JID\nNo privado: /config grupo JID comando",
        );
        return;
      }
      if (cmd === "status" && args.length === 1) {
        await reply(
          `Conexão: ${this.manager.ready ? "pronta" : "indisponível"}\nGrupos: ${store.groups.size}\nGrupo: ${target}\nPartida: ${this.manager.session(target)?.status || "IDLE"}\nJogos: ${cfg.enabled ? "on" : "off"}\nModalidades: ${gameTypes.map((t) => `${t}=${cfg.modes[t] ? "on" : "off"}`).join(", ")}\nTempos: ${gameTypes.map((t) => `${t}=${cfg.duration[t]}s`).join(", ")}\nIntervalo: ${cfg.cooldown}s\nPalpites: ${cfg.guessCooldown}s\nNúmeros: ${cfg.numberMin}–${cfg.numberMax}`,
        );
        return;
      }
      if (cmd === "grupos") {
        if (a === "listar" && args.length === 2) {
          await reply(
            [...store.groups].join("\n") || "Nenhum grupo autorizado.",
          );
          return;
        }
        if (
          !b ||
          !groupJid(b) ||
          args.length !== 3 ||
          !["adicionar", "remover"].includes(a!)
        ) {
          await reply("Use /config grupos adicionar|remover JID");
          return;
        }
        if (a === "adicionar") store.groups.add(b);
        else {
          store.groups.delete(b);
          await this.manager.cancel(b);
        }
        await store.save();
        await reply("Grupos atualizados.");
        return;
      }
      if (!groupJid(target) || !store.groups.has(target)) {
        await reply("Informe um grupo autorizado: /config grupo JID comando");
        return;
      }
      if (cmd === "encerrar" && args.length === 1) {
        await this.manager.cancel(target);
        await reply("Encerramento processado.");
        return;
      }
      if (cmd === "jogos" && args.length === 2 && ["on", "off"].includes(a!)) {
        cfg.enabled = a === "on";
        if (!cfg.enabled) await this.manager.cancel(target);
      } else if (
        cmd === "modalidade" &&
        args.length === 3 &&
        gameTypes.includes(a as GameType) &&
        ["on", "off"].includes(b!)
      ) {
        cfg.modes[a as GameType] = b === "on";
        if (b === "off" && this.manager.session(target)?.gameType === a)
          await this.manager.cancel(target);
      } else if (
        cmd === "tempo" &&
        args.length === 2 &&
        integer(a!, 10, 600) !== undefined
      ) {
        for (const t of gameTypes) cfg.duration[t] = Number(a);
      } else if (
        cmd === "tempo" &&
        args.length === 3 &&
        gameTypes.includes(a as GameType) &&
        integer(b!, 10, 600) !== undefined
      ) {
        cfg.duration[a as GameType] = Number(b);
      } else if (
        cmd === "cooldown" &&
        args.length === 2 &&
        integer(a!, 0, 3600) !== undefined
      )
        cfg.cooldown = Number(a);
      else if (
        cmd === "palpites" &&
        args.length === 2 &&
        integer(a!, 0, 60) !== undefined
      )
        cfg.guessCooldown = Number(a);
      else if (
        cmd === "intervalo" &&
        args.length === 3 &&
        integer(a!, 1, 1000000) !== undefined &&
        integer(b!, 1, 1000000) !== undefined &&
        Number(a) < Number(b)
      ) {
        cfg.numberMin = Number(a);
        cfg.numberMax = Number(b);
      } else {
        await reply(
          "Comando inválido. Tempos: 10–600s; cooldown: 0–3600s; palpites: 0–60s; intervalo: 1–1000000.",
        );
        return;
      }
      store.set(target, cfg);
      await store.save();
      await reply(
        "✅ Configuração atualizada. Tempos e intervalo numérico valem na próxima rodada.",
      );
    });
  }
}
