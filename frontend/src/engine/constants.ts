import type { BoardState, GameState } from './types';

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const INITIAL_BOARD = (): BoardState => {
  const FEN_PIECES = INITIAL_FEN.split(' ')[0];
  const board: BoardState = new Array(64).fill(null);
  let idx = 0;
  for (const char of FEN_PIECES) {
    if (char === '/') continue;
    if (/[1-8]/.test(char)) {
      idx += parseInt(char, 10);
    } else {
      const color = char === char.toUpperCase() ? 'w' : 'b';
      board[idx] = { type: char.toLowerCase() as any, color };
      idx++;
    }
  }
  return board;
};

export const INITIAL_GAME_STATE = (): GameState => ({
  board: INITIAL_BOARD(),
  turn: 'w',
  castlingRights: { w: { k: true, q: true }, b: { k: true, q: true } },
  enPassantTarget: null,
  halfMoveClock: 0,
  fullMoveNumber: 1,
  moveHistory: [],
  isCheck: false,
  isCheckmate: false,
  isStalemate: false,
  isDraw: false,
  gameStatus: 'active',
  winner: null,
});

export const PIECE_VALUES: Record<string, number> = {
  p: 10,
  n: 30,
  b: 30,
  r: 50,
  q: 90,
  k: 900,
};
