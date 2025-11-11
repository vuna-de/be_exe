const mongoose = require('mongoose');

// Schema cho thực đơn mẫu
const mealTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên thực đơn là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên thực đơn không được quá 100 ký tự']
  },
  description: {
    type: String,
    required: [true, 'Mô tả thực đơn là bắt buộc'],
    maxlength: [500, 'Mô tả không được quá 500 ký tự']
  },
  goal: {
    type: String,
    required: [true, 'Mục tiêu là bắt buộc'],
    enum: ['weight_loss', 'muscle_gain', 'maintenance', 'general', 'performance']
  },
  difficulty: {
    type: String,
    required: [true, 'Độ khó là bắt buộc'],
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  duration: {
    type: Number,
    required: [true, 'Thời gian thực hiện là bắt buộc'],
    min: [1, 'Thời gian phải ít nhất 1 ngày'],
    max: [30, 'Thời gian không được quá 30 ngày']
  },
  targetCalories: {
    type: Number,
    required: [true, 'Calories mục tiêu là bắt buộc'],
    min: [800, 'Calories phải ít nhất 800'],
    max: [5000, 'Calories không được quá 5000']
  },
  targetProtein: {
    type: Number,
    required: [true, 'Protein mục tiêu là bắt buộc'],
    min: [0, 'Protein phải lớn hơn hoặc bằng 0']
  },
  targetCarbs: {
    type: Number,
    required: [true, 'Carbs mục tiêu là bắt buộc'],
    min: [0, 'Carbs phải lớn hơn hoặc bằng 0']
  },
  targetFat: {
    type: Number,
    required: [true, 'Fat mục tiêu là bắt buộc'],
    min: [0, 'Fat phải lớn hơn hoặc bằng 0']
  },
  mealsPerDay: {
    type: Number,
    required: [true, 'Số bữa ăn mỗi ngày là bắt buộc'],
    min: [1, 'Số bữa phải ít nhất 1'],
    max: [8, 'Số bữa không được quá 8']
  },
  dailyMeals: [{
    day: {
      type: Number,
      required: true,
      min: 1
    },
    meals: [{
      mealType: {
        type: String,
        required: true,
        enum: ['breakfast', 'lunch', 'dinner', 'snack']
      },
      meal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meal',
        required: true
      },
      servings: {
        type: Number,
        default: 1,
        min: 0.5,
        max: 5
      },
      notes: String
    }]
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  images: [{
    url: String,
    publicId: String,
    caption: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  likeCount: {
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

// Virtual cho tổng calories của template
mealTemplateSchema.virtual('totalCalories').get(function() {
  let total = 0;
  this.dailyMeals.forEach(day => {
    day.meals.forEach(meal => {
      if (meal.meal && meal.meal.nutrition) {
        total += meal.meal.nutrition.calories * (meal.servings || 1);
      }
    });
  });
  return Math.round(total);
});

// Virtual cho tổng protein của template
mealTemplateSchema.virtual('totalProtein').get(function() {
  let total = 0;
  this.dailyMeals.forEach(day => {
    day.meals.forEach(meal => {
      if (meal.meal && meal.meal.nutrition) {
        total += meal.meal.nutrition.protein * (meal.servings || 1);
      }
    });
  });
  return Math.round(total);
});

// Method để tăng view count
mealTemplateSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

// Method để cập nhật rating
mealTemplateSchema.methods.updateRating = function(newRating) {
  const totalRating = (this.averageRating * this.ratingCount) + newRating;
  this.ratingCount += 1;
  this.averageRating = totalRating / this.ratingCount;
  return this.save();
};

// Static method để tìm kiếm templates
mealTemplateSchema.statics.searchTemplates = function(query, filters = {}) {
  const searchQuery = {
    $and: [
      { isActive: true, isPublic: true },
      {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }
    ]
  };

  if (filters.goal) {
    searchQuery.$and.push({ goal: filters.goal });
  }
  if (filters.difficulty) {
    searchQuery.$and.push({ difficulty: filters.difficulty });
  }
  if (filters.duration) {
    searchQuery.$and.push({ duration: { $lte: filters.duration } });
  }
  if (filters.maxCalories) {
    searchQuery.$and.push({ targetCalories: { $lte: filters.maxCalories } });
  }

  return this.find(searchQuery).populate('createdBy', 'fullName');
};

// Tạo indexes
mealTemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });
mealTemplateSchema.index({ goal: 1, difficulty: 1, isActive: 1, isPublic: 1 });
mealTemplateSchema.index({ targetCalories: 1 });
mealTemplateSchema.index({ createdBy: 1 });

const MealTemplate = mongoose.model('MealTemplate', mealTemplateSchema);

module.exports = MealTemplate;
