import React from 'react';
import type { GameState, Move, Color, PieceType } from '../engine/types';
import { posToIndex, rankToChar, fileToChar } from '../engine/utils';
import { getPieceImage } from './PieceImages';

interface BoardProps {
  gameState: GameState;
  myColor: Color;
  selectedIdx: number | null;
  legalMoves: Move[];
  lastMove: { from: number; to: number } | null;
  promotionMove: Move | null;
  onSquareClick: (idx: number) => void;
  onPromotionSelect: (type: PieceType) => void;
  interactionEnabled: boolean;
}

const Board: React.FC<BoardProps> = ({
  gameState,
  myColor,
  selectedIdx,
  legalMoves,
  lastMove,
  promotionMove,
  onSquareClick,
  onPromotionSelect,
  interactionEnabled,
}) => {
  const isFlipped = myColor === 'b';

  const squares = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const actualR = isFlipped ? 7 - r : r;
      const actualC = isFlipped ? 7 - c : c;
      const idx = posToIndex(actualR, actualC);

      const isLight = (actualR + actualC) % 2 === 0;
      const piece = gameState.board[idx];
      const isSelected = selectedIdx === idx;
      const isLastMove = lastMove?.from === idx || lastMove?.to === idx;
      const isValidMove = legalMoves.some(m => m.to === idx);
      const isValidCapture = isValidMove && piece !== null;
      const isCheck = piece?.type === 'k' && piece.color === gameState.turn && gameState.isCheck;

      squares.push(
        <div
          key={idx}
          data-idx={idx}
          className={[
            'square',
            isLight ? 'light' : 'dark',
            isSelected    ? 'selected'     : '',
            isLastMove    ? 'last-move'    : '',
            isCheck       ? 'in-check'     : '',
            isValidMove && !isValidCapture ? 'valid-move'    : '',
            isValidCapture                 ? 'valid-capture' : '',
            interactionEnabled && (isSelected || isValidMove) ? 'clickable' : '',
          ].join(' ')}
          onClick={() => interactionEnabled && onSquareClick(idx)}
        >
          {c === 0 && <span className="rank-label">{rankToChar(actualR)}</span>}
          {r === 7 && <span className="file-label">{fileToChar(actualC)}</span>}

          {piece && (
            <div
              className="piece"
              style={{ backgroundImage: `url(${getPieceImage(piece)})` }}
            />
          )}
        </div>
      );
    }
  }

  return (
    <div className="board-wrapper">
      <div className="board-container">
        {squares}

        {promotionMove && (
          <div className="overlay-backdrop">
            <div className="promotion-picker">
              <p>Choose piece</p>
              <div className="promo-options">
                {(['q','r','b','n'] as PieceType[]).map(type => (
                  <div
                    key={type}
                    className="promo-option"
                    onClick={() => onPromotionSelect(type)}
                  >
                    <div
                      className="piece"
                      style={{
                        backgroundImage: `url(${getPieceImage({ type, color: promotionMove.piece.color })})`,
                        width: '100%', height: '100%',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Board;
