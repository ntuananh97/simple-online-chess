import type { RoomStatus } from "@/types/room.types";

const STATUS_LABELS: Record<RoomStatus, string> = {
  WAITING: "Đang chờ người chơi thứ hai",
  PLAYING: "Ván cờ đang diễn ra",
  COMPLETED: "Ván cờ đã kết thúc",
  ABANDONED: "Phòng đã bị bỏ",
};

const STATUS_STYLES: Record<RoomStatus, string> = {
  WAITING: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  PLAYING: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  COMPLETED: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
  ABANDONED: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
};

interface RoomStatusDisplayProps {
  code: string;
  status: RoomStatus;
}

export function RoomStatusDisplay({ code, status }: RoomStatusDisplayProps) {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Mã phòng</p>
        <p className="mt-1 font-mono text-3xl font-semibold tracking-widest text-foreground">
          {code}
        </p>
      </div>

      <div
        className={`rounded-full px-4 py-1.5 text-sm font-medium ${STATUS_STYLES[status]}`}
      >
        {STATUS_LABELS[status]}
      </div>
    </div>
  );
}
