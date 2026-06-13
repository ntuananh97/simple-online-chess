import { verifyRoomAccess, JoinRoomError } from "../../models/room.model";
import type { AppSocket } from "../types";

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

export function registerRoomHandlers(socket: AppSocket): void {
  socket.on("room:join", async (payload, ack) => {
    const { code, playerId } = payload;

    if (!code || !playerId) {
      ack?.({ ok: false, error: "code and playerId are required" });
      return;
    }

    try {
      const room = await verifyRoomAccess(code, playerId);

      if (socket.data.roomId && socket.data.roomId !== room.id) {
        await socket.leave(roomChannel(socket.data.roomId));
      }

      socket.data.playerId = playerId;
      socket.data.roomId = room.id;
      await socket.join(roomChannel(room.id));

      socket.to(roomChannel(room.id)).emit("room:player-joined", {
        playerId,
        status: room.status,
      });

      ack?.({ ok: true, room });
    } catch (error) {
      const message =
        error instanceof JoinRoomError
          ? error.message
          : "Failed to join room";

      ack?.({ ok: false, error: message });
    }
  });

  socket.on("room:leave", async () => {
    await leaveRoom(socket);
  });

  socket.on("disconnect", () => {
    void leaveRoom(socket);
  });
}

async function leaveRoom(socket: AppSocket): Promise<void> {
  const { playerId, roomId } = socket.data;

  if (!playerId || !roomId) {
    return;
  }

  await socket.leave(roomChannel(roomId));

  socket.to(roomChannel(roomId)).emit("room:player-left", { playerId });

  socket.data.playerId = undefined;
  socket.data.roomId = undefined;
}
