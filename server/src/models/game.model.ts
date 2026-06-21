import { Chess } from "chess.js";
import type { AppServer } from "../socket/types";
import { getRoomById, updateRoomGameState } from "./room.model";

const GRACE_PERIOD_MS = 30_000;

interface TimeControl {
  whiteTimeLeft: number;
  blackTimeLeft: number;
  lastMoveTime: number;
  started: boolean;
  timerId?: ReturnType<typeof setTimeout>;
  timerForColor?: "w" | "b";
}

interface GameSession {
  chess: Chess;
  gracePeriod?: {
    timer: ReturnType<typeof setTimeout>;
    disconnectedPlayerId: string;
  };
  timeControl: TimeControl;
}

export type TimeSnapshot = Pick<TimeControl, "whiteTimeLeft" | "blackTimeLeft">;

const gameStateMap = new Map<string, GameSession>();

let io: AppServer | null = null;

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

export function setGameIo(server: AppServer): void {
  io = server;
}

export function getOrCreateGame(roomId: string, gameSession: {
  fen: string;
  timeControl: TimeControl;
}): GameSession {
  const existing = gameStateMap.get(roomId);

  if (existing) {
    return existing;
  }

  const chess = new Chess(gameSession.fen);
  const newGameSession: GameSession = {
    chess,
    timeControl: {
      ...gameSession.timeControl,
      started: gameSession.timeControl.started ?? false,
    },
  };
  gameStateMap.set(roomId, newGameSession);
  return newGameSession;
}

export function getGame(roomId: string): GameSession | undefined {
  return gameStateMap.get(roomId);
}

export function removeGame(roomId: string): void {
  const session = gameStateMap.get(roomId);
  clearGameTimer(roomId);
  if (session?.gracePeriod) {
    clearTimeout(session.gracePeriod.timer);
  }
  gameStateMap.delete(roomId);
}

export function clearGameTimer(roomId: string): void {
  const session = gameStateMap.get(roomId);
  if (!session) {
    return;
  }

  if (session.timeControl.timerId) {
    clearTimeout(session.timeControl.timerId);
  }

  delete session.timeControl.timerId;
  delete session.timeControl.timerForColor;
}

export function startClock(roomId: string): TimeSnapshot | undefined {
  const session = gameStateMap.get(roomId);
  if (!session) {
    return undefined;
  }

  if (session.timeControl.started) {
    if (!session.timeControl.timerId) {
      startGameTimer(roomId);
    }

    return getTimeSnapshot(roomId);
  }

  session.timeControl.started = true;
  session.timeControl.lastMoveTime = Date.now();
  startGameTimer(roomId);
  return getTimeSnapshot(roomId);
}

export function startGameTimer(roomId: string): void {
  const session = gameStateMap.get(roomId);
  if (!session?.timeControl.started) {
    return;
  }

  clearGameTimer(roomId);

  const colorToMove = session.chess.turn();
  const timeLeft =
    colorToMove === "w"
      ? session.timeControl.whiteTimeLeft
      : session.timeControl.blackTimeLeft;

  session.timeControl.timerForColor = colorToMove;

  if (timeLeft <= 0) {
    void handleTimeExpired(roomId, colorToMove);
    return;
  }

  session.timeControl.timerId = setTimeout(() => {
    void handleTimeExpired(roomId, colorToMove);
  }, timeLeft);
}

export function applyMoveTime(
  roomId: string,
  playerColor: "w" | "b",
): TimeSnapshot | undefined {
  const session = gameStateMap.get(roomId);
  if (!session?.timeControl.started) {
    return getTimeSnapshot(roomId);
  }

  const now = Date.now();
  const elapsed = Math.max(0, now - session.timeControl.lastMoveTime);

  if (playerColor === "w") {
    session.timeControl.whiteTimeLeft = Math.max(
      0,
      session.timeControl.whiteTimeLeft - elapsed,
    );
  } else {
    session.timeControl.blackTimeLeft = Math.max(
      0,
      session.timeControl.blackTimeLeft - elapsed,
    );
  }

  session.timeControl.lastMoveTime = now;

  return getTimeSnapshot(roomId);
}

export function getTimeSnapshot(roomId: string): TimeSnapshot | undefined {
  const session = gameStateMap.get(roomId);
  if (!session) {
    return undefined;
  }

  const { timeControl } = session;
  if (!timeControl.started || !timeControl.timerForColor) {
    return {
      whiteTimeLeft: timeControl.whiteTimeLeft,
      blackTimeLeft: timeControl.blackTimeLeft,
    };
  }

  const elapsed = Math.max(0, Date.now() - timeControl.lastMoveTime);

  if (timeControl.timerForColor === "w") {
    return {
      whiteTimeLeft: Math.max(0, timeControl.whiteTimeLeft - elapsed),
      blackTimeLeft: timeControl.blackTimeLeft,
    };
  }

  return {
    whiteTimeLeft: timeControl.whiteTimeLeft,
    blackTimeLeft: Math.max(0, timeControl.blackTimeLeft - elapsed),
  };
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
    const times = getTimeSnapshot(roomId);
    await updateRoomGameState({
      id: roomId,
      status: "ABANDONED",
      fen,
      whiteTime: times?.whiteTimeLeft,
      blackTime: times?.blackTimeLeft,
    });

    io?.to(roomChannel(roomId)).emit("room:abandoned", {
      fen,
      status: "ABANDONED",
      abandonedBy,
    });
  } finally {
    removeGame(roomId);
  }
}

async function handleTimeExpired(
  roomId: string,
  timedOutColor: "w" | "b",
): Promise<void> {
  const session = gameStateMap.get(roomId);
  if (!session || session.timeControl.timerForColor !== timedOutColor) {
    return;
  }

  try {
    const room = await getRoomById(roomId);
    if (!room || room.status !== "PLAYING") {
      return;
    }

    cancelGracePeriod(roomId);
    clearGameTimer(roomId);

    if (timedOutColor === "w") {
      session.timeControl.whiteTimeLeft = 0;
    } else {
      session.timeControl.blackTimeLeft = 0;
    }

    const fen = session.chess.fen();
    const winner = timedOutColor === "w" ? "black" : "white";

    await updateRoomGameState({
      id: roomId,
      status: "COMPLETED",
      fen,
      whiteTime: session.timeControl.whiteTimeLeft,
      blackTime: session.timeControl.blackTimeLeft,
    });

    io?.to(roomChannel(roomId)).emit("room:game-over", {
      winner,
      reason: "timeout",
    });
  } finally {
    removeGame(roomId);
  }
}
