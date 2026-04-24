import React, { useEffect, useState } from 'react';
import ReplayViewer from './ReplayViewer.tsx';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface HistoryListProps {
  onClose: () => void;
  user: any;
  token: string;
}

const HistoryList: React.FC<HistoryListProps> = ({ onClose, user, token }) => {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${SERVER_URL}/games/history`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setGames(data);
        } else {
          setError(data.message || 'Error fetching history');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (selectedGameId) {
    return <ReplayViewer gameId={selectedGameId} token={token} onBack={() => setSelectedGameId(null)} />;
  }

  return (
    <div className="game-over-overlay" style={{ zIndex: 1000, overflowY: 'auto' }}>
      <div className="game-over-card" style={{ width: '600px', maxWidth: '90vw', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Your Game History</h2>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>

        {loading && <p>Loading history...</p>}
        {error && <div className="lobby-error">{error}</div>}

        {!loading && games.length === 0 && <p>No completed games found.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {games.map(game => {
            // Let's rely on playerNames since we added them:
            const wName = game.playerNames?.w || 'White';
            const bName = game.playerNames?.b || 'Black';
            
            const date = new Date(game.startedAt).toLocaleString();

            return (
              <div key={game._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{wName} ♙ vs {bName} ♟</div>
                  <div style={{ fontSize: '0.9rem', color: '#aaa' }}>{date}</div>
                  <div style={{ fontSize: '0.9rem', color: '#aaa' }}>Result: {game.result.toUpperCase()} {game.winner === user.id ? '(You Won)' : ''}</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setSelectedGameId(game._id)}>Replay</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HistoryList;
