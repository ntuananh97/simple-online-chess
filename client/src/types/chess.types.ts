export type ChessColor = "w" | "b";
export type PromotionPiece = "q" | "r" | "b" | "n";

export interface IChessMove {
  from: string;
  to: string;
  promotion?: PromotionPiece;
}

export interface BoardPolicy {
  interactive: boolean;
  controllableColors: ChessColor[];
  autoPromote?: PromotionPiece | false;
}
