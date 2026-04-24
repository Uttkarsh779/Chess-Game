export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type BoardState = (Piece | null)[];

export interface Position {
  r: number;
  c: number;
}

export interface CastlingRights {
  w: { k: boolean; q: boolean };
  b: { k: boolean; q: boolean };
}

export interface Move {
  from: number;
  to: number;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
  isCastle?: 'k' | 'q';
  isEnPassant?: boolean;
}

export interface GameState {
  board: BoardState;
  turn: Color;
  castlingRights: CastlingRights;
  enPassantTarget: number | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  moveHistory: Move[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  drawReason?: string;
  gameStatus: 'active' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';
  winner: Color | null;
}
