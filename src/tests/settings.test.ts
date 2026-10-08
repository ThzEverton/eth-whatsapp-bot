import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigStore } from "../config/settings.js";

it("persiste JSON completo e recarrega configurações sem partidas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "game-bot-test-"));
  try {
    const file = join(dir, "config.json"),
      store = new ConfigStore(["123@g.us"], file);
    const settings = store.get("123@g.us");
    settings.duration.quiz = 90;
    settings.variants!.quiz = "espaco";
    store.set("123@g.us", settings);
    store.groups.add("456@g.us");
    await Promise.all([store.save(), store.save()]);
    const restored = new ConfigStore(["789@g.us"], file);
    await restored.load();
    expect(restored.get("123@g.us").duration.quiz).toBe(90);
    expect(restored.get("123@g.us").variants?.quiz).toBe("espaco");
    expect([...restored.groups]).toEqual(["123@g.us", "456@g.us"]);
    expect(JSON.parse(await readFile(file, "utf8")).sessions).toBeUndefined();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("JSON corrompido não é silenciosamente aceito", async () => {
  const dir = await mkdtemp(join(tmpdir(), "game-bot-test-"));
  try {
    const file = join(dir, "config.json");
    await writeFile(file, '{"groups":["not-a-group"]}');
    await expect(new ConfigStore(["123@g.us"], file).load()).rejects.toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
