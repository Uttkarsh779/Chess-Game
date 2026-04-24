import express from 'express';
import { Game } from '../models/Game';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get games history for the authenticated user
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const games = await Game.find({
      $or: [
        { 'players.player1': userId },
        { 'players.player2': userId }
      ]
    }).sort({ startedAt: -1 }).select('-moves -__v'); // Exclude moves to reduce payload size

    res.status(200).json(games);
  } catch (error) {
    console.error('[GAMES] Fetch history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get specific game
router.get('/:gameId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user?.id;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Optional: check if user was part of the game or just allow viewing
    // Let's just allow viewing for any authenticated user so they can study games
    
    res.status(200).json(game);
  } catch (error) {
    console.error('[GAMES] Fetch game error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
