import React, { useState } from 'react';
import { connectSocket } from '../socket/socket';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: any, token: string) => void;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const payload = isLogin ? { email, password } : { username, email, password };

    try {
      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      localStorage.setItem('chess_auth_token', data.token);
      localStorage.setItem('chess_user', JSON.stringify(data.user));

      // Re-authenticate socket
      const socket = connectSocket();
      socket.emit('authenticate', { token: data.token });

      onSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="game-over-overlay" style={{ zIndex: 1000 }}>
      <div className="game-over-card" style={{ width: '320px', padding: '2rem' }}>
        <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {!isLogin && (
            <input
              className="lobby-input code-input"
              style={{ letterSpacing: 'normal' }}
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}
          <input
            className="lobby-input code-input"
            style={{ letterSpacing: 'normal', textTransform: 'none' }}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="lobby-input code-input"
            style={{ letterSpacing: 'normal', textTransform: 'none' }}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="lobby-error" style={{ fontSize: '0.9rem' }}>{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>

        <p style={{ marginTop: '1rem', fontSize: '0.9rem', cursor: 'pointer', color: '#a0a0a0' }} onClick={() => { setIsLogin(!isLogin); setError(''); }}>
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
        </p>

        <button className="btn btn-sm" style={{ marginTop: '1rem', width: '100%' }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
