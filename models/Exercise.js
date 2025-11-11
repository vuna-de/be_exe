const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên bài tập là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên bài tập không được quá 100 ký tự']
  },
  
  description: {
    type: String,
    required: [true, 'Mô tả bài tập là bắt buộc'],
    maxlength: [1000, 'Mô tả không được quá 1000 ký tự']
  },
  
  instructions: [{
    type: String,
    required: true,
    maxlength: [500, 'Mỗi bước hướng dẫn không được quá 500 ký tự']
  }],
  
  // Phân loại bài tập
  category: {
    type: String,
    required: [true, 'Danh mục bài tập là bắt buộc'],
    enum: [
      'chest',      // Ngực
      'back',       // Lưng  
      'shoulders',  // Vai
      'arms',       // Cánh tay
      'legs',       // Chân
      'core',       // Cơ bụng
      'cardio',     // Tim mạch
      'flexibility', // Linh hoạt
      'full_body'   // Toàn thân
    ]
  },
  
  // Nhóm cơ chính
  primaryMuscles: [{
    type: String,
    required: true,
    enum: [
      'chest', 'upper_chest', 'lower_chest',
      'lats', 'rhomboids', 'traps', 'lower_back', 'back',
      'front_delts', 'side_delts', 'rear_delts',
      'biceps', 'triceps', 'forearms',
      'quads', 'hamstrings', 'glutes', 'calves',
      'abs', 'obliques', 'lower_abs',
      'heart', 'full_body', 'core', 'shoulders'
    ]
  }],
  
  // Nhóm cơ phụ
  secondaryMuscles: [{
    type: String,
    enum: [
      'chest', 'upper_chest', 'lower_chest',
      'lats', 'rhomboids', 'traps', 'lower_back', 'back',
      'front_delts', 'side_delts', 'rear_delts',
      'biceps', 'triceps', 'forearms',
      'quads', 'hamstrings', 'glutes', 'calves',
      'abs', 'obliques', 'lower_abs',
      'heart', 'full_body', 'core', 'shoulders'
    ]
  }],
  
  // Độ khó
  difficulty: {
    type: String,
    required: [true, 'Độ khó là bắt buộc'],
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  
  // Loại bài tập
  type: {
    type: String,
    required: [true, 'Loại bài tập là bắt buộc'],
    enum: ['strength', 'cardio', 'flexibility', 'balance', 'plyometric']
  },
  
  // Thiết bị cần thiết
  equipment: [{
    type: String,
    enum: [
      'none',           // Không cần thiết bị
      'dumbbells',      // Tạ đơn
      'barbell',        // Tạ đòn
      'kettlebell',     // Tạ ấm
      'resistance_band', // Dây kháng lực
      'pull_up_bar',    // Xà đơn
      'bench',          // Ghế tập
      'cable_machine',  // Máy cáp
      'treadmill',      // Máy chạy bộ
      'bike',           // Xe đạp
      'yoga_mat',       // Thảm yoga
      'medicine_ball',  // Bóng tập
      'foam_roller',    // Con lăn massage
      'other'
    ]
  }],
  
  // Media files
  images: [{
    url: String,
    publicId: String, // Cloudinary public ID
    caption: String
  }],
  
  videos: [{
    url: String,
    publicId: String, // Cloudinary public ID
    title: String,
    duration: Number // Thời lượng tính bằng giây
  }],
  
  // Thông tin calories và thời gian
  caloriesPerMinute: {
    type: Number,
    min: [1, 'Calories phải lớn hơn 0'],
    max: [50, 'Calories mỗi phút không được quá 50']
  },
  
  estimatedDuration: {
    type: Number, // Thời gian ước tính (phút)
    min: [1, 'Thời gian phải lớn hơn 0'],
    max: [180, 'Thời gian không được quá 180 phút']
  },
  
  // Thông tin sets/reps mặc định
  defaultSets: {
    type: Number,
    min: [1, 'Số sets phải lớn hơn 0'],
    max: [10, 'Số sets không được quá 10'],
    default: 3
  },
  
  defaultReps: {
    min: {
      type: Number,
      min: [1, 'Số reps tối thiểu phải lớn hơn 0'],
      default: 8
    },
    max: {
      type: Number,
      min: [1, 'Số reps tối đa phải lớn hơn 0'],
      default: 12
    }
  },
  
  // Thông tin người tạo
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Trạng thái
  isActive: {
    type: Boolean,
    default: true
  },
  
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Tags để tìm kiếm
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Thống kê
  viewCount: {
    type: Number,
    default: 0
  },
  
  likeCount: {
    type: Number,
    default: 0
  },
  
  // Đánh giá trung bình
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

// Indexes
exerciseSchema.index({ category: 1 });
exerciseSchema.index({ difficulty: 1 });
exerciseSchema.index({ type: 1 });
exerciseSchema.index({ primaryMuscles: 1 });
exerciseSchema.index({ equipment: 1 });
exerciseSchema.index({ tags: 1 });
exerciseSchema.index({ name: 'text', description: 'text', tags: 'text' });
exerciseSchema.index({ isActive: 1, isPublic: 1 });
exerciseSchema.index({ createdBy: 1 });

// Virtual để tính calories ước tính cho bài tập
exerciseSchema.virtual('estimatedCalories').get(function() {
  if (!this.caloriesPerMinute || !this.estimatedDuration) return null;
  return Math.round(this.caloriesPerMinute * this.estimatedDuration);
});

// Method để tăng view count
exerciseSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

// Method để cập nhật rating
exerciseSchema.methods.updateRating = function(newRating, oldRating = null) {
  if (oldRating) {
    // Cập nhật rating cũ
    const totalRating = this.averageRating * this.ratingCount;
    const newTotal = totalRating - oldRating + newRating;
    this.averageRating = Math.round((newTotal / this.ratingCount) * 10) / 10;
  } else {
    // Thêm rating mới
    const totalRating = this.averageRating * this.ratingCount;
    this.ratingCount += 1;
    const newTotal = totalRating + newRating;
    this.averageRating = Math.round((newTotal / this.ratingCount) * 10) / 10;
  }
  return this.save();
};

// Static method để tìm kiếm bài tập
exerciseSchema.statics.searchExercises = function(query, filters = {}) {
  const searchCriteria = {
    isActive: true,
    isPublic: true,
    ...filters
  };
  
  if (query) {
    searchCriteria.$text = { $search: query };
  }
  
  return this.find(searchCriteria)
    .populate('createdBy', 'fullName')
    .sort(query ? { score: { $meta: 'textScore' } } : { createdAt: -1 });
};

module.exports = mongoose.model('Exercise', exerciseSchema);
