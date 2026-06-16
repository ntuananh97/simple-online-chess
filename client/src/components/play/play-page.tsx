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
  console.log("🚀 ~ PlayPage ~ gameState:", gameState)
  const [gameOver, setGameOver] = useState<IGameOverPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    isActiveGame: gameState.status === "PLAYING" && !gameOver,
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
    setGameState((prev) => ({ ...prev, status: data.status }) as RoomStatePayload);
  });

  useListenEvent("room:state", (data) => {
    setGameState(data);
    setPosition(data.fen);
    setIsLoading(false)
  });

  useListenEvent("room:move-rejected", (data) => {
    setPosition(data.fen);
  });

  useListenEvent("room:move-made", (data) => {
    moveMadeFromServer(data)
  });

  useListenEvent("room:game-over", (data) => {
    setGameOver(data);
    setGameState((prev) => ({ ...prev, status: "COMPLETED" }) as RoomStatePayload);
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
