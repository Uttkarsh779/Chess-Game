import { io, Socket } from 'socket.io-client';


const SERVER_URL = import.meta.env.VITE_SERVER_URL || 
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://chess-game-1-6mtw.onrender.com');

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      const token = localStorage.getItem('chess_auth_token');
      if (token) {
        socket?.emit('authenticate', { token });
      }
    });
  }
  return socket;
};

export const connectSocket = (): Socket => {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = (): void => {
  socket?.disconnect();
};
