import { BoardState, Color, Move, CastlingRights, PieceType } from './types';
import { indexToPos, posToIndex, isValidPos, oppositeColor } from './utils';

const DIRS_KNIGHT = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const DIRS_BISHOP = [[-1,-1],[-1,1],[1,-1],[1,1]];
const DIRS_ROOK   = [[-1,0],[1,0],[0,-1],[0,1]];
const DIRS_QUEEN  = [...DIRS_BISHOP, ...DIRS_ROOK];
const DIRS_KING   = [...DIRS_QUEEN];

export const getPseudoLegalMoves = (
  board: BoardState,
  color: Color,
  enPassantTarget: number | null,
  castlingRights: CastlingRights
): Move[] => {
  const moves: Move[] = [];

  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (!piece || piece.color !== color) continue;
    const { r, c } = indexToPos(i);

    if (piece.type === 'p') {
      const dRank    = color === 'w' ? -1 : 1;
      const startRank = color === 'w' ? 6 : 1;
      const promoRank = color === 'w' ? 0 : 7;

      // Forward 1
      if (isValidPos(r + dRank, c) && board[posToIndex(r + dRank, c)] === null) {
        const to = posToIndex(r + dRank, c);
        if (r + dRank === promoRank) {
          (['q','r','b','n'] as PieceType[]).forEach(pr =>
            moves.push({ from: i, to, piece, promotion: pr })
          );
        } else {
          moves.push({ from: i, to, piece });
        }
        // Forward 2
        if (r === startRank && board[posToIndex(r + 2 * dRank, c)] === null) {
          moves.push({ from: i, to: posToIndex(r + 2 * dRank, c), piece });
        }
      }

      // Captures
      for (const dCol of [-1, 1]) {
        if (isValidPos(r + dRank, c + dCol)) {
          const to = posToIndex(r + dRank, c + dCol);
          const target = board[to];
          if (target && target.color === oppositeColor(color)) {
            if (r + dRank === promoRank) {
              (['q','r','b','n'] as PieceType[]).forEach(pr =>
                moves.push({ from: i, to, piece, captured: target, promotion: pr })
              );
            } else {
              moves.push({ from: i, to, piece, captured: target });
            }
          } else if (to === enPassantTarget) {
            moves.push({
              from: i, to, piece,
              isEnPassant: true,
              captured: { type: 'p', color: oppositeColor(color) },
            });
          }
        }
      }
    } else if (piece.type === 'n') {
      for (const [dr, dc] of DIRS_KNIGHT) {
        const nr = r + dr, nc = c + dc;
        if (isValidPos(nr, nc)) {
          const to = posToIndex(nr, nc);
          const target = board[to];
          if (!target || target.color !== color) {
            moves.push({ from: i, to, piece, ...(target ? { captured: target } : {}) });
          }
        }
      }
    } else if (['b','r','q'].includes(piece.type)) {
      const dirs = piece.type === 'b' ? DIRS_BISHOP : piece.type === 'r' ? DIRS_ROOK : DIRS_QUEEN;
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (isValidPos(nr, nc)) {
          const to = posToIndex(nr, nc);
          const target = board[to];
          if (target) {
            if (target.color !== color) moves.push({ from: i, to, piece, captured: target });
            break;
          }
          moves.push({ from: i, to, piece });
          nr += dr; nc += dc;
        }
      }
    } else if (piece.type === 'k') {
      for (const [dr, dc] of DIRS_KING) {
        const nr = r + dr, nc = c + dc;
        if (isValidPos(nr, nc)) {
          const to = posToIndex(nr, nc);
          const target = board[to];
          if (!target || target.color !== color) {
            moves.push({ from: i, to, piece, ...(target ? { captured: target } : {}) });
          }
        }
      }
      // Castling
      const rank = color === 'w' ? 7 : 0;
      if (r === rank && c === 4) {
        const rights = castlingRights[color];
        if (rights.k && !board[posToIndex(rank,5)] && !board[posToIndex(rank,6)]) {
          moves.push({ from: i, to: posToIndex(rank,6), piece, isCastle: 'k' });
        }
        if (rights.q && !board[posToIndex(rank,1)] && !board[posToIndex(rank,2)] && !board[posToIndex(rank,3)]) {
          moves.push({ from: i, to: posToIndex(rank,2), piece, isCastle: 'q' });
        }
      }
    }
  }

  return moves;
};
