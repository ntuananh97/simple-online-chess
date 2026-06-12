import { ChessBoardDecoration } from "@/components/home/chess-board-decoration";
import { HomeActions } from "@/components/home/home-actions";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-linear-to-b from-amber-50/50 via-background to-background px-6 py-16 dark:from-amber-950/20">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-amber-100/40 via-transparent to-transparent dark:from-amber-900/10"
        aria-hidden
      />

      <main className="relative flex w-full max-w-md flex-col items-center gap-8 rounded-2xl border border-border/60 bg-card/80 p-8 shadow-xl backdrop-blur-sm">
        <ChessBoardDecoration />

        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Simple Online Chess
          </h1>
          <p className="mt-2 text-muted-foreground">
            Chơi cờ trực tuyến — không cần đăng ký.
          </p>
        </div>

        <section className="w-full space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Tạo phòng mới hoặc tham gia bằng mã phòng.
          </p>
          <HomeActions />
        </section>
      </main>
    </div>
  );
}
