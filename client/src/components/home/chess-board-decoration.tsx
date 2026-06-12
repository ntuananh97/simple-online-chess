const LIGHT = "bg-amber-100/80 dark:bg-amber-900/30";
const DARK = "bg-amber-800/20 dark:bg-amber-950/50";

export function ChessBoardDecoration() {
  return (
    <div
      className="mx-auto grid size-20 grid-cols-8 overflow-hidden rounded-xl border border-amber-200/60 shadow-inner dark:border-amber-900/40"
      aria-hidden
    >
      {Array.from({ length: 64 }, (_, i) => {
        const row = Math.floor(i / 8);
        const col = i % 8;
        const isLight = (row + col) % 2 === 0;

        return (
          <div
            key={i}
            className={isLight ? LIGHT : DARK}
          />
        );
      })}
    </div>
  );
}
