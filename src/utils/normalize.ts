export const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, " ");
export const userJid = (s: unknown): string | undefined => {
  if (typeof s !== "string") return;
  const m = /^(\d+)(?::\d+)?@(s\.whatsapp\.net|lid)$/.exec(s);
  return m ? `${m[1]}@${m[2]}` : undefined;
};
export const groupJid = (s: string) => /^\d+(?:-\d+)?@g\.us$/.test(s);
export function integer(
  s: string,
  min: number,
  max: number,
): number | undefined {
  if (!/^\d+$/.test(s)) return;
  const n = Number(s);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : undefined;
}
