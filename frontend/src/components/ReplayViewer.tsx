import React, { useEffect, useState } from 'react';
import Board from './Board';
import { INITIAL_GAME_STATE } from '../engine/constants';
import { getLegalMoves, makeMove } from '../engine/game';
import type { GameState } from '../engine/types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface ReplayViewerProps {
  gameId: string;
  token: string;
  onBack: () => void;
}

const ReplayViewer: React.FC<ReplayViewerProps> = ({ gameId, token, onBack }) => {
  const [game, setGame] = useState<any>(null);
  const [states, setStates] = useState<GameState[]>([INITIAL_GAME_STATE()]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${SERVER_URL}/games/${gameId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data._id) throw new Error(data.message || 'Error fetching game details');
        setGame(data);

        // Reconstruct game states
        let currentState = INITIAL_GAME_STATE();
        const history: GameState[] = [currentState];

        for (const m of data.moves) {
          const from = parseInt(m.from, 10);
          const to = parseInt(m.to, 10);
          const legalMoves = getLegalMoves(currentState);
          const fullMove = legalMoves.find(lm => lm.from === from && lm.to === to);
          
          if (!fullMove) {
            console.error('Invalid move in replay history', m);
            break; // Corrupted history, stop here
          }
          currentState = makeMove(currentState, fullMove);
          history.push(currentState);
        }

        setStates(history);
        setCurrentIdx(0); // Start at beginning or end
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [gameId, token]);

  if (loading) {
    return (
      <div className="game-over-overlay" style={{ zIndex: 1000 }}>
        <div className="game-over-card">Loading Replay...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-over-overlay" style={{ zIndex: 1000 }}>
        <div className="game-over-card">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  const currentState = states[currentIdx];
  const totalMoves = states.length - 1;

  return (
    <div className="game-layout" style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#111' }}>
      <aside className="side-panel">
        <div className="brand">
          <span className="brand-icon">♞</span>
          <span className="brand-name">Replay Mode</span>
        </div>

        <div className="status-area" style={{ marginTop: '2rem' }}>
          <div className="status-pill">{game.playerNames?.w || 'White'} vs {game.playerNames?.b || 'Black'}</div>
          <div className="move-counter" style={{ marginTop: '1rem' }}>
            Result: {game.result.toUpperCase()}
          </div>
        </div>

        <div className="action-btns" style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', width: '100%', justifyContent: 'center' }}>
            <button className="btn btn-sm" onClick={() => setCurrentIdx(0)} disabled={currentIdx === 0}>|&lt;</button>
            <button className="btn btn-sm" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}>&lt;</button>
            <span style={{ display: 'inline-flex', alignItems: 'center', margin: '0 0.5rem' }}>{currentIdx} / {totalMoves}</span>
            <button className="btn btn-sm" onClick={() => setCurrentIdx(Math.min(totalMoves, currentIdx + 1))} disabled={currentIdx === totalMoves}>&gt;</button>
            <button className="btn btn-sm" onClick={() => setCurrentIdx(totalMoves)} disabled={currentIdx === totalMoves}>&gt;|</button>
          </div>
          <button className="btn" onClick={onBack} style={{ width: '100%' }}>⟵ Back to History</button>
        </div>
      </aside>

      <main className="board-area">
        <Board
          gameState={currentState}
          myColor="w" // Always view from White's perspective in replay, or user's color
          selectedIdx={null}
          legalMoves={[]}
          lastMove={null} // Optionally you can extract lastMove from states[currentIdx].moveHistory
          promotionMove={null}
          onSquareClick={() => {}}
          onPromotionSelect={() => {}}
          interactionEnabled={false}
        />
      </main>
    </div>
  );
};

export default ReplayViewer;
