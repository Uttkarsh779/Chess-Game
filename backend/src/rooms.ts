import { GameState, Move, Color } from './engine/types';
import { INITIAL_GAME_STATE, getLegalMoves, makeMove } from './engine/game';
import { Game } from './models/Game';

export interface Player {
  socketId: string;
  color: Color;
  reconnectToken: string;
  connected: boolean;
  timeLeft: number; // seconds
  name: string;
  userId: string | 'guest';
}

export interface Room {
  code: string;
  players: Player[];
  gameState: GameState;
  status: 'waiting' | 'active' | 'finished';
  drawOffer: Color | null; // which color offered a draw
  createdAt: number;
  lastActivity: number;
  dbGameId?: string; // ID of the Game document in MongoDB if persisted
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();

// ─── Code Generation ──────────────────────────────────────────────────────────

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const generateCode = (): string => {
  let code = '';
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
};

const uniqueCode = (): string => {
  let code = generateCode();
  while (rooms.has(code)) code = generateCode();
  return code;
};

const generateToken = (): string =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

// ─── Room API ─────────────────────────────────────────────────────────────────

export const createRoom = (
  socketId: string,
  name: string,
  userId: string | 'guest' = 'guest'
): { room: Room; reconnectToken: string } => {
  const code = uniqueCode();
  const reconnectToken = generateToken();

  const room: Room = {
    code,
    players: [
      { socketId, color: 'w', reconnectToken, connected: true, timeLeft: 600, name, userId },
    ],
    gameState: INITIAL_GAME_STATE(),
    status: 'waiting',
    drawOffer: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  rooms.set(code, room);
  socketToRoom.set(socketId, code);
  return { room, reconnectToken };
};

export const joinRoom = (
  socketId: string,
  code: string,
  name: string,
  userId: string | 'guest' = 'guest'
): { room: Room; reconnectToken: string; error?: undefined } | { error: string } => {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found. Check the code and try again.' };
  if (room.status === 'active' || room.status === 'finished')
    return { error: 'This room has already started or finished.' };
  if (room.players.length >= 2) return { error: 'Room is full.' };

  const reconnectToken = generateToken();
  room.players.push({
    socketId,
    color: 'b',
    reconnectToken,
    connected: true,
    timeLeft: 600,
    name,
    userId,
  });
  room.status = 'active';
  room.lastActivity = Date.now();
  socketToRoom.set(socketId, code.toUpperCase());

  // If at least one player is authenticated, persist the game in MongoDB
  const p1 = room.players[0];
  const p2 = room.players[1];
  if (p1.userId !== 'guest' || p2.userId !== 'guest') {
    Game.create({
      roomId: room.code,
      players: {
        player1: p1.userId !== 'guest' ? p1.userId : 'guest',
        player2: p2.userId !== 'guest' ? p2.userId : 'guest',
      },
      playerNames: {
        w: p1.name,
        b: p2.name
      },
      moves: [],
      result: 'ongoing'
    }).then(game => {
      room.dbGameId = game._id.toString();
      console.log(`[DB] Game created for room ${room.code} with ID ${game._id}`);
    }).catch(err => {
      console.error(`[DB] Failed to create game document for room ${room.code}:`, err);
    });
  }

  return { room, reconnectToken };
};

export const reconnectPlayer = (
  socketId: string,
  code: string,
  token: string
): { room: Room; player: Player; error?: undefined } | { error: string } => {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found.' };

  const player = room.players.find(p => p.reconnectToken === token);
  if (!player) return { error: 'Invalid reconnect token.' };

  socketToRoom.delete(player.socketId);
  player.socketId = socketId;
  player.connected = true;
  socketToRoom.set(socketId, code.toUpperCase());
  return { room, player };
};

export const applyMoveToRoom = (
  socketId: string,
  from: number,
  to: number,
  promotion?: string
): { room: Room; move: Move; error?: undefined } | { error: string } => {
  const code = socketToRoom.get(socketId);
  if (!code) return { error: 'Not in a room.' };
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found.' };
  if (room.status !== 'active') return { error: 'Game is not active.' };

  const player = room.players.find(p => p.socketId === socketId);
  if (!player) return { error: 'Player not found.' };
  if (player.color !== room.gameState.turn) return { error: 'Not your turn.' };

  const legal = getLegalMoves(room.gameState);
  const move = legal.find(
    m => m.from === from && m.to === to && (promotion === undefined || m.promotion === promotion)
  );
  if (!move) return { error: 'Illegal move.' };

  room.gameState = makeMove(room.gameState, move);
  room.lastActivity = Date.now();
  room.drawOffer = null; // reset draw offer on move

  if (room.gameState.gameStatus !== 'active') room.status = 'finished';

  // Persist the move asynchronously if DB tracking is active
  if (room.dbGameId) {
    const dbMove = {
      from: move.from.toString(),
      to: move.to.toString(),
      piece: move.piece.type,
      player: player.userId,
      timestamp: new Date()
    };
    
    // Convert piece names for readability if wanted, but `type` is better.
    let updateDoc: any = { $push: { moves: dbMove } };
    
    if (room.status === 'finished') {
      updateDoc.$set = {
        result: room.gameState.gameStatus === 'draw' || room.gameState.gameStatus === 'stalemate' ? 'draw' : 'win',
        winner: room.gameState.winner ? room.players.find(p => p.color === room.gameState.winner)?.userId : null,
        endedAt: new Date()
      };
      if (updateDoc.$set.winner === undefined) updateDoc.$set.winner = null;
    }

    Game.findByIdAndUpdate(room.dbGameId, updateDoc)
      .catch(err => console.error(`[DB] Error saving move for room ${room.code}:`, err));
  }

  return { room, move };
};

export const getPlayerBySocket = (socketId: string): { room: Room; player: Player } | null => {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;
  const player = room.players.find(p => p.socketId === socketId);
  if (!player) return null;
  return { room, player };
};

export const handleDisconnect = (socketId: string): { room: Room; player: Player } | null => {
  const found = getPlayerBySocket(socketId);
  if (!found) return null;
  found.player.connected = false;
  socketToRoom.delete(socketId);
  return found;
};

export const offerDraw = (
  socketId: string
): { room: Room; color: Color } | { error: string } => {
  const found = getPlayerBySocket(socketId);
  if (!found) return { error: 'Not in a room.' };
  const { room, player } = found;
  if (room.status !== 'active') return { error: 'Game not active.' };
  room.drawOffer = player.color;
  return { room, color: player.color };
};

export const respondDraw = (
  socketId: string,
  accept: boolean
): { room: Room; accepted: boolean } | { error: string } => {
  const found = getPlayerBySocket(socketId);
  if (!found) return { error: 'Not in a room.' };
  const { room, player } = found;
  if (!room.drawOffer || room.drawOffer === player.color) return { error: 'No draw to respond to.' };
  if (accept) {
    room.gameState = { ...room.gameState, isDraw: true, gameStatus: 'draw', drawReason: 'Agreement' };
    room.status = 'finished';
    
    if (room.dbGameId) {
      Game.findByIdAndUpdate(room.dbGameId, {
        result: 'draw',
        endedAt: new Date()
      }).catch(err => console.error(`[DB] Error saving draw for room ${room.code}:`, err));
    }
  }
  room.drawOffer = null;
  return { room, accepted: accept };
};

export const resignGame = (socketId: string): { room: Room; loser: Color } | { error: string } => {
  const found = getPlayerBySocket(socketId);
  if (!found) return { error: 'Not in a room.' };
  const { room, player } = found;
  if (room.status !== 'active') return { error: 'Game not active.' };
  const opp: Color = player.color === 'w' ? 'b' : 'w';
  room.gameState = {
    ...room.gameState,
    gameStatus: 'resigned',
    winner: opp,
  };
  room.status = 'finished';

  if (room.dbGameId) {
    Game.findByIdAndUpdate(room.dbGameId, {
      result: 'resigned',
      winner: room.players.find(p => p.color === opp)?.userId || null,
      endedAt: new Date()
    }).catch(err => console.error(`[DB] Error saving resignation for room ${room.code}:`, err));
  }

  return { room, loser: player.color };
};

// ─── Cleanup ──────────────────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const age = now - room.lastActivity;
    // Remove waiting rooms after 1 hour, finished/active after 6 hours
    if ((room.status === 'waiting' && age > 3_600_000) ||
        (room.status !== 'waiting' && age > 21_600_000)) {
      rooms.delete(code);
    }
  }
}, 600_000);
