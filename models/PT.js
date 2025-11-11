const mongoose = require('mongoose');

const trainerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  specialties: [String],
  bio: String,
  rating: { type: Number, default: 5 },
  pricePerSession: { type: Number, default: 200000 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const ptConnectionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', required: true },
  status: { type: String, enum: ['pending', 'active', 'cancelled'], default: 'pending' }
}, { timestamps: true });

const ptMessageSchema = new mongoose.Schema({
  connection: { type: mongoose.Schema.Types.ObjectId, ref: 'PTConnection', required: true },
  senderType: { type: String, enum: ['user', 'trainer'], required: true },
  text: String,
  mediaUrl: String
}, { timestamps: true });

trainerSchema.index({ isActive: 1 });
ptConnectionSchema.index({ user: 1, trainer: 1 });
ptMessageSchema.index({ connection: 1, createdAt: -1 });

const Trainer = mongoose.model('Trainer', trainerSchema);
const PTConnection = mongoose.model('PTConnection', ptConnectionSchema);
const PTMessage = mongoose.model('PTMessage', ptMessageSchema);

module.exports = { Trainer, PTConnection, PTMessage };


