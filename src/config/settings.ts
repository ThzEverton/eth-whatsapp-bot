import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gameTypes, type GameType } from "../games/game-types.js";
import { validVariant } from "../data/variants.js";
import { groupJid } from "../utils/normalize.js";
export interface Settings {
  variants?: Record<GameType, string>;
  enabled: boolean;
  modes: Record<GameType, boolean>;
  duration: Record<GameType, number>;
  cooldown: number;
  guessCooldown: number;
  selection: number;
  numberMin: number;
  numberMax: number;
}
export const defaults = (): Settings => ({
  variants: {
    quiz: "classico",
    numero: "classico",
    palavra: "classico",
    emoji: "classico",
    forca: "classico",
  },
  enabled: true,
  modes: { quiz: true, numero: true, palavra: true, emoji: true, forca: true },
  duration: { quiz: 60, numero: 90, palavra: 90, emoji: 90, forca: 120 },
  cooldown: 20,
  guessCooldown: 2,
  selection: 30,
  numberMin: 1,
  numberMax: 100,
});
export class ConfigStore {
  groups: Set<string>;
  private overrides = new Map<string, Settings>();
  private saves = Promise.resolve();
  constructor(
    groups: string[],
    private file?: string,
  ) {
    this.groups = new Set(groups);
  }
  get(id: string) {
    const value = this.overrides.get(id) || defaults();
    return structuredClone({
      ...value,
      variants: value.variants || defaults().variants,
    });
  }
  set(id: string, value: Settings) {
    this.overrides.set(id, structuredClone(value));
  }
  async load() {
    if (!this.file) return;
    let raw: string;
    try {
      raw = await readFile(this.file, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
    const data = JSON.parse(raw);
    if (
      !Array.isArray(data.groups) ||
      data.groups.some((s: unknown) => typeof s !== "string" || !groupJid(s))
    )
      throw new Error("Configuração de grupos inválida");
    const entries = Object.entries(data.settings || {});
    for (const [id, s] of entries) {
      const v = s as Settings;
      if (
        (v.variants !== undefined &&
          gameTypes.some((t) => !validVariant(v.variants?.[t]))) ||
        !groupJid(id) ||
        typeof v.enabled !== "boolean" ||
        gameTypes.some(
          (t) =>
            typeof v.modes?.[t] !== "boolean" ||
            !Number.isInteger(v.duration?.[t]) ||
            v.duration[t] < 10 ||
            v.duration[t] > 600,
        ) ||
        !Number.isInteger(v.cooldown) ||
        v.cooldown < 0 ||
        v.cooldown > 3600 ||
        !Number.isInteger(v.guessCooldown) ||
        v.guessCooldown < 0 ||
        v.guessCooldown > 60 ||
        v.selection !== 30 ||
        !Number.isInteger(v.numberMin) ||
        !Number.isInteger(v.numberMax) ||
        v.numberMin < 1 ||
        v.numberMax > 1000000 ||
        v.numberMin >= v.numberMax
      )
        throw new Error("Configuração local inválida");
    }
    this.groups = new Set(data.groups);
    for (const [id, s] of entries) this.set(id, s as Settings);
  }
  save() {
    if (!this.file) return Promise.resolve();
    const file = this.file,
      data = JSON.stringify(
        {
          groups: [...this.groups],
          settings: Object.fromEntries(this.overrides),
        },
        null,
        2,
      );
    const operation = this.saves
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file + ".tmp", data, { mode: 0o600 });
        await rename(file + ".tmp", file);
      });
    this.saves = operation;
    return operation;
  }
}
