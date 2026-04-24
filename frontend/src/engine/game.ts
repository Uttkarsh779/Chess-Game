import type { GameState, Move, Color, BoardState } from './types';
import { getPseudoLegalMoves } from './moves';
import { oppositeColor, posToIndex, indexToPos } from './utils';

export const isKingInCheck = (board: BoardState, color: Color): boolean => {
  const kingIdx = board.findIndex(p => p?.type === 'k' && p.color === color);
  if (kingIdx === -1) return false; // Should not happen in valid state
  
  const oppColor = oppositeColor(color);
  // Using pseudo moves for opponent, if any can capture king, in check.
  // We can pass empty castling and no en passant as they don't affect check
  const oppMoves = getPseudoLegalMoves(board, oppColor, null, { w: {k:false, q:false}, b: {k:false, q:false} });
  return oppMoves.some(m => m.to === kingIdx);
};

export const applyMove = (board: BoardState, move: Move): BoardState => {
  const newBoard = [...board];
  newBoard[move.from] = null;
  newBoard[move.to] = move.promotion ? { type: move.promotion, color: move.piece.color } : move.piece;
  
  if (move.isEnPassant) {
    const fromR = indexToPos(move.from).r;
    // captured pawn is at the rank we moved from, and col we moved to
    const capturedIdx = posToIndex(fromR, indexToPos(move.to).c);
    newBoard[capturedIdx] = null;
  } else if (move.isCastle) {
    const rank = move.piece.color === 'w' ? 7 : 0;
    if (move.isCastle === 'k') {
      newBoard[posToIndex(rank, 5)] = newBoard[posToIndex(rank, 7)];
      newBoard[posToIndex(rank, 7)] = null;
    } else {
      newBoard[posToIndex(rank, 3)] = newBoard[posToIndex(rank, 0)];
      newBoard[posToIndex(rank, 0)] = null;
    }
  }
  
  return newBoard;
};

// Filter moves that leave king in check
export const getLegalMoves = (state: GameState): Move[] => {
  const pseudoMoves = getPseudoLegalMoves(state.board, state.turn, state.enPassantTarget, state.castlingRights);
  const legalMoves: Move[] = [];
  
  for (const move of pseudoMoves) {
    // For castling, must ensure we are not currently in check, and the passed square is not in check
    if (move.isCastle) {
      if (isKingInCheck(state.board, state.turn)) continue;
      const rank = state.turn === 'w' ? 7 : 0;
      const passIdx = move.isCastle === 'k' ? posToIndex(rank, 5) : posToIndex(rank, 3);
      
      const intermediateBoard = [...state.board];
      intermediateBoard[move.from] = null;
      intermediateBoard[passIdx] = state.board[move.from];
      if (isKingInCheck(intermediateBoard, state.turn)) continue;
    }
    
    const newBoard = applyMove(state.board, move);
    if (!isKingInCheck(newBoard, state.turn)) {
      legalMoves.push(move);
    }
  }
  return legalMoves;
};

export const makeMove = (state: GameState, move: Move): GameState => {
  const newBoard = applyMove(state.board, move);
  const oppColor = oppositeColor(state.turn);
  const legalMovesNext = getLegalMoves({ ...state, board: newBoard, turn: oppColor });
  
  const inCheck = isKingInCheck(newBoard, oppColor);
  const noMoves = legalMovesNext.length === 0;
  
  let gameStatus = state.gameStatus;
  let winner = state.winner;
  let isCheckmate = false;
  let isStalemate = false;
  
  if (noMoves) {
    if (inCheck) {
      isCheckmate = true;
      gameStatus = 'checkmate';
      winner = state.turn;
    } else {
      isStalemate = true;
      gameStatus = 'stalemate';
    }
  }
  
  // Calculate new en passant target
  let newEnPassantTarget = null;
  if (move.piece.type === 'p' && Math.abs(indexToPos(move.from).r - indexToPos(move.to).r) === 2) {
    const dir = move.piece.color === 'w' ? -1 : 1;
    newEnPassantTarget = posToIndex(indexToPos(move.from).r + dir, indexToPos(move.from).c);
  }
  
  // Update castling rights
  const newCR = { w: { ...state.castlingRights.w }, b: { ...state.castlingRights.b } };
  if (move.piece.type === 'k') {
    newCR[state.turn].k = false;
    newCR[state.turn].q = false;
  } else if (move.piece.type === 'r') {
    if (move.from === posToIndex(state.turn === 'w' ? 7 : 0, 7)) newCR[state.turn].k = false;
    if (move.from === posToIndex(state.turn === 'w' ? 7 : 0, 0)) newCR[state.turn].q = false;
  }
  // Opponent captures rook
  if (move.captured?.type === 'r') {
    if (move.to === posToIndex(oppColor === 'w' ? 7 : 0, 7)) newCR[oppColor].k = false;
    if (move.to === posToIndex(oppColor === 'w' ? 7 : 0, 0)) newCR[oppColor].q = false;
  }
  
  const isPawnMoveOrCapture = move.piece.type === 'p' || !!move.captured;
  const newHalfMoveClock = isPawnMoveOrCapture ? 0 : state.halfMoveClock + 1;
  const newFullMoveNumber = state.turn === 'b' ? state.fullMoveNumber + 1 : state.fullMoveNumber;
  
  let isDraw = state.isDraw;
  let drawReason = state.drawReason;
  // 50 move rule (100 half moves)
  if (newHalfMoveClock >= 100) {
    isDraw = true;
    gameStatus = 'draw';
    drawReason = '50-move rule';
  }
  
  if (!isDraw) {
    const pieces = newBoard.filter(p => p !== null);
    if (pieces.length === 2) {
      isDraw = true;
      gameStatus = 'draw';
      drawReason = 'Insufficient material';
    } else if (pieces.length === 3) {
      const nonKing = pieces.find(p => p?.type !== 'k');
      if (nonKing && (nonKing.type === 'n' || nonKing.type === 'b')) {
        isDraw = true;
        gameStatus = 'draw';
        drawReason = 'Insufficient material';
      }
    }
  }
  
  return {
    board: newBoard,
    turn: oppColor,
    castlingRights: newCR,
    enPassantTarget: newEnPassantTarget,
    halfMoveClock: newHalfMoveClock,
    fullMoveNumber: newFullMoveNumber,
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
