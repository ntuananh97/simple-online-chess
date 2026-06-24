"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChessBoard from "@/components/chessgame/chessgame";
import { GameClock } from "@/components/chessgame/game-clock";
import { GameOverDisplay } from "@/components/play/game-over-display";
import { RoomStatusDisplay } from "@/components/play/room-status-display";
import { useCheckToast } from "@/hooks/useCheckToast";
import { useOnlineGame } from "@/hooks/useOnlineGame";

interface PlayPageProps {
  roomCode: string;
}

export function PlayPage({ roomCode }: PlayPageProps) {
  const {
    board,
    clock,
    orientation,
    gameState,
    gameOver,
    opponentDisconnected,
    isLoading,
    userId,
    handleLeaveRoom,
  } = useOnlineGame(roomCode);

  useCheckToast(board.isInCheck);

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

        {!isLoading && gameState && (
          <>
            {gameState.status === "PLAYING" || gameOver ? (
              <div className="w-full">
                {opponentDisconnected && !gameOver && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    Đối thủ đã rời — đang chờ kết nối lại (tối đa 30 giây)
                  </div>
                )}
                <GameClock
                  whiteTime={clock.whiteTime}
                  blackTime={clock.blackTime}
                  activeColor={clock.activeColor}
                  orientation={orientation}
                />
                <div className="relative mt-4">
                  <ChessBoard
                    fen={board.fen}
                    orientation={orientation}
                    optionSquares={board.optionSquares}
                    onPieceDrop={board.onPieceDrop}
                    onSquareClick={board.onSquareClick}
                    pendingPromotion={board.pendingPromotion}
                    onPromotionSelect={board.confirmPromotion}
                    onPromotionCancel={board.cancelPromotion}
                  />
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
              </div>
            ) : (
              <>
                <RoomStatusDisplay
                  code={gameState.code}
                  status={gameState.status}
                />
                <p className="text-xs text-muted-foreground">
                  Lượt: {gameState.turn === "w" ? "Trắng" : "Đen"}
                </p>
              </>
            )}
          </>
        )}

        {!isLoading && !gameState && (
          <div className="flex w-full flex-col items-center gap-4 text-center">
            <p className="text-sm text-destructive">
              Không thể tải trạng thái phòng.
            </p>
            <Button variant="outline" asChild>
              <Link href="/">Về trang chủ</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
