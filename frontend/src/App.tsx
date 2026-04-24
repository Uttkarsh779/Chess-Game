import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, Move, Color, PieceType } from './engine/types';
import { INITIAL_GAME_STATE } from './engine/constants';
import { getLegalMoves, makeMove } from './engine/game';
import { getPieceImage } from './components/PieceImages';
import Board from './components/Board';
import Lobby from './components/Lobby';
import ChatPanel from './components/ChatPanel';
import { connectSocket } from './socket/socket';
import './index.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppPhase = 'lobby' | 'waiting' | 'game' | 'ended';

interface PlayerInfo { name: string; timeLeft: number; }
interface Players { w: PlayerInfo; b: PlayerInfo; }

interface GameOver {
  status: 'checkmate' | 'stalemate' | 'draw' | 'resigned';
  winner: Color | null;
  drawReason?: string;
}

// ─── App ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [phase, setPhase]           = useState<AppPhase>('lobby');
  const [myColor, setMyColor]       = useState<Color>('w');
  const [myName, setMyName]         = useState('Guest');
  const [roomCode, setRoomCode]     = useState('');
  const [players, setPlayers]       = useState<Players>({
    w: { name: 'White', timeLeft: 600 },
    b: { name: 'Black', timeLeft: 600 },
  });
  const [gameState, setGameState]   = useState<GameState>(INITIAL_GAME_STATE());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [lastMove, setLastMove]     = useState<{ from: number; to: number } | null>(null);
  const [promotionMove, setPromotionMove] = useState<Move | null>(null);
  const [gameOver, setGameOver]     = useState<GameOver | null>(null);
  const [notification, setNotification] = useState('');
  const [opponentConnected, setOpponentConnected] = useState(true);
  const [drawOffered, setDrawOffered] = useState(false);
  const [copied, setCopied]         = useState(false);

  // Timers
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const timerRef = useRef<number | null>(null);

  const socketRef = useRef(connectSocket());

  // ─── Notifications ──────────────────────────────────────────────────────────
  const notify = useCallback((msg: string, ms = 3000) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), ms);
  }, []);

  // ─── Timer management ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'game' || gameOver) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => {
      if (gameState.turn === 'w') setWhiteTime(t => Math.max(0, t - 1));
      else                       setBlackTime(t => Math.max(0, t - 1));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState.turn, phase, gameOver]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const s = socketRef.current;

    const onGameStarted = (data: { gameState: GameState; players: Players }) => {
      setGameState(data.gameState);
      setPlayers(data.players);
      setWhiteTime(data.players.w.timeLeft);
      setBlackTime(data.players.b.timeLeft);
      setPhase('game');
      setOpponentConnected(true);
      setGameOver(null);
      setLastMove(null);
    };

    const onMoveMade = (data: { gameState: GameState; move: Move }) => {
      setGameState(data.gameState);
      setLastMove({ from: data.move.from, to: data.move.to });
      setSelectedIdx(null);
      setLegalMoves([]);
      setPromotionMove(null);
    };

    const onGameOver = (data: GameOver) => {
      setGameOver(data);
      setPhase('ended');
    };

    const onOpponentDisconnected = () => {
      setOpponentConnected(false);
      notify('Opponent disconnected. Waiting for reconnect…', 8000);
    };

    const onOpponentReconnected = () => {
      setOpponentConnected(true);
      notify('Opponent reconnected!');
    };

    const onDrawOffered = () => {
      setDrawOffered(true);
      notify('Opponent offers a draw!', 10000);
    };

    const onDrawRejected = () => {
      notify('Draw offer declined.');
    };

    const onReconnected = (data: {
      code: string;
      color: Color;
      gameState: GameState;
      players: Players;
    }) => {
      setRoomCode(data.code);
      setMyColor(data.color);
      setGameState(data.gameState);
      setPlayers(data.players);
      setWhiteTime(data.players.w.timeLeft);
      setBlackTime(data.players.b.timeLeft);
      setPhase(data.gameState.gameStatus === 'active' ? 'game' : 'ended');
    };

    const onInvalidMove = (data: { message: string }) => {
      notify(`Invalid move: ${data.message}`);
    };

    const onErrorMsg = (data: { message: string }) => {
      notify(data.message, 5000);
    };

    s.on('game_started',         onGameStarted);
    s.on('move_made',            onMoveMade);
    s.on('game_over',            onGameOver);
    s.on('opponent_disconnected',onOpponentDisconnected);
    s.on('opponent_reconnected', onOpponentReconnected);
    s.on('draw_offered',         onDrawOffered);
    s.on('draw_rejected',        onDrawRejected);
    s.on('reconnected',          onReconnected);
    s.on('invalid_move',         onInvalidMove);
    s.on('error_msg',            onErrorMsg);

    return () => {
      s.off('game_started',          onGameStarted);
      s.off('move_made',             onMoveMade);
      s.off('game_over',             onGameOver);
      s.off('opponent_disconnected', onOpponentDisconnected);
      s.off('opponent_reconnected',  onOpponentReconnected);
      s.off('draw_offered',          onDrawOffered);
      s.off('draw_rejected',         onDrawRejected);
      s.off('reconnected',           onReconnected);
      s.off('invalid_move',          onInvalidMove);
      s.off('error_msg',             onErrorMsg);
    };
  }, [notify]);

  // ─── Reconnect on reload ────────────────────────────────────────────────────
  useEffect(() => {
    const savedRoom  = localStorage.getItem('chess_room');
    const savedToken = localStorage.getItem('chess_token');
    const savedColor = localStorage.getItem('chess_color') as Color | null;

    if (savedRoom && savedToken && savedColor) {
      const s = connectSocket();
      setMyColor(savedColor);
      s.emit('reconnect_room', { code: savedRoom, token: savedToken });
    }
  }, []);

  // ─── Lobby callbacks ────────────────────────────────────────────────────────
  const handleRoomCreated = useCallback((code: string, color: Color, _token: string, name: string) => {
    setRoomCode(code);
    setMyColor(color);
    setMyName(name);
    setPhase('waiting');
  }, []);

  const handleRoomJoined = useCallback((code: string, color: Color, _token: string, name: string) => {
    setRoomCode(code);
    setMyColor(color);
    setMyName(name);
    // phase will flip to 'game' when game_started fires
  }, []);

  // ─── Board interaction ──────────────────────────────────────────────────────
  const canInteract = phase === 'game' && !gameOver && gameState.turn === myColor;

  const handleSquareClick = useCallback((idx: number) => {
    if (!canInteract || promotionMove) return;

    if (selectedIdx !== null) {
      const move = legalMoves.find(m => m.to === idx);
      if (move) {
        const isPromo = legalMoves.some(m => m.to === idx && m.promotion !== undefined);
        if (isPromo) { setPromotionMove(move); return; }

        // Optimistic update
        const nextState = makeMove(gameState, move);
        setGameState(nextState);
        setLastMove({ from: move.from, to: move.to });
        setSelectedIdx(null);
        setLegalMoves([]);

        socketRef.current.emit('make_move', {
          from: move.from, to: move.to, promotion: move.promotion,
        });
        return;
      }
    }

    const piece = gameState.board[idx];
    if (piece && piece.color === myColor) {
      setSelectedIdx(idx);
      const all = getLegalMoves(gameState);
      setLegalMoves(all.filter(m => m.from === idx));
    } else {
      setSelectedIdx(null);
      setLegalMoves([]);
    }
  }, [canInteract, promotionMove, selectedIdx, legalMoves, gameState, myColor]);

  const handlePromotionSelect = useCallback((type: PieceType) => {
    if (!promotionMove) return;
    const all = getLegalMoves(gameState);
    const finalMove = all.find(
      m => m.from === promotionMove.from && m.to === promotionMove.to && m.promotion === type
    );
    if (finalMove) {
      const nextState = makeMove(gameState, finalMove);
      setGameState(nextState);
      setLastMove({ from: finalMove.from, to: finalMove.to });
      socketRef.current.emit('make_move', {
        from: finalMove.from, to: finalMove.to, promotion: type,
      });
    }
    setPromotionMove(null);
    setSelectedIdx(null);
    setLegalMoves([]);
  }, [promotionMove, gameState]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResign = () => {
    if (!window.confirm('Resign the game?')) return;
    socketRef.current.emit('resign');
  };

  const handleOfferDraw = () => {
    socketRef.current.emit('offer_draw');
    notify('Draw offered to opponent.');
  };

  const handleRespondDraw = (accept: boolean) => {
    setDrawOffered(false);
    socketRef.current.emit('respond_draw', { accept });
  };

  const handleNewGame = () => {
    localStorage.removeItem('chess_room');
    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_color');
    setPhase('lobby');
    setGameOver(null);
    setGameState(INITIAL_GAME_STATE());
    setSelectedIdx(null);
    setLegalMoves([]);
    setLastMove(null);
    setPromotionMove(null);
    setDrawOffered(false);
    setWhiteTime(600);
    setBlackTime(600);
  };

  // ─── Captured pieces ────────────────────────────────────────────────────────
  const capturedByWhite = gameState.moveHistory.filter(m => m.captured?.color === 'b').map(m => m.captured!);
  const capturedByBlack = gameState.moveHistory.filter(m => m.captured?.color === 'w').map(m => m.captured!);
  const myCaptures   = myColor === 'w' ? capturedByWhite : capturedByBlack;
  const oppCaptures  = myColor === 'w' ? capturedByBlack : capturedByWhite;

  // ─── Opponent info ──────────────────────────────────────────────────────────
  const oppColor: Color = myColor === 'w' ? 'b' : 'w';
  const oppName = players[oppColor]?.name || 'Opponent';
  const myNameDisplay = players[myColor]?.name || myName;

  const statusText = (() => {
    if (gameState.isCheckmate) return `Checkmate! ${gameState.winner === 'w' ? 'White' : 'Black'} wins.`;
    if (gameState.isStalemate) return 'Stalemate — Draw.';
    if (gameState.isDraw) return `Draw — ${gameState.drawReason}`;
    if (gameState.isCheck)  return '⚠ Check!';
    if (gameState.gameStatus === 'resigned') return `${gameState.winner === myColor ? 'Opponent resigned.' : 'You resigned.'}`;
    return `${gameState.turn === 'w' ? 'White' : 'Black'} to move`;
  })();

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'lobby') {
    return <Lobby onRoomCreated={handleRoomCreated} onRoomJoined={handleRoomJoined} />;
  }

  if (phase === 'waiting') {
    return (
      <div className="waiting-screen">
        <div className="waiting-card">
          <div className="lobby-icon">♚</div>
          <h2>Waiting for opponent…</h2>
          <p>Share this code with a friend:</p>
          <div className="room-code-display" onClick={copyCode}>
            <span>{roomCode}</span>
            <button className="copy-btn">{copied ? '✓ Copied' : 'Copy'}</button>
          </div>
          <p className="hint">They enter this code on the home screen to join.</p>
          <div className="pulse-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-layout">
      {/* Notification toast */}
      {notification && <div className="toast">{notification}</div>}

      {/* Draw offer banner */}
      {drawOffered && (
        <div className="draw-banner">
          <span>Opponent offers a draw</span>
          <button className="btn btn-sm btn-primary" onClick={() => handleRespondDraw(true)}>Accept</button>
          <button className="btn btn-sm" onClick={() => handleRespondDraw(false)}>Decline</button>
        </div>
      )}

      {/* Game Over overlay */}
      {(phase === 'ended' || gameOver) && (
        <div className="game-over-overlay">
          <div className="game-over-card">
            {gameOver?.status === 'checkmate' && <>
              <div className="go-icon">♛</div>
              <h2>Checkmate!</h2>
              <p>{gameOver.winner === myColor ? '🏆 You Win!' : '💀 You Lose'}</p>
            </>}
            {gameOver?.status === 'stalemate' && <>
              <div className="go-icon">≡</div>
              <h2>Stalemate</h2>
              <p>It's a draw</p>
            </>}
            {gameOver?.status === 'draw' && <>
              <div className="go-icon">⚖</div>
              <h2>Draw</h2>
              <p>{gameOver.drawReason}</p>
            </>}
            {gameOver?.status === 'resigned' && <>
              <div className="go-icon">🏳</div>
              <h2>Resignation</h2>
              <p>{gameOver.winner === myColor ? '🏆 You Win!' : 'You resigned.'}</p>
            </>}
            <button className="btn btn-primary" onClick={handleNewGame}>Back to Lobby</button>
          </div>
        </div>
      )}

      {/* Left Panel */}
      <aside className="side-panel">
        <div className="brand">
          <span className="brand-icon">♞</span>
          <span className="brand-name">Grandmaster</span>
        </div>

        <div className="room-info">
          <div className="room-label">Room Code</div>
          <div className="room-code-chip" onClick={copyCode} title="Click to copy">
            {roomCode} <span className="copy-icon">{copied ? '✓' : '⧉'}</span>
          </div>
        </div>

        <div className="player-card opponent">
          <div className={`player-dot ${!opponentConnected ? 'offline' : 'online'}`} />
          <div className="player-meta">
            <span className="player-name">{oppName}</span>
            <span className="player-color">{oppColor === 'w' ? 'White ♙' : 'Black ♟'}</span>
          </div>
          <div className="player-timer">{formatTime(oppColor === 'w' ? whiteTime : blackTime)}</div>
        </div>

        <div className="captured-row">
          {oppCaptures.map((p, i) => (
            <img key={i} src={getPieceImage(p)} className="cap-piece" alt="cap" />
          ))}
        </div>

        <div className="status-area">
          <div className={`status-pill ${gameState.isCheck && !gameState.isCheckmate ? 'check' : ''} ${gameState.isCheckmate || gameOver ? 'over' : ''}`}>
            {statusText}
          </div>
          <div className="move-counter">Move {gameState.fullMoveNumber}</div>
        </div>

        <div className="captured-row">
          {myCaptures.map((p, i) => (
            <img key={i} src={getPieceImage(p)} className="cap-piece" alt="cap" />
          ))}
        </div>

        <div className="player-card me">
          <div className="player-dot online" />
          <div className="player-meta">
            <span className="player-name">{myNameDisplay} (You)</span>
            <span className="player-color">{myColor === 'w' ? 'White ♙' : 'Black ♟'}</span>
          </div>
          <div className="player-timer">{formatTime(myColor === 'w' ? whiteTime : blackTime)}</div>
        </div>

        <div className="action-btns">
          {phase === 'game' && !gameOver && (
            <>
              <button className="btn" onClick={handleOfferDraw} title="Offer Draw">½ Draw</button>
              <button className="btn btn-danger" onClick={handleResign} title="Resign">⚑ Resign</button>
            </>
          )}
          <button className="btn" onClick={handleNewGame}>⟵ Lobby</button>
        </div>
      </aside>

      {/* Board */}
      <main className="board-area">
        <Board
          gameState={gameState}
          myColor={myColor}
          selectedIdx={selectedIdx}
          legalMoves={legalMoves}
          lastMove={lastMove}
          promotionMove={promotionMove}
          onSquareClick={handleSquareClick}
          onPromotionSelect={handlePromotionSelect}
          interactionEnabled={canInteract}
        />
      </main>

      {/* Chat Panel */}
      <aside className="chat-aside">
        <ChatPanel socket={socketRef.current} roomCode={roomCode} myName={myNameDisplay} />
      </aside>
    </div>
  );
};

export default App;
