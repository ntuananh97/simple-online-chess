"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoomStatusDisplay } from "@/components/play/room-status-display";
import { ApiError } from "@/lib/api/fetch";
import { roomApi } from "@/lib/api/room.api";
import { useUserStore } from "@/stores/useUserStore";
import type { IRoomResponse } from "@/types/room.types";
import type { RoomStatePayload } from "@/types/socket.types";
import { useSocket } from "@/providers/SocketProvider";
import { useListenEvent } from "@/hooks/useListenEvent";
import ChessGame from "../chessgame/chessgame";
import { ChessboardOptions } from "react-chessboard";

interface PlayPageProps {
  roomCode: string;
}

export function PlayPage({ roomCode }: PlayPageProps) {
  const getUserId = useUserStore((state) => state.getUserId);
  const userId = getUserId();
  // const [room, setRoom] = useState<IRoomResponse | null>(null);
  const [gameState, setGameState] = useState<RoomStatePayload>({} as RoomStatePayload);
  console.log("🚀 ~ PlayPage ~ gameState:", gameState)
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { socket } = useSocket();
  const uniqueId = useId();

  const chessboardOptions: ChessboardOptions = {
    position: gameState?.fen || "",
    id: uniqueId,
    boardOrientation: gameState.whiteId === userId ? "white" : "black"
  };

  useEffect(() => {
    let cancelled = false;

    // async function loadRoom() {
    //   setIsLoading(true);
    //   setError(null);

    //   try {
    //     const playerId = getUserId();
    //     const data = await roomApi.getRoom(roomCode, playerId);

    //     if (!cancelled) {
    //       setRoom(data);
    //     }
    //   } catch (err) {
    //     if (!cancelled) {
    //       const message =
    //         err instanceof ApiError ? err.message : "Không thể tải thông tin phòng";
    //       setError(message);
    //     }
    //   } finally {
    //     if (!cancelled) {
    //       setIsLoading(false);
    //     }
    //   }
    // }

    // void loadRoom();

    socket.emit("room:join", { code: roomCode, playerId: userId });
    return () => {
      cancelled = true;
      socket.emit("room:leave");
    };
  }, [roomCode, userId, socket]);

  useListenEvent("room:player-joined", (data) => {
    setGameState((prev) => ({ ...prev, status: data.status }) as RoomStatePayload);
  });

  useListenEvent("room:state", (data) => {
    setGameState(data);
    // setRoom((prev) =>
    //   prev ? { ...prev, status: data.status } : prev,
    // );
    setIsLoading(false)
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
          {gameState.status === "PLAYING" ? <ChessGame chessboardOptions={chessboardOptions} /> : <>
          <RoomStatusDisplay code={gameState.code} status={gameState.status} />
            <p className="text-xs text-muted-foreground">
              Lượt: {gameState.turn === "w" ? "Trắng" : "Đen"}
            </p>
          
          </>}
           
          </>
        )}
      </main>
    </div>
  );
}
