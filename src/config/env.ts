import "dotenv/config";
import { groupJid, userJid } from "../utils/normalize.js";
export function loadEnv() {
  const owner = userJid(process.env.OWNER_JID);
  if (process.env.OWNER_JID && !owner)
    throw new Error("OWNER_JID deve ser um JID PN ou LID válido.");
  const groups = (process.env.ALLOWED_GROUP_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (groups.some((s) => !groupJid(s)))
    throw new Error(
      "ALLOWED_GROUP_IDS deve conter JIDs de grupos separados por vírgula.",
    );
  return {
    owner: owner || "",
    groups,
    authDir: process.env.AUTH_DIR || "./auth",
    configFile: process.env.CONFIG_FILE || "./runtime/config.json",
  };
}
