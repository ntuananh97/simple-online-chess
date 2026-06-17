import { Chess } from "chess.js";
import type { AppServer } from "../socket/types";
import { getRoomById, updateRoomGameState } from "./room.model";

const GRACE_PERIOD_MS = 30_000;

interface GameSession {
  chess: Chess;
  gracePeriod?: {
    timer: ReturnType<typeof setTimeout>;
    disconnectedPlayerId: string;
  };
}

const gameStateMap = new Map<string, GameSession>();

let io: AppServer | null = null;

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

export function setGameIo(server: AppServer): void {
  io = server;
}

export function getOrCreateGame(roomId: string, fen: string): Chess {
  const existing = gameStateMap.get(roomId);

  if (existing) {
    return existing.chess;
  }

  const chess = new Chess(fen);
  gameStateMap.set(roomId, { chess });
  return chess;
}

export function getGame(roomId: string): Chess | undefined {
  return gameStateMap.get(roomId)?.chess;
}

export function removeGame(roomId: string): void {
  const session = gameStateMap.get(roomId);
  if (session?.gracePeriod) {
    clearTimeout(session.gracePeriod.timer);
  }
  gameStateMap.delete(roomId);
}

export function isGracePeriodActive(roomId: string): boolean {
  return !!gameStateMap.get(roomId)?.gracePeriod;
}

export function startGracePeriod(
  roomId: string,
  disconnectedPlayerId: string,
): void {
  const session = gameStateMap.get(roomId);
  if (!session) {
    return;
  }

  cancelGracePeriod(roomId);

  const timer = setTimeout(() => {
    void handleGracePeriodTimeout(roomId, disconnectedPlayerId);
  }, GRACE_PERIOD_MS);

  session.gracePeriod = { timer, disconnectedPlayerId };
}

export function cancelGracePeriod(
  roomId: string,
  reconnectingPlayerId?: string,
): void {
  const session = gameStateMap.get(roomId);
  if (!session?.gracePeriod) {
    return;
  }

  if (
    reconnectingPlayerId !== undefined &&
    session.gracePeriod.disconnectedPlayerId !== reconnectingPlayerId
  ) {
    return;
  }

  clearTimeout(session.gracePeriod.timer);
  delete session.gracePeriod;
}

async function handleGracePeriodTimeout(
  roomId: string,
  disconnectedPlayerId: string,
): Promise<void> {
  const session = gameStateMap.get(roomId);
  if (
    !session?.gracePeriod ||
    session.gracePeriod.disconnectedPlayerId !== disconnectedPlayerId
  ) {
    return;
  }

  void handleAbandonedRoom(roomId, disconnectedPlayerId);

  // try {
  //   const room = await getRoomById(roomId);
  //   if (!room || room.status !== "PLAYING") {
  //     cancelGracePeriod(roomId);
  //     return;
  //   }

  //   const fen = session.chess.fen();
  //   await updateRoomGameState({ id: roomId, status: "ABANDONED", fen });

  //   io?.to(roomChannel(roomId)).emit("room:abandoned", {
  //     fen,
  //     status: "ABANDONED",
  //     abandonedBy: disconnectedPlayerId,
  //   });
  // } finally {
  //   removeGame(roomId);
  // }
}

export const handleAbandonedRoom = async (roomId: string, abandonedBy: string): Promise<void> => {
  const session = gameStateMap.get(roomId);
  if (!session) {
    return;
  }
  try {
    const room = await getRoomById(roomId);
    if (!room || room.status !== "PLAYING") {
      cancelGracePeriod(roomId);
      return;
    }

    const fen = session.chess.fen();
    await updateRoomGameState({ id: roomId, status: "ABANDONED", fen });

    io?.to(roomChannel(roomId)).emit("room:abandoned", {
      fen,
      status: "ABANDONED",
      abandonedBy,
    });
  } finally {
    removeGame(roomId);
  }
}
