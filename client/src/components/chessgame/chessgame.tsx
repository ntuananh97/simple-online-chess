"use client";

import { useId } from "react";
import {
  Chessboard,
  type PieceDropHandlerArgs,
  type SquareHandlerArgs,
} from "react-chessboard";
import type { CSSProperties } from "react";
import type { PendingPromotion } from "@/hooks/useChessBoard";
import type { PromotionPiece } from "@/types/chess.types";
import { PromotionPicker } from "./promotion-picker";

export interface ChessBoardProps {
  fen: string;
  orientation: "white" | "black";
  optionSquares?: Record<string, CSSProperties>;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  onSquareClick: (args: SquareHandlerArgs) => void;
  pendingPromotion?: PendingPromotion | null;
  onPromotionSelect?: (piece: PromotionPiece) => void;
  onPromotionCancel?: () => void;
  id?: string;
}

const ChessBoard = ({
  fen,
  orientation,
  optionSquares = {},
  onPieceDrop,
  onSquareClick,
  pendingPromotion,
  onPromotionSelect,
  onPromotionCancel,
  id,
}: ChessBoardProps) => {
  const generatedId = useId();
  const showPromotionPicker = pendingPromotion ;

  return (
    <div className="relative">
      <Chessboard
        options={{
          position: fen,
          id: id ?? generatedId,
          boardOrientation: orientation,
          squareStyles: optionSquares,
          onPieceDrop,
          onSquareClick,
        }}
      />
      {showPromotionPicker && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm">
          <PromotionPicker
            color={pendingPromotion.color}
            onSelect={onPromotionSelect}
            onCancel={onPromotionCancel}
          />
        </div>
      )}
    </div>
  );
};

export default ChessBoard;
