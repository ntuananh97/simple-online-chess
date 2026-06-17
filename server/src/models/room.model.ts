import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import type { RoomData, RoomGameState } from "../types/room.types";

export class JoinRoomError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "JoinRoomError";
  }
}

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 5;

function generateRoomCode(): string {
  const bytes = randomBytes(ROOM_CODE_LENGTH);
  let code = "";

  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[bytes[i]! % ROOM_CODE_CHARS.length];
  }

  return code;
}

export async function createRoom(whiteId: string): Promise<RoomData> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();

    try {
      const room = await prisma.room.create({
        data: { roomCode: code, whiteId },
      });

      return {
        id: room.id,
        code: room.roomCode,
        status: room.status,
        createdAt: room.createdAt,
      };
    } catch (error) {
     

      throw error;

    }
  }

  throw new Error("Failed to generate a unique room code");
}

export async function joinRoom(code: string, blackId: string): Promise<RoomData> {
  const room = await prisma.room.findUnique({
    where: { roomCode: code.toUpperCase() },
  });

  if (!room) {
    throw new JoinRoomError("Room not found", 404);
  }

  if (room.whiteId === blackId) {
    throw new JoinRoomError("Cannot join your own room", 400);
  }

  if (room.blackId) {
    if (room.blackId === blackId) {
      return {
        id: room.id,
        code: room.roomCode,
        status: room.status,
        createdAt: room.createdAt,
      };
    }

    throw new JoinRoomError("Room is full", 409);
  }

  if (room.status !== "WAITING") {
    throw new JoinRoomError("Room is not available", 409);
  }

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: {
      blackId,
      status: "PLAYING",
    },
  });

  return {
    id: updated.id,
    code: updated.roomCode,
    status: updated.status,
    createdAt: updated.createdAt,
  };
}

export async function verifyRoomAccess(
  code: string,
  playerId: string,
): Promise<RoomData> {
  const room = await prisma.room.findUnique({
    where: { roomCode: code.toUpperCase() },
  });

  if (!room) {
    throw new JoinRoomError("Room not found", 404);
  }

  if (room.whiteId !== playerId && room.blackId !== playerId) {
    throw new JoinRoomError("Not a member of this room", 403);
  }

  return {
    id: room.id,
    code: room.roomCode,
    status: room.status,
    createdAt: room.createdAt,
  };
}

export async function getRoomById(id: string): Promise<RoomData | null> {
  const room = await prisma.room.findUnique({
    where: { id },
  });

  if (!room) {
    return null;
  }

  return {
    id: room.id,
    code: room.roomCode,
    status: room.status,
    createdAt: room.createdAt,
  };
}

export async function getRoomGameState(
  code: string,
  playerId: string,
): Promise<RoomGameState> {
  const room = await prisma.room.findUnique({
    where: { roomCode: code.toUpperCase() },
  });

  if (!room) {
    throw new JoinRoomError("Room not found", 404);
  }

  if (room.whiteId !== playerId && room.blackId !== playerId) {
    throw new JoinRoomError("Not a member of this room", 403);
  }

  return {
    id: room.id,
    code: room.roomCode,
    status: room.status,
    fen: room.fen,
    whiteId: room.whiteId,
    blackId: room.blackId,
    createdAt: room.createdAt,
  };
}

export async function updateRoomGameState(
  payload: Partial<RoomGameState>,
): Promise<RoomGameState> {
  const { id, fen, status } = payload;
  if (!id) {
    throw new JoinRoomError("Room ID is required", 400);
  }

  if (!fen && !status) {
    throw new JoinRoomError("FEN or status is required", 400);
  }

  const room = await prisma.room.findUnique({
    where: { id },
  });

  if (!room) {
    throw new JoinRoomError("Room not found", 404);
  }

  const updated = await prisma.room.update({
    where: { id },
    data: { fen, status },
  });

  return {
    id: updated.id,
    code: updated.roomCode,
    status: updated.status,
    fen: updated.fen,
    whiteId: updated.whiteId,
    blackId: updated.blackId,
    createdAt: updated.createdAt,
  };
}
 