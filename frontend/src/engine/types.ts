export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: Color;
}

// Board is 8x8, represented as 1D array of 64 or 2D. A 1D array of 64 is faster for validation.
// Let's use 1D array of 64 length.
// Indices: 0 is a8, 7 is h8, 56 is a1, 63 is h1.
export type BoardState = (Piece | null)[];

export interface Position {
  r: number; // 0-7, 0 = rank 8, 7 = rank 1
  c: number; // 0-7, 0 = file a, 7 = file h
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
  enPassantTarget: number | null; // index of the square that can be moved to for en passant
  halfMoveClock: number; // for 50-move rule
  fullMoveNumber: number;
  moveHistory: Move[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean; // Other draw conditions (50 move rule, insufficient material, etc.)
  drawReason?: string;
  gameStatus: 'active' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';
  winner: Color | null;
}
