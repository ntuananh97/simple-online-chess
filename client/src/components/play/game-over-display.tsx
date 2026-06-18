import { Trophy, Frown, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IGameOverPayload } from "@/types/socket.types";

type GameResult = "win" | "lose" | "draw" | "abondoned";

function getGameResult(
  payload: IGameOverPayload,
  userId: string,
  whiteId: string | null,
  blackId: string | null,
): GameResult {
  if (payload.reason === "draw") {
    return "draw";
  }

  if (payload.reason === "abandoned") {
    return "abondoned";
  }

  const userWon =
    (payload.winner === "white" && whiteId === userId) ||
    (payload.winner === "black" && blackId === userId);

  return userWon ? "win" : "lose";
}

const RESULT_CONFIG: Record<
  GameResult,
  { title: string; description: string; icon: typeof Trophy; className: string }
> = {
  win: {
    title: "You win!",
    description: "Congratulations on your victory.",
    icon: Trophy,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  lose: {
    title: "You lose!",
    description: "Good luck next time.",
    icon: Frown,
    className: "text-red-600 dark:text-red-400",
  },
  draw: {
    title: "Draw",
    description: "The game ended in a draw.",
    icon: Handshake,
    className: "text-amber-600 dark:text-amber-400",
  },
  abondoned: {
    title: "Game Abondoned",
    description: "The game was abondoned.",
    icon: Handshake,
    className: "text-amber-600 dark:text-amber-400",
  },
};

interface GameOverDisplayProps {
  payload: IGameOverPayload;
  userId: string;
  whiteId: string | null;
  blackId: string | null;
  onLeave: () => void;
}

export function GameOverDisplay({
  payload,
  userId,
  whiteId,
  blackId,
  onLeave,
}: GameOverDisplayProps) {
  const result = getGameResult(payload, userId, whiteId, blackId);
  const config = RESULT_CONFIG[result];
  const Icon = config.icon;

  const description =
    payload.reason === "abandoned"
      ? "Your opponent didn't return, the game was abandoned."
      : config.description;

  const reasonLabel =
    payload.reason === "checkmate"
      ? "Checkmate"
      : payload.reason === "abandoned"
        ? "Abandoned"
        : "Draw";

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg bg-background/85 p-6 backdrop-blur-sm">
      <Icon className={`size-12 ${config.className}`} />
      <div className="text-center">
        <p className={`text-xl font-semibold ${config.className}`}>
          {config.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="mt-2 text-xs text-muted-foreground">{reasonLabel}</p>
      </div>
      <Button onClick={onLeave}>Leave Room</Button>
    </div>
  );
}
