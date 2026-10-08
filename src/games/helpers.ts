import { randomInt } from "node:crypto";
export function pick<T>(
  items: readonly T[],
  recent: string[],
  key: (v: T) => string,
): T {
  const eligible = items.filter((v) => !recent.includes(key(v)));
  const pool = eligible.length ? eligible : items;
  return pool[randomInt(pool.length)]!;
}
