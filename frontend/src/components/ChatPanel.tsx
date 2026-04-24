import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

export interface ChatMessage {
  roomId: string;
  senderId: string;
  senderName: string;
  message: string;
  type: 'text' | 'reaction' | 'emoji';
  timestamp: Date;
}

interface ChatPanelProps {
  socket: Socket;
  roomCode: string;
  myName: string;
}

const QUICK_REACTIONS = ["Nice!", "Good move!", "Oops!", "GG", "Thanks!"];
const QUICK_EMOJIS = ["😊", "🔥", "♟️", "🤔", "👏"];

const ChatPanel: React.FC<ChatPanelProps> = ({ socket, roomCode, myName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleReceive = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat:receive', handleReceive);

    return () => {
      socket.off('chat:receive', handleReceive);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (message: string, type: 'text' | 'reaction' | 'emoji' = 'text') => {
    if (!message.trim()) return;
    socket.emit('chat:send', { message, type });
    if (type === 'text') setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage(inputValue, 'text');
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-icon">💬</span> Room Chat
      </div>
      
      <div className="chat-messages">
        {messages.map((msg, i) => {
          const isSelf = msg.senderName === myName;
          return (
            <div key={i} className={`chat-message ${isSelf ? 'self' : 'opponent'} type-${msg.type}`}>
              {!isSelf && <div className="chat-sender">{msg.senderName}</div>}
              <div className="chat-bubble">
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-quick-actions">
          <div className="action-row">
            {QUICK_EMOJIS.map(emoji => (
              <button key={emoji} className="quick-btn" onClick={() => sendMessage(emoji, 'emoji')} title={emoji}>
                {emoji}
              </button>
            ))}
          </div>
          <div className="action-row">
            {QUICK_REACTIONS.map(reaction => (
              <button key={reaction} className="quick-btn text" onClick={() => sendMessage(reaction, 'reaction')}>
                {reaction}
              </button>
            ))}
          </div>
        </div>

        <div className="chat-input-row">
          <input
            type="text"
            className="chat-input"
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="chat-send-btn" onClick={() => sendMessage(inputValue, 'text')}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
