import mongoose from 'mongoose';

const BroadcastSchema = new mongoose.Schema({
  message: { type: String, required: true },
  date: { type: String, required: true },
  type: { type: String, default: 'General' },
  active: { type: Boolean, default: true },
  timestamp: { type: Number, default: Date.now }
});

export default mongoose.model('Broadcast', BroadcastSchema);
