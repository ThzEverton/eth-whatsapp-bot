import { groupJid, userJid } from "../utils/normalize.js";
import type { Incoming } from "../games/game-types.js";
export function validIncoming(m: Incoming) {
  return (
    !!m &&
    typeof m.groupId === "string" &&
    groupJid(m.groupId) &&
    !!userJid(m.senderId) &&
    typeof m.messageId === "string" &&
    m.messageId.length > 0 &&
    m.messageId.length <= 200 &&
    typeof m.text === "string" &&
    m.text.length > 0 &&
    m.text.length <= 500 &&
    Number.isFinite(m.timestamp)
  );
}
