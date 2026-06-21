import { cn } from "@/lib/utils";

type ClockColor = "w" | "b";

interface GameClockProps {
  whiteTime: number;
  blackTime: number;
  activeColor: ClockColor;
  orientation: "white" | "black";
}

interface ClockSide {
  color: ClockColor;
  label: string;
  time: number;
}

function formatClockTime(timeMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, timeMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ClockRow({
  side,
  isActive,
}: {
  side: ClockSide;
  isActive: boolean;
}) {
  const isLowTime = side.time < 60_000;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-4 py-2 transition-colors",
        isActive
          ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          : "border-border bg-background/80 text-foreground",
      )}
    >
      <span className="text-sm font-medium">{side.label}</span>
      <span
        className={cn(
          "font-mono text-xl font-semibold tabular-nums",
          isLowTime && "text-red-600 dark:text-red-400",
        )}
      >
        {formatClockTime(side.time)}
      </span>
    </div>
  );
}

export function GameClock({
  whiteTime,
  blackTime,
  activeColor,
  orientation,
}: GameClockProps) {
  const white: ClockSide = {
    color: "w",
    label: "Trắng",
    time: whiteTime,
  };
  const black: ClockSide = {
    color: "b",
    label: "Đen",
    time: blackTime,
  };

  const topSide = orientation === "white" ? black : white;
  const bottomSide = orientation === "white" ? white : black;

  return (
    <div className="flex w-full flex-col gap-2">
      <ClockRow side={topSide} isActive={activeColor === topSide.color} />
      <ClockRow
        side={bottomSide}
        isActive={activeColor === bottomSide.color}
      />
    </div>
  );
}
