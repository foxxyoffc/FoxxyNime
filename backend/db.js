import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, unique: true, required: true },
  username: String,
  vipDracin: { type: Boolean, default: false },
  dracinWatchHistory: { type: Map, of: Number },
  createdAt: { type: Date, default: Date.now }
});
export const User = mongoose.model('User', userSchema);

const contentSchema = new mongoose.Schema({
  title: String,
  type: { type: String, enum: ['anime', 'donghua', 'dracin'] },
  totalEpisodes: Number,
  thumbnail: String,
  embedLinks: [String],
  description: String
});
export const Content = mongoose.model('Content', contentSchema);

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  status: { type: String, default: 'pending' },
  paymentMethod: String,
  createdAt: { type: Date, default: Date.now }
});
export const Payment = mongoose.model('Payment', paymentSchema);

export { connectDB };
