import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();



const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://uttkarshtiwari01_db_user:m6jIZBNdJfGHwDJB@cluster0.jbrudru.mongodb.net/chess_db?retryWrites=true&w=majority';

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] MongoDB connected successfully');
  } catch (error) {
    console.error('[DB] MongoDB connection failed:', error);
    process.exit(1);
  }
};
