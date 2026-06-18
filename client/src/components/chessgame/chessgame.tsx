"use client";

import { useId } from "react";
import {
  Chessboard,
  type PieceDropHandlerArgs,
  type SquareHandlerArgs,
} from "react-chessboard";
import type { CSSProperties } from "react";

export interface ChessBoardProps {
  fen: string;
  orientation: "white" | "black";
  optionSquares?: Record<string, CSSProperties>;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  onSquareClick: (args: SquareHandlerArgs) => void;
  id?: string;
}

const ChessBoard = ({
  fen,
  orientation,
  optionSquares = {},
  onPieceDrop,
  onSquareClick,
  id,
}: ChessBoardProps) => {
  const generatedId = useId();

  return (
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
  );
};

export default ChessBoard;
