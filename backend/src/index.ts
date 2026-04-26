import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { connectDB } from './db';
import authRoutes from './routes/auth';
import gameRoutes from './routes/games';
import {
  createRoom,
  joinRoom,
  reconnectPlayer,
  applyMoveToRoom,
  handleDisconnect,
  offerDraw,
  respondDraw,
  resignGame,
  getPlayerBySocket,
} from './rooms';

// Connect to MongoDB
connectDB();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretchessjwt';

const app = express();
const allowedOrigins = [
  "http://localhost:5174",
  "https://chess-game-five-eta.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow Postman / curl

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/games', gameRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5174",
      "https://chess-game-five-eta.vercel.app"
    ],
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── Socket Events ─────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  // Optional: Authenticate connection if token is provided
  socket.on('authenticate', ({ token }) => {
    if (token) {
      jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (!err) {
          (socket as any).user = user;
          console.log(`[AUTH] Socket ${socket.id} authenticated as ${user.username}`);
        }
      });
    }
  });

  // ── Create Room ──────────────────────────────────────────────────────────
  socket.on('create_room', ({ name }: { name?: string }) => {
    try {
      const user = (socket as any).user;
      const playerName = user ? user.username : ((name || 'Guest').trim().slice(0, 20) || 'Guest');
      const userId = user ? user.id : 'guest';
      
      const { room, reconnectToken } = createRoom(socket.id, playerName, userId);
      socket.join(room.code);

      socket.emit('room_created', {
        code: room.code,
        color: 'w',
        reconnectToken,
        name: playerName,
      });
      console.log(`[CREATE] Room ${room.code} by ${playerName} (${socket.id})`);
    } catch (err) {
      socket.emit('error_msg', { message: 'Failed to create room.' });
    }
  });

  // ── Join Room ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ code, name }: { code: string; name?: string }) => {
    try {
      const user = (socket as any).user;
      const playerName = user ? user.username : ((name || 'Guest').trim().slice(0, 20) || 'Guest');
      const userId = user ? user.id : 'guest';
      console.log(`[TRY JOIN] Room ${code} by ${playerName} (${socket.id})`);
      const result = joinRoom(socket.id, code, playerName, userId);

      if ('error' in result) {
        console.warn(`[JOIN FAIL] ${result.error} (Code: ${code})`);
        socket.emit('error_msg', { message: result.error });
        return;
      }

      const { room, reconnectToken } = result;
      socket.join(room.code);
      console.log(`[JOIN SUCCESS] Room ${room.code} - Socket ${socket.id} joined.`);

      const white = room.players.find(p => p.color === 'w')!;
      const black = room.players.find(p => p.color === 'b')!;

      // Tell joiner their role
      socket.emit('room_joined', {
        code: room.code,
        color: 'b',
        reconnectToken,
        name: playerName,
      });

      // Tell both the game has started
      console.log(`[GAME START] Room ${room.code} initialized.`);
      io.to(room.code).emit('game_started', {
        gameState: room.gameState,
        players: {
          w: { name: white.name, timeLeft: white.timeLeft },
          b: { name: black.name, timeLeft: black.timeLeft },
        },
      });

    } catch (err) {
      socket.emit('error_msg', { message: 'Failed to join room.' });
    }
  });

  // ── Reconnect ─────────────────────────────────────────────────────────────
  socket.on('reconnect_room', ({ code, token }: { code: string; token: string }) => {
    try {
      const result = reconnectPlayer(socket.id, code, token);
      if ('error' in result) {
        socket.emit('error_msg', { message: result.error });
        return;
      }

      const { room, player } = result;
      socket.join(room.code);

      socket.emit('reconnected', {
        code: room.code,
        color: player.color,
        gameState: room.gameState,
        players: {
          w: { name: room.players.find(p => p.color === 'w')?.name || 'Guest', timeLeft: room.players.find(p => p.color === 'w')?.timeLeft || 600 },
          b: { name: room.players.find(p => p.color === 'b')?.name || 'Guest', timeLeft: room.players.find(p => p.color === 'b')?.timeLeft || 600 },
        },
      });

      // Notify opponent
      socket.to(room.code).emit('opponent_reconnected', {
        color: player.color,
      });

      console.log(`[RECONNECT] Room ${room.code} player ${player.name} (${socket.id})`);
    } catch (err) {
      socket.emit('error_msg', { message: 'Reconnect failed.' });
    }
  });

  // ── Make Move ─────────────────────────────────────────────────────────────
  socket.on('make_move', ({ from, to, promotion }: { from: number; to: number; promotion?: string }) => {
    try {
      const result = applyMoveToRoom(socket.id, from, to, promotion);
      if ('error' in result) {
        socket.emit('invalid_move', { message: result.error });
        return;
      }

      const { room, move } = result;

      io.to(room.code).emit('move_made', {
        gameState: room.gameState,
        move,
      });

      if (room.gameState.gameStatus !== 'active') {
        io.to(room.code).emit('game_over', {
          status: room.gameState.gameStatus,
          winner: room.gameState.winner,
          drawReason: room.gameState.drawReason,
        });
        console.log(`[GAME OVER] Room ${room.code} - ${room.gameState.gameStatus}`);
      }
    } catch (err) {
      socket.emit('invalid_move', { message: 'Move failed.' });
    }
  });

  // ── Offer Draw ────────────────────────────────────────────────────────────
  socket.on('offer_draw', () => {
    const result = offerDraw(socket.id);
    if ('error' in result) { socket.emit('error_msg', { message: result.error }); return; }
    socket.to(result.room.code).emit('draw_offered', { by: result.color });
  });

  // ── Respond to Draw ───────────────────────────────────────────────────────
  socket.on('respond_draw', ({ accept }: { accept: boolean }) => {
    const result = respondDraw(socket.id, accept);
    if ('error' in result) { socket.emit('error_msg', { message: result.error }); return; }

    if (result.accepted) {
      io.to(result.room.code).emit('game_over', {
        status: 'draw',
        winner: null,
        drawReason: 'Agreement',
      });
    } else {
      socket.to(result.room.code).emit('draw_rejected');
    }
  });

  // ── Resign ────────────────────────────────────────────────────────────────
  socket.on('resign', () => {
    const result = resignGame(socket.id);
    if ('error' in result) { socket.emit('error_msg', { message: result.error }); return; }

    io.to(result.room.code).emit('game_over', {
      status: 'resigned',
      winner: result.room.gameState.winner,
      drawReason: undefined,
    });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] ${socket.id}`);
    const result = handleDisconnect(socket.id);
    if (result) {
      // Notify the other player
      socket.to(result.room.code).emit('opponent_disconnected', {
        color: result.player.color,
      });
    }
  });

  // ── Chat / Ping ───────────────────────────────────────────────────────────
  socket.on('chat:send', ({ message, type }: { message: string; type: 'text' | 'reaction' | 'emoji' }) => {
    const found = getPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;

    const chatMsg = {
      roomId: room.code,
      senderId: player.userId,
      senderName: player.name,
      message,
      type,
      timestamp: new Date()
    };

    io.to(room.code).emit('chat:receive', chatMsg);

    // Persist if game is stored in DB
    if (room.dbGameId) {
      import('./models/Game').then(({ Game }) => {
        Game.findByIdAndUpdate(room.dbGameId, { $push: { chat: chatMsg } })
          .catch(err => console.error(`[DB] Error saving chat for room ${room.code}:`, err));
      });
    }
  });

  socket.on('ping_room', () => {
    const found = getPlayerBySocket(socket.id);
    if (found) {
      found.room.lastActivity = Date.now();
    }
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
});
