import mongoose, { Schema, Document } from 'mongoose';

export interface IGameMove {
  from: string;
  to: string;
  piece: string;
  player: mongoose.Types.ObjectId | 'guest';
  timestamp: Date;
  fen?: string;
}

export interface IGameChat {
  senderId: string;
  senderName: string;
  message: string;
  type: 'text' | 'reaction' | 'emoji';
  timestamp: Date;
}

export interface IGame extends Document {
  roomId: string;
  players: {
    player1: mongoose.Types.ObjectId | 'guest';
    player2: mongoose.Types.ObjectId | 'guest';
  };
  playerNames: {
    w: string;
    b: string;
  };
  moves: IGameMove[];
  chat?: IGameChat[];
  result: 'win' | 'loss' | 'draw' | 'ongoing' | 'resigned';
  winner?: mongoose.Types.ObjectId | 'guest' | null;
  startedAt: Date;
  endedAt?: Date;
}

const gameSchema = new Schema<IGame>({
  roomId: { type: String, required: true },
  players: {
    player1: { type: Schema.Types.Mixed, required: true }, // ObjectId or 'guest'
    player2: { type: Schema.Types.Mixed, required: true },
  },
  playerNames: {
    w: { type: String, default: 'Guest' },
    b: { type: String, default: 'Guest' }
  },
  moves: [{
    from: { type: String, required: true },
    to: { type: String, required: true },
    piece: { type: String, required: true },
    player: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now },
    fen: { type: String }
  }],
  chat: [{
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['text', 'reaction', 'emoji'], required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  result: { type: String, enum: ['win', 'loss', 'draw', 'ongoing', 'resigned'], default: 'ongoing' },
  winner: { type: Schema.Types.Mixed, default: null },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

// Index for getting game history for a user
gameSchema.index({ 'players.player1': 1 });
gameSchema.index({ 'players.player2': 1 });
gameSchema.index({ roomId: 1 });

export const Game = mongoose.model<IGame>('Game', gameSchema);
