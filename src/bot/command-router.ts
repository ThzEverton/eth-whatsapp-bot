import { type GameType, type Incoming } from "../games/game-types.js";
import { validVariant } from "../data/variants.js";
import { GameManager } from "../games/game-manager.js";
export async function routeGame(m: Incoming, manager: GameManager) {
  if (m.text.trim() === "/bot") {
    await manager.introduce(m.groupId);
    return;
  }
  const match =
    /^\/jogo(?: (quiz|numero|palavra|emoji|forca)(?: ([a-z]+))?)?$/.exec(
      m.text.trim(),
    );
  if (match) {
    if (match[2] && !validVariant(match[2])) return;
    await manager.request(
      m.groupId,
      m.senderId,
      match[1] as GameType | undefined,
      match[2],
    );
    return;
  }
  if (/^\/jogo(?:\s|$)/.test(m.text)) return;
  await manager.answer(m);
}
