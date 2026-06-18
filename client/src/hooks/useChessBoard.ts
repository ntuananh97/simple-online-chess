import type { CSSProperties } from "react";
import { useCallback, useRef, useState } from "react";
import { Chess, Square } from "chess.js";
import { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import type { BoardPolicy, IChessMove, PromotionPiece } from "@/types/chess.types";

const STARTING_FEN = new Chess().fen();

export interface UseChessBoardReturn {
  fen: string;
  optionSquares: Record<string, CSSProperties>;
  isInCheck: boolean;
  onSquareClick: (args: SquareHandlerArgs) => void;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  applyMove: (move: IChessMove) => void;
  loadFen: (fen: string) => void;
  undo: () => void;
}

interface UseChessBoardProps {
  onMoveIntent: (move: IChessMove) => void;
  policy: BoardPolicy;
}

function syncCheckState(
  chess: Chess,
  setIsInCheck: (value: boolean) => void,
) {
  setIsInCheck(chess.inCheck());
}

export const useChessBoard = ({
  onMoveIntent,
  policy,
}: UseChessBoardProps): UseChessBoardReturn => {
  const chessGameRef = useRef(new Chess());
  const [fen, setFen] = useState(STARTING_FEN);
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState<
    Record<string, CSSProperties>
  >({});
  const [isInCheck, setIsInCheck] = useState(false);

  const clearSelection = useCallback(() => {
    setMoveFrom("");
    setOptionSquares({});
  }, []);

  const syncBoardState = useCallback(() => {
    setFen(chessGameRef.current.fen());
    syncCheckState(chessGameRef.current, setIsInCheck);
  }, []);

  const canControlSquare = useCallback(
    (square: Square) => {
      if (!policy.interactive) {
        return false;
      }

      const piece = chessGameRef.current.get(square);
      if (!piece) {
        return false;
      }

      const turn = chessGameRef.current.turn();
      return (
        policy.controllableColors.includes(turn) &&
        piece.color === turn
      );
    },
    [policy.interactive, policy.controllableColors],
  );

  const resolvePromotion = useCallback(
    (from: string, to: string): PromotionPiece | undefined => {
      if (policy.autoPromote === false) {
        return undefined;
      }

      const piece = chessGameRef.current.get(from as Square);
      const isPromotion =
        piece?.type === "p" &&
        ((piece.color === "w" && to.endsWith("8")) ||
          (piece.color === "b" && to.endsWith("1")));

      if (!isPromotion) {
        return undefined;
      }

      return policy.autoPromote ?? "q";
    },
    [policy.autoPromote],
  );

  const buildMove = useCallback(
    (from: string, to: string): IChessMove => {
      const promotion = resolvePromotion(from, to);
      return promotion ? { from, to, promotion } : { from, to };
    },
    [resolvePromotion],
  );

  const isLegalMove = useCallback((from: string, to: string) => {
    const moves = chessGameRef.current.moves({
      square: from as Square,
      verbose: true,
    });

    return moves.some((move) => move.from === from && move.to === to);
  }, []);

  const emitMoveIntent = useCallback(
    (from: string, to: string) => {
      if (!isLegalMove(from, to)) {
        return false;
      }

      const move = buildMove(from, to);
      clearSelection();
      onMoveIntent(move);
      return true;
    },
    [buildMove, clearSelection, isLegalMove, onMoveIntent],
  );

  const getMoveOptions = useCallback(
    (square: Square) => {
      const moves = chessGameRef.current.moves({
        square,
        verbose: true,
      });

      if (moves.length === 0) {
        setOptionSquares({});
        return false;
      }

      const newSquares: Record<string, CSSProperties> = {};

      for (const move of moves) {
        const targetPiece = chessGameRef.current.get(move.to as Square);
        const sourcePiece = chessGameRef.current.get(square);
        const isCapture =
          targetPiece && sourcePiece && targetPiece.color !== sourcePiece.color;

        newSquares[move.to] = {
          background: isCapture
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
          borderRadius: "50%",
        };
      }

      newSquares[square] = {
        background: "rgba(255, 255, 0, 0.4)",
      };

      setOptionSquares(newSquares);
      return true;
    },
    [],
  );

  const applyMove = useCallback(
    (move: IChessMove) => {
      chessGameRef.current.move(move);
      syncBoardState();
      clearSelection();
    },
    [clearSelection, syncBoardState],
  );

  const loadFen = useCallback(
    (position: string) => {
      chessGameRef.current = new Chess(position);
      setFen(position);
      syncCheckState(chessGameRef.current, setIsInCheck);
      clearSelection();
    },
    [clearSelection],
  );

  const undo = useCallback(() => {
    chessGameRef.current.undo();
    syncBoardState();
    clearSelection();
  }, [clearSelection, syncBoardState]);

  const onSquareClick = useCallback(
    ({ square, piece }: SquareHandlerArgs) => {
      if (!policy.interactive) {
        return;
      }

      if (!moveFrom && piece) {
        if (!canControlSquare(square as Square)) {
          return;
        }

        const hasMoveOptions = getMoveOptions(square as Square);
        if (hasMoveOptions) {
          setMoveFrom(square);
        }
        return;
      }

      if (!moveFrom) {
        return;
      }

      if (emitMoveIntent(moveFrom, square)) {
        return;
      }

      if (piece && canControlSquare(square as Square)) {
        const hasMoveOptions = getMoveOptions(square as Square);
        setMoveFrom(hasMoveOptions ? square : "");
        return;
      }

      clearSelection();
    },
    [
      canControlSquare,
      clearSelection,
      emitMoveIntent,
      getMoveOptions,
      moveFrom,
      policy.interactive,
    ],
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!policy.interactive || !targetSquare) {
        return false;
      }

      if (!canControlSquare(sourceSquare as Square)) {
        return false;
      }

      return emitMoveIntent(sourceSquare, targetSquare);
    },
    [canControlSquare, emitMoveIntent, policy.interactive],
  );

  return {
    fen,
    optionSquares,
    isInCheck,
    onSquareClick,
    onPieceDrop,
    applyMove,
    loadFen,
    undo,
  };
};
