# Grandmaster - Production Quality Chess Game

This is a fully-featured, production-ready Chess game developed from scratch using React, TypeScript, and Vite. 
It includes a custom-built, modular chess engine with move validation, check/checkmate detection, and a Minimax-based AI opponent.

## Features

- **Complete Chess Rules**: Includes Castling, En Passant, Pawn Promotion, Check, Checkmate, and Draw rules (50-move rule, stalemate).
- **Custom Game Engine**: Built from scratch in TypeScript with zero dependencies, featuring move validation and simulation algorithms.
- **Minimax AI**: Built-in computer opponent utilizing the Minimax algorithm with alpha-beta pruning for performance. Three adjustable difficulty levels.
- **Premium UI**: Modern, glassmorphic design with smooth interactions and micro-animations using Vanilla CSS. 
- **Quality of Life**: Move highlights, valid capture indicators, captured pieces display, and a built-in game timer.
- **Game Modes**: Play 2-Player locally or challenge the computer AI as either White or Black.

## Project Structure

- `src/engine/`: Pure TypeScript chess engine with modules for pieces, move generation, AI, and game state management.
- `src/App.tsx`: High-performance React presentation layer that binds the engine to a beautiful Glassmorphic DOM structure.
- `src/index.css`: Elegant styling and visual tokens mimicking an immersive, state-of-the-art interface.

## How to Run Locally

You need Node.js installed on your machine.

1. **Install dependencies:**
```bash
npm install
```

2. **Run the development server:**
```bash
npm run dev
```

3. **Open the game:**
Navigate to `http://localhost:5173` in your browser.

## Tech Stack
- Frontend: React + TypeScript
- Styling: Plain CSS
- Build Tool: Vite
- Icons: Lucide React
