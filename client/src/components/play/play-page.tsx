"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameOverDisplay } from "@/components/play/game-over-display";
import { RoomStatusDisplay } from "@/components/play/room-status-display";
import { useUserStore } from "@/stores/useUserStore";
import type { IGameOverPayload, RoomStatePayload } from "@/types/socket.types";
import { useSocket } from "@/providers/SocketProvider";
import { useListenEvent } from "@/hooks/useListenEvent";
import ChessGame from "../chessgame/chessgame";
import { ChessboardOptions } from "react-chessboard";
import { useChessBoard } from "@/hooks/useChessBoard";

interface PlayPageProps {
  roomCode: string;
}

export function PlayPage({ roomCode }: PlayPageProps) {
  const router = useRouter();
  const getUserId = useUserStore((state) => state.getUserId);
  const userId = getUserId();
  const [gameState, setGameState] = useState<RoomStatePayload>({} as RoomStatePayload);
  const [gameOver, setGameOver] = useState<IGameOverPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const { socket } = useSocket();
  const uniqueId = useId();

  const {
    chessPosition,
    onSquareClick,
    onPieceDrop,
    optionSquares,
    setPosition,
    moveMadeFromServer,
  } = useChessBoard({
    onMove: (move) => {
      socket.emit("room:move", { move, roomId: gameState.id });
    },
    isActiveGame:
      gameState.status === "PLAYING",
  });

  const chessboardOptions: ChessboardOptions = {
    position: chessPosition,
    id: uniqueId,
    boardOrientation: gameState.whiteId === userId ? "white" : "black",
    squareStyles: optionSquares,
    onPieceDrop,
    onSquareClick,
  };

  const handleLeaveRoom = useCallback(() => {
    socket.emit("room:leave");
    router.push("/");
  }, [socket, router]);

  useEffect(() => {
    socket.emit("room:join", { code: roomCode, playerId: userId });
    return () => {
      socket.emit("room:leave");
    };
  }, [roomCode, userId, socket]);

  useListenEvent("room:player-joined", (data) => {
    if (data.playerId !== userId) {
      setOpponentDisconnected(false);
    }
    setGameState((prev) => ({ ...prev, status: data.status }) as RoomStatePayload);
  });

  useListenEvent("room:player-left", (data) => {
    if (data.playerId !== userId) {
      setOpponentDisconnected(true);
    }
  });

  useListenEvent("room:state", (data) => {
    setGameState(data);
    setPosition(data.fen);
    setIsLoading(false);
  });

  useListenEvent("room:move-rejected", (data) => {
    setPosition(data.fen);
  });

  useListenEvent("room:move-made", (data) => {
    moveMadeFromServer(data);
  });

  useListenEvent("room:game-over", (data) => {
    setGameOver(data);
    setGameState((prev) => ({ ...prev, status: "COMPLETED" }) as RoomStatePayload);
  });

  useListenEvent("room:abandoned", (data) => {
    setOpponentDisconnected(false);
    setGameState((prev) => {
      setGameOver({ winner: null, reason: "abandoned" });
      return { ...prev, status: "ABANDONED", fen: data.fen };
    });
  });

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-linear-to-b from-amber-50/50 via-background to-background px-6 py-16 dark:from-amber-950/20">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-amber-100/40 via-transparent to-transparent dark:from-amber-900/10"
        aria-hidden
      />

      <main className="relative flex w-full max-w-md flex-col items-center gap-8 rounded-2xl border border-border/60 bg-card/80 p-8 shadow-xl backdrop-blur-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Phòng chơi
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Trạng thái phòng hiện tại
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span>Đang tải...</span>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex w-full flex-col items-center gap-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" asChild>
              <Link href="/">Về trang chủ</Link>
            </Button>
          </div>
        )}

        {!isLoading && gameState && (
          <>
            {gameState.status === "PLAYING" || gameOver ? (
              <div className="relative w-full">
                {opponentDisconnected && !gameOver && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    Đối thủ đã rời — đang chờ kết nối lại (tối đa 30 giây)
                  </div>
                )}
                <ChessGame chessboardOptions={chessboardOptions} />
                {gameOver && (
                  <GameOverDisplay
                    payload={gameOver}
                    userId={userId}
                    whiteId={gameState.whiteId}
                    blackId={gameState.blackId}
                    onLeave={handleLeaveRoom}
                  />
                )}
              </div>
            ) : (
              <>
                <RoomStatusDisplay code={gameState.code} status={gameState.status} />
                <p className="text-xs text-muted-foreground">
                  Lượt: {gameState.turn === "w" ? "Trắng" : "Đen"}
                </p>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
