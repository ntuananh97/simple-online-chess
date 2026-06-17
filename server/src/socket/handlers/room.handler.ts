import {

  cancelGracePeriod,

  getGame,

  getOrCreateGame,

  handleAbandonedRoom,

  isGracePeriodActive,

  startGracePeriod,

} from "../../models/game.model";

import {

  getRoomById,

  getRoomGameState,

  JoinRoomError,

  updateRoomGameState,

} from "../../models/room.model";

import { IGameOverPayload } from "../../types/socket.types";

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

      const room = await getRoomGameState(code, playerId);



      if (socket.data.roomId && socket.data.roomId !== room.id) {

        await socket.leave(roomChannel(socket.data.roomId));

      }



      socket.data.playerId = playerId;

      socket.data.roomId = room.id;

      socket.data.playerColor = room.whiteId === playerId ? "w" : "b";

      await socket.join(roomChannel(room.id));



      cancelGracePeriod(room.id, playerId);



      const chess = getOrCreateGame(room.id, room.fen);



      socket.emit("room:state", {

        id: room.id,

        code: room.code,

        status: room.status,

        fen: chess.fen(),

        turn: chess.turn(),

        whiteId: room.whiteId,

        blackId: room.blackId,

      });



      socket.to(roomChannel(room.id)).emit("room:player-joined", {

        playerId,

        status: room.status,

      });



      ack?.({

        ok: true,

        room: {

          id: room.id,

          code: room.code,

          status: room.status,

          createdAt: room.createdAt,

        },

      });

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



  socket.on("room:move", async (payload) => {

    const move = payload?.move;

    const roomId = payload?.roomId;

    const { roomId: sessionRoomId, playerId, playerColor } = socket.data;



    if (!move || !sessionRoomId || !playerId || !playerColor) {

      return;

    }



    if (roomId && roomId !== sessionRoomId) {

      emitMoveRejected({

        socket,

        fen: getGame(sessionRoomId)?.fen() ?? "",

        error: "Room mismatch",

      });

      return;

    }



    if (isGracePeriodActive(sessionRoomId)) {

      emitMoveRejected({

        socket,

        fen: getGame(sessionRoomId)?.fen() ?? "",

        error: "Opponent disconnected",

      });

      return;

    }



    const chess = getGame(sessionRoomId);



    if (!chess) {

      emitMoveRejected({

        socket,

        fen: "",

        error: "Game not initialized",

      });

      return;

    }



    if (chess.turn() !== playerColor) {

      emitMoveRejected({

        socket,

        fen: chess.fen(),

        error: "Not your turn",

      });

      return;

    }



    try {

      const result = chess.move(move);

      if (result) {

        socket.to(roomChannel(sessionRoomId)).emit("room:move-made", move);

        const isGameOver = chess.isGameOver();



        let winner = null;

        let reason = "draw";

        if (chess.isCheckmate()) {

          winner = chess.turn() === "w" ? "black" : "white";

          reason = "checkmate";

        }

        if (isGameOver) {

          cancelGracePeriod(sessionRoomId);

          socket.nsp.to(roomChannel(sessionRoomId)).emit("room:game-over", {

            winner,

            reason,

          } as IGameOverPayload);

          updateRoomGameState({

            id: sessionRoomId,

            status: "COMPLETED",

          });

        }

      } else {

        emitMoveRejected({

          socket,

          fen: chess.fen(),

          error: "Invalid move",

        });

      }

    } catch {

      emitMoveRejected({

        socket,

        fen: chess.fen(),

        error: "Internal server error",

      });

    }

  });

}



const emitMoveRejected = ({

  socket,

  fen,

  error,

}: {

  socket: AppSocket;

  fen: string;

  error: string;

}) => {

  socket.emit("room:move-rejected", { fen, error });

};



async function leaveRoom(socket: AppSocket): Promise<void> {

  const { playerId, roomId } = socket.data;



  if (!playerId || !roomId) {

    return;

  }



  const channel = roomChannel(roomId);

  await socket.leave(channel);



  socket.to(channel).emit("room:player-left", { playerId });



  const room = await getRoomById(roomId);

  if (room?.status === "PLAYING") {

    const remainingSockets = await socket.in(channel).fetchSockets();

    if (remainingSockets.length > 0) {

      startGracePeriod(roomId, playerId);

    }
    else {
      void handleAbandonedRoom(roomId, 'both');
    }

  }



  socket.data.playerId = undefined;

  socket.data.roomId = undefined;

  socket.data.playerColor = undefined;

}


