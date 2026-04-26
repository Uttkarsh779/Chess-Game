import React, { useState, useRef, useEffect } from 'react';
import { connectSocket } from '../socket/socket';
import AuthModal from './AuthModal';
import HistoryList from './HistoryList';
import heroImage from '../assets/hero.png';

interface LobbyProps {
  onRoomCreated: (code: string, color: 'w' | 'b', reconnectToken: string, name: string) => void;
  onRoomJoined:  (code: string, color: 'w' | 'b', reconnectToken: string, name: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onRoomCreated, onRoomJoined }) => {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'create' | 'join' | 'rejoin' | null>(null);
  const socketRef = useRef(connectSocket());

  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPlayMenu, setShowPlayMenu] = useState(false);
  const [savedSession, setSavedSession] = useState<{ room: string; color: string } | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('chess_user');
    const savedToken = localStorage.getItem('chess_auth_token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
      socketRef.current.emit('authenticate', { token: savedToken });
    }
    // Check for saved game session
    const savedRoom  = localStorage.getItem('chess_room');
    const savedRtoken = localStorage.getItem('chess_token');
    const savedColor = localStorage.getItem('chess_color');
    if (savedRoom && savedRtoken && savedColor) {
      setSavedSession({ room: savedRoom, color: savedColor });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('chess_user');
    localStorage.removeItem('chess_auth_token');
    setUser(null);
    setToken(null);
  };

  const handleRejoin = () => {
    const savedRoom  = localStorage.getItem('chess_room');
    const savedRtoken = localStorage.getItem('chess_token');
    const savedColor = localStorage.getItem('chess_color') as 'w' | 'b' | null;
    if (!savedRoom || !savedRtoken || !savedColor) return;
    setLoading('rejoin');
    setError('');
    const s = socketRef.current;

    // const onReconnected = (data: { code: string; color: 'w' | 'b'; gameState: any; players: any }) => {
    //   s.off('reconnected', onReconnected);
    //   s.off('error_msg', onError);
    //   setLoading(null);
    //   onRoomJoined(data.code, data.color, savedRtoken, data.players[data.color]?.name || 'Guest');
    // };


    const onReconnected = (data: { code: string; color: 'w' | 'b'; gameState: any; players: any }) => {
  const { code, color, players } = data;

  s.off('reconnected', onReconnected);
  s.off('error_msg', onError);
  setLoading(null);

  onRoomJoined(
    code,
    color,
    savedRtoken,
    players[color]?.name || 'Guest'
  );
};

   const onError = (data: { message: string }) => {
  s.off('reconnected', onReconnected);
  s.off('error_msg', onError);
  setLoading(null);

  localStorage.removeItem('chess_room');
  localStorage.removeItem('chess_token');
  localStorage.removeItem('chess_color');
  setSavedSession(null);

  setError(data.message); // ✅ USE IT
};

    s.once('reconnected', onReconnected);
    s.once('error_msg', onError);
    s.emit('reconnect_room', { code: savedRoom, token: savedRtoken });
  };

  const handleClearSession = () => {
    localStorage.removeItem('chess_room');
    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_color');
    setSavedSession(null);
  };

  const handleCreate = () => {
    setError('');
    setLoading('create');
    const s = socketRef.current;

    const onCreated = (data: { code: string; color: 'w' | 'b'; reconnectToken: string; name: string }) => {
      s.off('room_created', onCreated);
      s.off('error_msg', onError);
      setLoading(null);
      localStorage.setItem('chess_room', data.code);
      localStorage.setItem('chess_token', data.reconnectToken);
      localStorage.setItem('chess_color', data.color);
      onRoomCreated(data.code, data.color, data.reconnectToken, name || 'Guest');
    };
    const onError = (data: { message: string }) => {
      s.off('room_created', onCreated);
      s.off('error_msg', onError);
      setLoading(null);
      setError(data.message);
    };

    s.once('room_created', onCreated);
    s.once('error_msg', onError);
    s.emit('create_room', { name: name || 'Guest' });
  };

  const handleJoin = () => {
    if (!joinCode.trim()) { setError('Enter a room code.'); return; }
    setError('');
    setLoading('join');
    const s = socketRef.current;

    const onJoined = (data: { code: string; color: 'w' | 'b'; reconnectToken: string; name: string }) => {
      s.off('room_joined', onJoined);
      s.off('error_msg', onError);
      setLoading(null);
      localStorage.setItem('chess_room', data.code);
      localStorage.setItem('chess_token', data.reconnectToken);
      localStorage.setItem('chess_color', data.color);
      onRoomJoined(data.code, data.color, data.reconnectToken, name || 'Guest');
    };
    const onError = (data: { message: string }) => {
      s.off('room_joined', onJoined);
      s.off('error_msg', onError);
      setLoading(null);
      setError(data.message);
    };

    s.once('room_joined', onJoined);
    s.once('error_msg', onError);
    s.emit('join_room', { code: joinCode.trim().toUpperCase(), name: name || 'Guest' });
  };

  return (
    <div className="landing-page">
      {/* Top Navigation */}
      <nav className="landing-nav">
        <div className="landing-brand">ELITE CHESS // SYSTEM</div>
        <div className="landing-nav-actions">
          {user ? (
            <>
              <span className="user-greeting">[{user.username}]</span>
              <button className="nav-link" onClick={() => setShowHistory(true)}>HISTORY</button>
              <button className="nav-link" onClick={handleLogout}>LOGOUT</button>
            </>
          ) : (
            <>
              <button className="nav-link" onClick={() => setShowAuth(true)}>LOGIN</button>
              <button className="nav-link highlight" onClick={() => setShowAuth(true)}>JOIN // ELITE</button>
            </>
          )}
        </div>
      </nav>

      {/* Rejoin Session Banner */}
      {savedSession && (
        <div className="rejoin-banner">
          <div className="rejoin-info">
            <span className="rejoin-icon">♟</span>
            <span>Active game found — Room <strong>{savedSession.room}</strong> ({savedSession.color === 'w' ? 'White' : 'Black'})</span>
          </div>
          <div className="rejoin-actions">
            <button
              className="hero-btn primary rejoin-btn"
              onClick={handleRejoin}
              disabled={loading === 'rejoin'}
            >
              {loading === 'rejoin' ? '⟳ Rejoining…' : '↩ Rejoin Game'}
            </button>
            <button className="rejoin-dismiss" onClick={handleClearSession} title="Dismiss">✕</button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">DOMINATE<br/>THE BOARD</h1>
          <p className="hero-subtitle">
            Where grandmasters are forged. Real-time multiplayer chess with ELO rankings, 
            tactical analysis, and an elite community.
          </p>
          <div className="hero-actions">
            <button className="hero-btn primary" onClick={() => {
              if (!user) setShowAuth(true);
              else setShowPlayMenu(true);
            }}>ENTER THE ARENA</button>
            <button className="hero-btn secondary" onClick={() => setShowPlayMenu(true)}>GUEST MATCH</button>
          </div>
        </div>
        <div className="hero-visual">
          <img src={heroImage} alt="Chess board" className="hero-image" />
        </div>
      </header>

      {/* Features Grid ("Arsenal") */}
      <section className="features-section">
        <h2 className="section-title">ARSENAL <span className="dimmed">// Your weapons for domination</span></h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>BLITZ COMBAT</h3>
            <p>1-10 minute games. Think fast. Move faster.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🤝</div>
            <h3>PLAY FRIENDS</h3>
            <p>Private rooms. Share code. Destroy rivals.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>AI TRAINING</h3>
            <p>Stockfish-powered. 10 difficulty levels.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>ELO RANKING</h3>
            <p>Climb the ladder. Track your rise to elite.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>MATCH ANALYSIS</h3>
            <p>Review every move. Learn from mistakes.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌐</div>
            <h3>LIVE GAMES</h3>
            <p>Zero latency. Real-time moves.</p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="landing-footer">
        <h2>READY TO DOMINATE?</h2>
        <p>Join the elite. Every grandmaster started somewhere.</p>
        <button className="hero-btn primary mt-4" onClick={() => {
          if (!user) setShowAuth(true);
          else setShowPlayMenu(true);
        }}>CLAIM YOUR RANK</button>
        <div className="footer-bottom">Forged in strategy. Built for the elite.</div>
      </footer>

      {/* Modals & Overlays */}
      {showAuth && (
        <AuthModal 
          onClose={() => setShowAuth(false)} 
          onSuccess={(u, t) => { setUser(u); setToken(t); setShowAuth(false); }} 
        />
      )}

      {showHistory && user && token && (
        <HistoryList onClose={() => setShowHistory(false)} user={user} token={token} />
      )}

      {/* Play Menu Overlay (replaces the old lobby card) */}
      {showPlayMenu && (
        <div className="game-over-overlay" style={{ zIndex: 900 }}>
          <div className="lobby-card" style={{ position: 'relative' }}>
            <button className="close-btn" onClick={() => setShowPlayMenu(false)}>×</button>
            <div className="logo-area">
              <div className="logo-icon">♞</div>
              <h2>MATCH ENGINE</h2>
              <p>Initialize combat sequence</p>
            </div>

            <div className="lobby-section">
              <label className="lobby-label">{user ? 'Playing As' : 'Your Alias (optional)'}</label>
              <input
                className="lobby-input"
                placeholder={user ? user.username : "Guest"}
                value={user ? user.username : name}
                disabled={!!user}
                maxLength={20}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <button
              className="btn btn-primary lobby-btn"
              onClick={handleCreate}
              disabled={loading !== null}
            >
              {loading === 'create' ? <><span className="spinner" /> INITIALIZING…</> : '+ CREATE MATCH'}
            </button>

            <div className="lobby-divider"><span>or join existing</span></div>

            <div className="lobby-section">
              <label className="lobby-label">Room Code</label>
              <input
                className="lobby-input code-input"
                placeholder="XXXXXX"
                value={joinCode}
                maxLength={6}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>

            <button
              className="btn lobby-btn"
              onClick={handleJoin}
              disabled={loading !== null}
            >
              {loading === 'join' ? <><span className="spinner" /> CONNECTING…</> : '→ JOIN MATCH'}
            </button>

            {error && <div className="lobby-error">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;
