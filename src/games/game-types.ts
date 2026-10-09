export const gameTypes = [
  "quiz",
  "numero",
  "palavra",
  "emoji",
  "forca",
] as const;
export type GameType = (typeof gameTypes)[number];
export type Status =
  | "IDLE"
  | "SELECTING"
  | "STARTING"
  | "ACTIVE"
  | "FINISHING"
  | "FINISHED"
  | "CANCELLED"
  | "EXPIRED";
export interface GameRound {
  answer: string;
  acceptedAnswers: string[];
  prompt: string;
  data: {
    word?: string;
    letters?: string[];
    remaining?: number;
    min?: number;
    max?: number;
    options?: string[];
  };
}
export interface GuessResult {
  valid: boolean;
  win?: boolean;
  loss?: boolean;
  update?: string;
}
export interface Game {
  create(recent: string[]): GameRound;
  guess(round: GameRound, text: string): GuessResult;
}
export interface Incoming {
  groupId: string;
  senderId: string;
  messageId: string;
  text: string;
  timestamp: number;
  quotedId?: string;
}
export type Send = (
  jid: string,
  text: string,
  mentions?: string[],
) => Promise<string>;
