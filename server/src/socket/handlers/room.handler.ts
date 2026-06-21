import {

  applyMoveTime,

  cancelGracePeriod,

  getGame,

  getTimeSnapshot,

  getOrCreateGame,

  handleAbandonedRoom,

  isGracePeriodActive,

  removeGame,

  startClock,

  startGameTimer,

  startGracePeriod,

} from "../../models/game.model";

import {

  getRoomById,

  getRoomGameState,

  JoinRoomError,

  updateRoomGameState,

} from "../../models/room.model";

import type { IGameOverPayload } from "../../types/socket.types";

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


      const defaultGameSession = {
        fen: room.fen,
        timeControl: {
          whiteTimeLeft: room.whiteTime,
          blackTimeLeft: room.blackTime,
          lastMoveTime: Date.now(),
          started: false,
        },
      };
      const roomGameSession = getOrCreateGame(room.id, defaultGameSession);
      const chess = roomGameSession.chess;
      const times =
        room.status === "PLAYING" ? startClock(room.id) : getTimeSnapshot(room.id);
        const whiteTimeLeft = times?.whiteTimeLeft ?? roomGameSession.timeControl.whiteTimeLeft;
        const blackTimeLeft = times?.blackTimeLeft ?? roomGameSession.timeControl.blackTimeLeft;



      socket.emit("room:state", {

        id: room.id,

        code: room.code,

        status: room.status,

        fen: chess.fen(),

        turn: chess.turn(),

        whiteId: room.whiteId,

        blackId: room.blackId,
        whiteTimeLeft,
        blackTimeLeft,

      });



      socket.to(roomChannel(room.id)).emit("room:player-joined", {

        playerId,

        status: room.status,
        time: {
          whiteTimeLeft,
          blackTimeLeft,
        }
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



  socket.on("room:move", async (payload, ack) => {

    const move = payload?.move;

    const roomId = payload?.roomId;

    const { roomId: sessionRoomId, playerId, playerColor } = socket.data;



    if (!move || !sessionRoomId || !playerId || !playerColor) {

      return;

    }

    const roomGameSession = getGame(sessionRoomId);
    if (!roomGameSession) {
      emitMoveRejected({
        socket,
        fen: "",
        error: "Game not initialized",
      });
      return;
    }

    const chess = roomGameSession.chess;



    if (roomId && roomId !== sessionRoomId) {

      emitMoveRejected({

        socket,

        fen: chess.fen(),

        error: "Room mismatch",

      });

      return;

    }



    if (isGracePeriodActive(sessionRoomId)) {

      emitMoveRejected({

        socket,

        fen: chess.fen(),

        error: "Opponent disconnected",

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

        const times = applyMoveTime(sessionRoomId, playerColor);

        if (!times) {
          emitMoveRejected({
            socket,
            fen: chess.fen(),
            error: "Game not initialized",
          });
          return;
        }

        socket.to(roomChannel(sessionRoomId)).emit("room:move-made", {
          ...move,
          whiteTimeLeft: times.whiteTimeLeft,
          blackTimeLeft: times.blackTimeLeft,
        });

        ack?.(times);

        const isGameOver = chess.isGameOver();



        let winner: IGameOverPayload["winner"] = null;

        let reason: IGameOverPayload["reason"] = "draw";

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

          await updateRoomGameState({

            id: sessionRoomId,

            fen: chess.fen(),

            status: "COMPLETED",

            whiteTime: times.whiteTimeLeft,

            blackTime: times.blackTimeLeft,

          });

          removeGame(sessionRoomId);

        } else {

          startGameTimer(sessionRoomId);

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


