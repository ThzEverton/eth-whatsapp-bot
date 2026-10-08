import type { GameRound, GameType, Status } from "./game-types.js";
export interface GameSession {
  groupId: string;
  gameId: string;
  gameType?: GameType;
  status: Status;
  startedBy: string;
  createdAt: number;
  startedAt?: number;
  expiresAt: number;
  answer?: string;
  acceptedAnswers?: string[];
  winnerId?: string;
  winnerMessageId?: string;
  roundData?: GameRound;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  questionMessageId?: string;
}
