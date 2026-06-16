import { IChessMove } from "@/types/chess.types";
import { Chess, Square } from "chess.js";
import { useState, useRef, useEffect } from "react";
import { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import { toast } from "sonner";

const STARTING_FEN = new Chess().fen();

interface IUseChessBoardProps {
    onMove: (move: IChessMove) => void;
    isActiveGame?: boolean;
}

export const useChessBoard = ({
    onMove,
    isActiveGame = true,
}: IUseChessBoardProps) => {
  
    const chessGameRef = useRef(new Chess());

    // track the current position of the chess game in state to trigger a re-render of the chessboard
    const [chessPosition, setChessPosition] = useState(STARTING_FEN);
    const [moveFrom, setMoveFrom] = useState('');
    const [optionSquares, setOptionSquares] = useState({});
    const [isInCheck, setIsInCheck] = useState(false);

    useEffect(() => {
      if (!isInCheck) return;
      toast.error('Check!');
    }, [isInCheck]);


    // get the move options for a square to show valid moves
    function getMoveOptions(square: Square) {
      // get the moves for the square
      const moves = chessGameRef.current.moves({
        square,
        verbose: true
      });

      // if no moves, clear the option squares
      if (moves.length === 0) {
        setOptionSquares({});
        return false;
      }

      // create a new object to store the option squares
      const newSquares: Record<string, React.CSSProperties> = {};

      // loop through the moves and set the option squares
      for (const move of moves) {
        newSquares[move.to] = {
          background: chessGameRef.current.get(move.to) && chessGameRef.current.get(move.to)?.color !== chessGameRef.current.get(square)?.color ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)' // larger circle for capturing
          : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
          // smaller circle for moving
          borderRadius: '50%'
        };
      }

      // set the square clicked to move from to yellow
      newSquares[square] = {
        background: 'rgba(255, 255, 0, 0.4)'
      };

      // set the option squares
      setOptionSquares(newSquares);

      // return true to indicate that there are move options
      return true;
    }
    function onSquareClick({
      square,
      piece
    }: SquareHandlerArgs) {
      if (!isActiveGame) return;
      // piece clicked to move
      if (!moveFrom && piece) {
        // get the move options for the square
        const hasMoveOptions = getMoveOptions(square as Square);

        // if move options, set the moveFrom to the square
        if (hasMoveOptions) {
          setMoveFrom(square);
        }

        // return early
        return;
      }

      // square clicked to move to, check if valid move
      const moves = chessGameRef.current.moves({
        square: moveFrom as Square,
        verbose: true
      });
      const foundMove = moves.find(m => m.from === moveFrom && m.to === square);

      // not a valid move
      if (!foundMove) {
        // check if clicked on new piece
        const hasMoveOptions = getMoveOptions(square as Square);

        // if new piece, setMoveFrom, otherwise clear moveFrom
        setMoveFrom(hasMoveOptions ? square : '');

        // return early
        return;
      }

      const userMove = {
        from: moveFrom,
        to: square,
        promotion: 'q'
      };

      // is normal move
      try {
        chessGameRef.current.move(userMove);
        
      } catch {
        // if invalid, setMoveFrom and getMoveOptions
        const hasMoveOptions = getMoveOptions(square as Square);

        // if new piece, setMoveFrom, otherwise clear moveFrom
        if (hasMoveOptions) {
          setMoveFrom(square);
        }

        // return early
        return;
      }

      // update the position state
      setChessPosition(chessGameRef.current.fen());
      checkIfInCheck();
      // clear moveFrom and optionSquares
      setMoveFrom('');
      setOptionSquares({});
      onMove?.(userMove);
    }

    // handle piece drop
    function onPieceDrop({
      sourceSquare,
      targetSquare
    }: PieceDropHandlerArgs) {
      if (!isActiveGame) return false;
      // type narrow targetSquare potentially being null (e.g. if dropped off board)
      if (!targetSquare) {
        return false;
      }

      // try to make the move according to chess.js logic
      try {
        const userMove = {
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q'
        };
        chessGameRef.current.move(userMove);
        checkIfInCheck();
        // update the position state upon successful move to trigger a re-render of the chessboard
        setChessPosition(chessGameRef.current.fen());

        // clear moveFrom and optionSquares
        setMoveFrom('');
        setOptionSquares({});
        onMove?.(userMove);

        // return true as the move was successful
        return true;
      } catch {
        // return false as the move was not successful
        return false;
      }
    }

    function setPosition(position: string) {
      // keep chess.js engine and board UI in sync with server state
      chessGameRef.current = new Chess(position);
      setChessPosition(position);
      setMoveFrom('');
      setOptionSquares({});
    }

    const moveMadeFromServer = (move: IChessMove) => {
      if (!isActiveGame) return;
      chessGameRef.current.move(move);
      setChessPosition(chessGameRef.current.fen());
      checkIfInCheck();
      setMoveFrom('');
      setOptionSquares({});
    }

    const checkIfInCheck = () => {
      setIsInCheck(chessGameRef.current.inCheck());
    }

    return {
        chessPosition,
        onSquareClick,
        onPieceDrop,
        optionSquares,
        setPosition,
        moveMadeFromServer
    }
}