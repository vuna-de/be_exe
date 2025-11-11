const mongoose = require('mongoose');

const workoutExerciseSchema = new mongoose.Schema({
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true
  },
  
  // Thông số kế hoạch
  plannedSets: {
    type: Number,
    required: true,
    min: [1, 'Số sets phải lớn hơn 0']
  },
  
  plannedReps: {
    min: Number,
    max: Number
  },
  
  plannedWeight: {
    type: Number,
    min: [0, 'Trọng lượng không được âm']
  },
  
  plannedDuration: {
    type: Number, // Thời gian tính bằng giây (cho cardio)
    min: [0, 'Thời gian không được âm']
  },
  
  plannedDistance: {
    type: Number, // Khoảng cách tính bằng km (cho cardio)
    min: [0, 'Khoảng cách không được âm']
  },
  
  restTime: {
    type: Number, // Thời gian nghỉ giữa các sets (giây)
    default: 60,
    min: [0, 'Thời gian nghỉ không được âm']
  },
  
  notes: {
    type: String,
    maxlength: [500, 'Ghi chú không được quá 500 ký tự']
  },
  
  // Thứ tự trong workout
  order: {
    type: Number,
    required: true,
    min: [1, 'Thứ tự phải lớn hơn 0']
  }
}, {
  _id: false
});

const workoutPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên kế hoạch tập luyện là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên kế hoạch không được quá 100 ký tự']
  },
  
  description: {
    type: String,
    maxlength: [1000, 'Mô tả không được quá 1000 ký tự']
  },
  
  // Người tạo hoặc được gán
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // PT tạo kế hoạch cho user
  },
  
  // Phân loại
  category: {
    type: String,
    required: true,
    enum: [
      'strength',     // Tăng sức mạnh
      'muscle_gain',  // Tăng cơ
      'weight_loss',  // Giảm cân
      'endurance',    // Sức bền
      'flexibility',  // Linh hoạt
      'general'       // Tổng quát
    ]
  },
  
  difficulty: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  
  // Thời gian và tần suất
  estimatedDuration: {
    type: Number, // Thời gian ước tính (phút)
    required: true,
    min: [10, 'Thời gian tập phải ít nhất 10 phút']
  },
  
  frequency: {
    type: String,
    enum: ['daily', 'every_other_day', 'weekly', 'custom'],
    default: 'weekly'
  },
  
  // Danh sách bài tập
  exercises: [workoutExerciseSchema],
  
  // Trạng thái
  isActive: {
    type: Boolean,
    default: true
  },
  
  isTemplate: {
    type: Boolean,
    default: false // Template có thể được sử dụng bởi nhiều user
  },
  
  isPublic: {
    type: Boolean,
    default: false
  },
  
  // Tags
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Thống kê
  totalCalories: {
    type: Number,
    default: 0
  },
  
  completedCount: {
    type: Number,
    default: 0
  },
  // Tổng thời gian đã hoàn thành (phút) cho thống kê
  totalCompletedDuration: {
    type: Number,
    default: 0
  },
  // Tổng calories đã đốt (cộng dồn từ các phiên hoàn thành)
  totalCompletedCalories: {
    type: Number,
    default: 0
  },
  
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  
  ratingCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Schema cho workout session (phiên tập thực tế)
const workoutSetSchema = new mongoose.Schema({
  reps: {
    type: Number,
    min: [0, 'Số reps không được âm']
  },
  weight: {
    type: Number,
    min: [0, 'Trọng lượng không được âm']
  },
  duration: {
    type: Number, // giây
    min: [0, 'Thời gian không được âm']
  },
  distance: {
    type: Number, // km
    min: [0, 'Khoảng cách không được âm']
  },
  restTime: {
    type: Number, // giây nghỉ thực tế
    min: [0, 'Thời gian nghỉ không được âm']
  },
  completed: {
    type: Boolean,
    default: false
  },
  notes: String
}, {
  _id: false,
  timestamps: true
});

const workoutSessionExerciseSchema = new mongoose.Schema({
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true
  },
  
  plannedSets: Number,
  plannedReps: {
    min: Number,
    max: Number
  },
  plannedWeight: Number,
  
  // Sets thực tế đã thực hiện
  sets: [workoutSetSchema],
  
  completed: {
    type: Boolean,
    default: false
  },
  
  notes: String,
  order: Number
}, {
  _id: false
});

const workoutSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  workoutPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkoutPlan'
  },
  
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Thời gian
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  endTime: {
    type: Date
  },
  
  // Trạng thái
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'cancelled'],
    default: 'in_progress'
  },
  
  // Bài tập trong phiên
  exercises: [workoutSessionExerciseSchema],
  
  // Thống kê
  totalCaloriesBurned: {
    type: Number,
    default: 0
  },
  
  totalDuration: {
    type: Number, // phút
    default: 0
  },
  
  completionRate: {
    type: Number, // phần trăm hoàn thành
    min: 0,
    max: 100,
    default: 0
  },
  
  // Cảm nhận sau tập
  mood: {
    type: String,
    enum: ['terrible', 'bad', 'okay', 'good', 'excellent']
  },
  
  energyLevel: {
    type: Number,
    min: 1,
    max: 10
  },
  
  difficultyRating: {
    type: Number,
    min: 1,
    max: 10
  },
  
  notes: {
    type: String,
    maxlength: [1000, 'Ghi chú không được quá 1000 ký tự']
  },
  
  // Ảnh/video của phiên tập
  media: [{
    type: String,
    url: String,
    publicId: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes cho WorkoutPlan
workoutPlanSchema.index({ user: 1 });
workoutPlanSchema.index({ trainer: 1 });
workoutPlanSchema.index({ category: 1 });
workoutPlanSchema.index({ difficulty: 1 });
workoutPlanSchema.index({ isActive: 1, isPublic: 1 });
workoutPlanSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Indexes cho WorkoutSession  
workoutSessionSchema.index({ user: 1 });
workoutSessionSchema.index({ workoutPlan: 1 });
workoutSessionSchema.index({ startTime: -1 });
workoutSessionSchema.index({ status: 1 });

// Virtuals cho WorkoutPlan
workoutPlanSchema.virtual('exerciseCount').get(function() {
  const list = Array.isArray(this.exercises) ? this.exercises : [];
  return list.length;
});

// Virtuals cho WorkoutSession
workoutSessionSchema.virtual('actualDuration').get(function() {
  if (!this.endTime || !this.startTime) return 0;
  return Math.round((this.endTime - this.startTime) / (1000 * 60)); // phút
});

// Methods cho WorkoutSession
workoutSessionSchema.methods.calculateStats = function() {
  let totalCalories = 0;
  let completedExercises = 0;
  const list = Array.isArray(this.exercises) ? this.exercises : [];
  list.forEach(exercise => {
    if (exercise.completed) {
      completedExercises++;
      // Tính calories dựa trên dữ liệu thực tế (sets) hoặc fallback plannedDuration
      let durationMinutes = 0;
      if (Array.isArray(exercise.sets) && exercise.sets.length > 0) {
        const seconds = exercise.sets.reduce((total, set) => total + (set.duration || 0), 0);
        durationMinutes = seconds / 60;
      } else if (exercise.plannedDuration) {
        durationMinutes = (exercise.plannedDuration || 0) / 60;
      } else if (exercise.plannedSets) {
        // Ước tính 2 phút mỗi set nếu không có plannedDuration
        durationMinutes = exercise.plannedSets * 2;
      }
      if (exercise.exercise && exercise.exercise.caloriesPerMinute) {
        totalCalories += exercise.exercise.caloriesPerMinute * durationMinutes;
      }
    }
  });
  
  this.totalCaloriesBurned = Math.round(totalCalories);
  const totalExercises = Array.isArray(this.exercises) ? this.exercises.length : 0;
  this.completionRate = totalExercises > 0
    ? Math.round((completedExercises / totalExercises) * 100)
    : 0;
  
  if (this.endTime && this.startTime) {
    this.totalDuration = Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  
  return this.save();
};

// Method để hoàn thành workout session
workoutSessionSchema.methods.complete = function() {
  this.status = 'completed';
  this.endTime = new Date();
  // Nếu chưa đánh dấu completed cho bài tập nào, coi như phiên hoàn thành toàn bộ bài tập
  const list = Array.isArray(this.exercises) ? this.exercises : [];
  if (!list.some(ex => !!ex.completed)) {
    list.forEach(ex => { ex.completed = true; });
  }
  return this.calculateStats();
};

const WorkoutPlan = mongoose.model('WorkoutPlan', workoutPlanSchema);
const WorkoutSession = mongoose.model('WorkoutSession', workoutSessionSchema);

module.exports = {
  WorkoutPlan,
  WorkoutSession
};
