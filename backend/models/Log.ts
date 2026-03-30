import mongoose from 'mongoose';

const EscalationSchema = new mongoose.Schema({
  limitExceeded: { type: String, default: '-' },
  called: { type: String, default: '-' },
  date: { type: String },
  incidentLocation: { type: String }
});

const LogSchema = new mongoose.Schema({
  user: {
    name: { type: String },
    phone: { type: String },
    email: { type: String }
  },
  lastLocation: { type: String },
  searchHistory: { type: String },
  escalation: EscalationSchema,
  timestamp: { type: Number, default: Date.now }
});

export default mongoose.model('Log', LogSchema);
