"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChessBoard, type UseChessBoardReturn } from "@/hooks/useChessBoard";
import { useListenEvent } from "@/hooks/useListenEvent";
import { useSocket } from "@/providers/SocketProvider";
import { useUserStore } from "@/stores/useUserStore";
import type { ChessColor, IChessMove } from "@/types/chess.types";
import type { RoomStatus } from "@/types/room.types";
import type { IGameOverPayload, RoomStatePayload } from "@/types/socket.types";

interface UseOnlineGameReturn {
  board: UseChessBoardReturn;
  orientation: "white" | "black";
  status: RoomStatus | null;
  gameState: RoomStatePayload | null;
  gameOver: IGameOverPayload | null;
  opponentDisconnected: boolean;
  isLoading: boolean;
  userId: string;
  handleLeaveRoom: () => void;
}

export function useOnlineGame(roomCode: string): UseOnlineGameReturn {
  const router = useRouter();
  const { socket } = useSocket();
  const getUserId = useUserStore((state) => state.getUserId);
  const userId = getUserId();

  const [gameState, setGameState] = useState<RoomStatePayload | null>(null);
  const [gameOver, setGameOver] = useState<IGameOverPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const gameStateRef = useRef<RoomStatePayload | null>(null);

  const playerColor = useMemo<ChessColor | null>(() => {
    if (!gameState) {
      return null;
    }

    if (gameState.whiteId === userId) {
      return "w";
    }

    if (gameState.blackId === userId) {
      return "b";
    }

    return null;
  }, [gameState, userId]);

  const orientation: "white" | "black" =
    playerColor === "b" ? "black" : "white";
  const applyMoveRef = useRef<(move: IChessMove) => void>(() => {});

  const board = useChessBoard({
    onMoveIntent: (move) => {
      const currentGameState = gameStateRef.current;
      if (!currentGameState) {
        return;
      }

      applyMoveRef.current(move);
      socket.emit("room:move", { move, roomId: currentGameState.id });
    },
    policy: {
      interactive: gameState?.status === "PLAYING" && !gameOver,
      controllableColors: playerColor ? [playerColor] : [],
      autoPromote: "q",
    },
  });

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    applyMoveRef.current = board.applyMove;
  }, [board.applyMove]);

  const handleLeaveRoom = useCallback(() => {
    socket.emit("room:leave");
    router.push("/");
  }, [router, socket]);

  useEffect(() => {
    const joinRoom = () => {
      socket.emit("room:join", { code: roomCode, playerId: userId });
    };

    if (socket.connected) {
      joinRoom();
    }

    socket.on("connect", joinRoom);

    return () => {
      socket.off("connect", joinRoom);
      socket.emit("room:leave");
    };
  }, [roomCode, socket, userId]);

  useListenEvent("room:player-joined", (data) => {
    if (data.playerId !== userId) {
      setOpponentDisconnected(false);
    }

    setGameState(
      (prev) =>
        ({
          ...(prev ?? {}),
          status: data.status,
        }) as RoomStatePayload,
    );
  });

  useListenEvent("room:player-left", (data) => {
    if (data.playerId !== userId) {
      setOpponentDisconnected(true);
    }
  });

  useListenEvent("room:state", (data) => {
    setGameState(data);
    board.loadFen(data.fen);
    setIsLoading(false);
  });

  useListenEvent("room:move-rejected", (data) => {
    board.loadFen(data.fen);
  });

  useListenEvent("room:move-made", (data) => {
    board.applyMove(data);
  });

  useListenEvent("room:game-over", (data) => {
    setGameOver(data);
    setGameState(
      (prev) =>
        ({
          ...(prev ?? {}),
          status: "COMPLETED",
        }) as RoomStatePayload,
    );
  });

  useListenEvent("room:abandoned", (data) => {
    setOpponentDisconnected(false);
    board.loadFen(data.fen);
    setGameOver({ winner: null, reason: "abandoned" });
    setGameState(
      (prev) =>
        ({
          ...(prev ?? {}),
          status: "ABANDONED",
          fen: data.fen,
        }) as RoomStatePayload,
    );
  });

  return {
    board,
    orientation,
    status: (gameState?.status ?? null) as RoomStatus | null,
    gameState,
    gameOver,
    opponentDisconnected,
    isLoading,
    userId,
    handleLeaveRoom,
  };
}
