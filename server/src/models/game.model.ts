import { Chess } from "chess.js";

const gameStateMap = new Map<string, Chess>();

export function getOrCreateGame(roomId: string, fen: string): Chess {
  const existing = gameStateMap.get(roomId);

  if (existing) {
    return existing;
  }

  const chess = new Chess(fen);
  gameStateMap.set(roomId, chess);
  return chess;
}

export function getGame(roomId: string): Chess | undefined {
  return gameStateMap.get(roomId);
}

export function removeGame(roomId: string): void {
  gameStateMap.delete(roomId);
}
