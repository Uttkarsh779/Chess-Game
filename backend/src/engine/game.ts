import { BoardState, GameState, Move, Color, PieceType } from './types';
import { getPseudoLegalMoves } from './moves';
import { oppositeColor, posToIndex, indexToPos } from './utils';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const buildInitialBoard = (): BoardState => {
  const fen = INITIAL_FEN.split(' ')[0];
  const board: BoardState = new Array(64).fill(null);
  let idx = 0;
  for (const ch of fen) {
    if (ch === '/') continue;
    if (/[1-8]/.test(ch)) { idx += parseInt(ch, 10); }
    else {
      board[idx++] = {
        type: ch.toLowerCase() as PieceType,
        color: ch === ch.toUpperCase() ? 'w' : 'b',
      };
    }
  }
  return board;
};

export const INITIAL_GAME_STATE = (): GameState => ({
  board: buildInitialBoard(),
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

export const isKingInCheck = (board: BoardState, color: Color): boolean => {
  const kingIdx = board.findIndex(p => p?.type === 'k' && p.color === color);
  if (kingIdx === -1) return false;
  const opp = oppositeColor(color);
  const oppMoves = getPseudoLegalMoves(board, opp, null, {
    w: { k: false, q: false }, b: { k: false, q: false },
  });
  return oppMoves.some(m => m.to === kingIdx);
};

export const applyMove = (board: BoardState, move: Move): BoardState => {
  const nb = [...board];
  nb[move.from] = null;
  nb[move.to] = move.promotion
    ? { type: move.promotion, color: move.piece.color }
    : move.piece;
  if (move.isEnPassant) {
    const capturedIdx = posToIndex(indexToPos(move.from).r, indexToPos(move.to).c);
    nb[capturedIdx] = null;
  } else if (move.isCastle) {
    const rank = move.piece.color === 'w' ? 7 : 0;
    if (move.isCastle === 'k') {
      nb[posToIndex(rank,5)] = nb[posToIndex(rank,7)];
      nb[posToIndex(rank,7)] = null;
    } else {
      nb[posToIndex(rank,3)] = nb[posToIndex(rank,0)];
      nb[posToIndex(rank,0)] = null;
    }
  }
  return nb;
};

export const getLegalMoves = (state: GameState): Move[] => {
  const pseudo = getPseudoLegalMoves(
    state.board, state.turn, state.enPassantTarget, state.castlingRights
  );
  const legal: Move[] = [];

  for (const move of pseudo) {
    if (move.isCastle) {
      if (isKingInCheck(state.board, state.turn)) continue;
      const rank = state.turn === 'w' ? 7 : 0;
      const passCol = move.isCastle === 'k' ? 5 : 3;
      const ib = [...state.board];
      ib[move.from] = null;
      ib[posToIndex(rank, passCol)] = state.board[move.from];
      if (isKingInCheck(ib, state.turn)) continue;
    }
    const nb = applyMove(state.board, move);
    if (!isKingInCheck(nb, state.turn)) legal.push(move);
  }
  return legal;
};

export const makeMove = (state: GameState, move: Move): GameState => {
  const newBoard = applyMove(state.board, move);
  const opp = oppositeColor(state.turn);

  const inCheck = isKingInCheck(newBoard, opp);
  const nextMoves = getLegalMoves({ ...state, board: newBoard, turn: opp });
  const noMoves = nextMoves.length === 0;

  let gameStatus = state.gameStatus;
  let winner = state.winner;
  let isCheckmate = false, isStalemate = false;

  if (noMoves) {
    if (inCheck) { isCheckmate = true; gameStatus = 'checkmate'; winner = state.turn; }
    else         { isStalemate = true; gameStatus = 'stalemate'; }
  }

  // En passant target
  let newEP: number | null = null;
  if (move.piece.type === 'p' && Math.abs(indexToPos(move.from).r - indexToPos(move.to).r) === 2) {
    const dir = move.piece.color === 'w' ? -1 : 1;
    newEP = posToIndex(indexToPos(move.from).r + dir, indexToPos(move.from).c);
  }

  // Castling rights
  const newCR = { w: { ...state.castlingRights.w }, b: { ...state.castlingRights.b } };
  if (move.piece.type === 'k') { newCR[state.turn].k = false; newCR[state.turn].q = false; }
  if (move.piece.type === 'r') {
    if (move.from === posToIndex(state.turn === 'w' ? 7 : 0, 7)) newCR[state.turn].k = false;
    if (move.from === posToIndex(state.turn === 'w' ? 7 : 0, 0)) newCR[state.turn].q = false;
  }
  if (move.captured?.type === 'r') {
    if (move.to === posToIndex(opp === 'w' ? 7 : 0, 7)) newCR[opp].k = false;
    if (move.to === posToIndex(opp === 'w' ? 7 : 0, 0)) newCR[opp].q = false;
  }

  const halves = (move.piece.type === 'p' || !!move.captured) ? 0 : state.halfMoveClock + 1;
  const fullNum = state.turn === 'b' ? state.fullMoveNumber + 1 : state.fullMoveNumber;

  let isDraw = false;
  let drawReason: string | undefined;
  if (halves >= 100) { isDraw = true; gameStatus = 'draw'; drawReason = '50-move rule'; }
  if (!isDraw) {
    const pieces = newBoard.filter(Boolean);
    if (pieces.length === 2) { isDraw = true; gameStatus = 'draw'; drawReason = 'Insufficient material'; }
    else if (pieces.length === 3) {
      const nk = pieces.find(p => p?.type !== 'k');
      if (nk && (nk.type === 'n' || nk.type === 'b')) {
        isDraw = true; gameStatus = 'draw'; drawReason = 'Insufficient material';
      }
    }
  }

  return {
    board: newBoard,
    turn: opp,
    castlingRights: newCR,
    enPassantTarget: newEP,
    halfMoveClock: halves,
    fullMoveNumber: fullNum,
    moveHistory: [...state.moveHistory, move],
    isCheck: inCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    drawReason,
    gameStatus,
    winner,
  };
};
