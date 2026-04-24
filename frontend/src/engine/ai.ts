import type { GameState, Move, Color } from './types';
import { PIECE_VALUES } from './constants';
import { getLegalMoves, makeMove } from './game';

const evaluateBoard = (state: GameState, color: Color): number => {
  if (state.isCheckmate) {
    return state.winner === color ? 99999 : -99999;
  }
  if (state.isStalemate || state.isDraw) {
    return 0;
  }
  
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (p) {
      const val = PIECE_VALUES[p.type] || 0;
      // Evaluate positional advantage very basically: reward moving forward / center control
      let posValue = 0;
      if (p.type === 'p') {
        const row = Math.floor(i / 8);
        posValue = p.color === 'w' ? (6 - row) * 0.1 : (row - 1) * 0.1;
      }
      const isMine = p.color === color;
      score += isMine ? val + posValue : -(val + posValue);
    }
  }
  return score;
};

const minimax = (
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  color: Color
): number => {
  if (depth === 0 || state.gameStatus !== 'active') {
    return evaluateBoard(state, color);
  }
  
  const moves = getLegalMoves(state);
  // Sort moves to improve alpha-beta pruning (e.g., captures first)
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const nextState = makeMove(state, move);
      const ev = minimax(nextState, depth - 1, alpha, beta, false, color);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const nextState = makeMove(state, move);
      const ev = minimax(nextState, depth - 1, alpha, beta, true, color);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

export const getBestMove = (state: GameState, depth: number = 3): Move | null => {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));
  
  let bestVal = -Infinity;
  let bestMove = moves[0];
  
  for (const move of moves) {
    const nextState = makeMove(state, move);
    const val = minimax(nextState, depth - 1, -Infinity, Infinity, false, state.turn);
    if (val > bestVal) {
      bestVal = val;
      bestMove = move;
    }
  }
  return bestMove;
};
