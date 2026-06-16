"use client"

import { Chessboard, ChessboardOptions } from "react-chessboard"

interface IChessGameProps {
  chessboardOptions: ChessboardOptions;
}

const ChessGame = ({chessboardOptions}: IChessGameProps) => {
  return <Chessboard options={chessboardOptions} />;
};

export default ChessGame;