"use client";

import { cn } from "@/lib/utils";
import type { ChessColor, PromotionPiece } from "@/types/chess.types";

interface PromotionPickerProps {
  color: ChessColor;
  onSelect?: (piece: PromotionPiece) => void;
  onCancel?: () => void;
}

const PROMOTION_OPTIONS: {
  piece: PromotionPiece;
  label: string;
  whiteSymbol: string;
  blackSymbol: string;
}[] = [
  { piece: "q", label: "Queen", whiteSymbol: "♕", blackSymbol: "♛" },
  { piece: "r", label: "Rook", whiteSymbol: "♖", blackSymbol: "♜" },
  { piece: "b", label: "Bishop", whiteSymbol: "♗", blackSymbol: "♝" },
  { piece: "n", label: "Knight", whiteSymbol: "♘", blackSymbol: "♞" },
];

export function PromotionPicker({
  color,
  onSelect,
  onCancel,
}: PromotionPickerProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
      <p className="text-sm font-medium text-foreground">Choose a promotion piece</p>
      <div className="grid grid-cols-4 gap-2">
        {PROMOTION_OPTIONS.map((option) => (
          <button
            key={option.piece}
            type="button"
            onClick={() => onSelect?.(option.piece)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-card px-3 py-2 shadow-md transition-colors",
              "hover:border-amber-300 hover:bg-amber-50 dark:hover:border-amber-800 dark:hover:bg-amber-950/40",
            )}
            aria-label={option.label}
          >
            <span className="text-3xl leading-none">
              {color === "w" ? option.whiteSymbol : option.blackSymbol}
            </span>
            <span className="text-xs text-muted-foreground">{option.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}
