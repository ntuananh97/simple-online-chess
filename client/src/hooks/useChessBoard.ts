import type { CSSProperties } from "react";
import { useCallback, useRef, useState } from "react";
import { Chess, Square } from "chess.js";
import { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import type {
  BoardPolicy,
  ChessColor,
  IChessMove,
  PromotionPiece,
} from "@/types/chess.types";

const STARTING_FEN = new Chess().fen();

export interface PendingPromotion {
  from: string;
  to: string;
  color: ChessColor;
}

export interface UseChessBoardReturn {
  fen: string;
  optionSquares: Record<string, CSSProperties>;
  isInCheck: boolean;
  pendingPromotion: PendingPromotion | null;
  onSquareClick: (args: SquareHandlerArgs) => void;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  applyMove: (move: IChessMove) => void;
  loadFen: (fen: string) => void;
  undo: () => void;
  confirmPromotion: (piece: PromotionPiece) => void;
  cancelPromotion: () => void;
}

interface UseChessBoardProps {
  onMoveIntent: (move: IChessMove) => void;
  policy: BoardPolicy;
}

function syncCheckState(
  chess: Chess,
  setIsInCheck: (value: boolean) => void,
) {
  setIsInCheck(chess.inCheck() && !chess.isGameOver());
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
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  const clearSelection = useCallback(() => {
    setMoveFrom("");
    setOptionSquares({});
  }, []);

  const clearPendingPromotion = useCallback(() => {
    setPendingPromotion(null);
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

  const isPromotionMove = useCallback((from: string, to: string): boolean => {
    const piece = chessGameRef.current.get(from as Square);
    return (
      piece?.type === "p" &&
      ((piece.color === "w" && to.endsWith("8")) ||
        (piece.color === "b" && to.endsWith("1")))
    );
  }, []);

  const resolvePromotion = useCallback(
    (from: string, to: string): PromotionPiece | undefined => {
      if (policy.autoPromote === false) {
        return undefined;
      }

      if (!isPromotionMove(from, to)) {
        return undefined;
      }

      return policy.autoPromote ?? "q";
    },
    [isPromotionMove, policy.autoPromote],
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

      if (policy.autoPromote === false && isPromotionMove(from, to)) {
        const piece = chessGameRef.current.get(from as Square);
        if (!piece) {
          return false;
        }

        setPendingPromotion({ from, to, color: piece.color });
        clearSelection();
        return true;
      }

      const move = buildMove(from, to);
      clearSelection();
      onMoveIntent(move);
      return true;
    },
    [
      buildMove,
      clearSelection,
      isLegalMove,
      isPromotionMove,
      onMoveIntent,
      policy.autoPromote,
    ],
  );

  const confirmPromotion = useCallback(
    (piece: PromotionPiece) => {
      if (!pendingPromotion) {
        return;
      }

      const { from, to } = pendingPromotion;
      clearPendingPromotion();
      clearSelection();
      onMoveIntent({ from, to, promotion: piece });
    },
    [clearPendingPromotion, clearSelection, onMoveIntent, pendingPromotion],
  );

  const cancelPromotion = useCallback(() => {
    clearPendingPromotion();
    clearSelection();
  }, [clearPendingPromotion, clearSelection]);

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
      clearPendingPromotion();
      clearSelection();
    },
    [clearPendingPromotion, clearSelection],
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
    pendingPromotion,
    onSquareClick,
    onPieceDrop,
    applyMove,
    loadFen,
    undo,
    confirmPromotion,
    cancelPromotion,
  };
};
