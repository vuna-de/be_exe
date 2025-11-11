const mongoose = require('mongoose');

// Schema cho kết nối PT - Client
const ptClientSchema = new mongoose.Schema({
  pt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'paused', 'completed', 'cancelled'],
    default: 'pending'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  goals: [{
    type: String,
    enum: ['weight_loss', 'muscle_gain', 'endurance', 'strength', 'flexibility', 'general_fitness']
  }],
  notes: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Schema cho tiến độ khách hàng
const clientProgressSchema = new mongoose.Schema({
  ptClient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PTClient',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  weight: {
    type: Number,
    min: 0
  },
  bodyFat: {
    type: Number,
    min: 0,
    max: 100
  },
  muscleMass: {
    type: Number,
    min: 0
  },
  measurements: {
    chest: Number,
    waist: Number,
    hips: Number,
    arms: Number,
    thighs: Number
  },
  photos: [{
    url: String,
    publicId: String,
    caption: String,
    type: {
      type: String,
      enum: ['front', 'side', 'back', 'progress']
    }
  }],
  notes: String,
  mood: {
    type: String,
    enum: ['excellent', 'good', 'average', 'poor', 'terrible']
  },
  energy: {
    type: String,
    enum: ['high', 'medium', 'low']
  },
  sleep: {
    type: Number,
    min: 0,
    max: 24
  },
  waterIntake: {
    type: Number,
    min: 0
  },
  workoutCompleted: {
    type: Boolean,
    default: false
  },
  workoutNotes: String,
  nutrition: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    notes: String
  }
}, { timestamps: true });

// Schema cho kế hoạch được gửi cho khách hàng
const clientPlanSchema = new mongoose.Schema({
  ptClient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PTClient',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['workout', 'nutrition', 'general'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  dueDate: Date,
  status: {
    type: String,
    enum: ['sent', 'received', 'in_progress', 'completed', 'cancelled'],
    default: 'sent'
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'document', 'video', 'link']
    },
    url: String,
    filename: String,
    size: Number
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  completedAt: Date,
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: Date
  }
}, { timestamps: true });

// Schema cho thống kê PT
const ptStatsSchema = new mongoose.Schema({
  pt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  totalClients: {
    type: Number,
    default: 0
  },
  activeClients: {
    type: Number,
    default: 0
  },
  totalSessions: {
    type: Number,
    default: 0
  },
  totalPlansSent: {
    type: Number,
    default: 0
  },
  averageClientRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalRatingCount: {
    type: Number,
    default: 0
  },
  monthlyStats: [{
    month: String, // YYYY-MM format
    newClients: Number,
    completedSessions: Number,
    plansSent: Number,
    revenue: Number
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Indexes
ptClientSchema.index({ pt: 1, client: 1 }, { unique: true });
ptClientSchema.index({ status: 1, isActive: 1 });
ptClientSchema.index({ startDate: -1 });

clientProgressSchema.index({ ptClient: 1, date: -1 });
clientProgressSchema.index({ client: 1, date: -1 });

clientPlanSchema.index({ ptClient: 1, status: 1 });
clientPlanSchema.index({ client: 1, status: 1 });
clientPlanSchema.index({ type: 1, priority: 1 });
clientPlanSchema.index({ createdAt: -1 });

ptStatsSchema.index({ pt: 1 });

// Virtual fields
ptClientSchema.virtual('duration').get(function() {
  if (this.endDate) {
    return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
  }
  return Math.ceil((Date.now() - this.startDate) / (1000 * 60 * 60 * 24));
});

clientProgressSchema.virtual('bmi').get(function() {
  if (this.weight && this.client?.height) {
    const heightInM = this.client.height / 100;
    return (this.weight / (heightInM * heightInM)).toFixed(1);
  }
  return null;
});

// Methods
ptClientSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  if (newStatus === 'completed' || newStatus === 'cancelled') {
    this.endDate = new Date();
  }
  return this.save();
};

clientPlanSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

clientPlanSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

clientPlanSchema.methods.addFeedback = function(rating, comment) {
  this.feedback = {
    rating,
    comment,
    submittedAt: new Date()
  };
  return this.save();
};

// Static methods
ptClientSchema.statics.getActiveClients = function(ptId) {
  return this.find({ pt: ptId, status: 'active', isActive: true })
    .populate('client', 'fullName email avatar membershipType')
    .sort({ startDate: -1 });
};

ptClientSchema.statics.getClientProgress = function(ptClientId, limit = 30) {
  return clientProgressSchema.find({ ptClient: ptClientId })
    .sort({ date: -1 })
    .limit(limit);
};

clientPlanSchema.statics.getRecentPlans = function(ptId, limit = 20) {
  return this.find({ 'ptClient.pt': ptId })
    .populate('ptClient', 'client')
    .populate('client', 'fullName email avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Create models
const PTClient = mongoose.model('PTClient', ptClientSchema);
const ClientProgress = mongoose.model('ClientProgress', clientProgressSchema);
const ClientPlan = mongoose.model('ClientPlan', clientPlanSchema);
const PTStats = mongoose.model('PTStats', ptStatsSchema);

module.exports = {
  PTClient,
  ClientProgress,
  ClientPlan,
  PTStats
};
