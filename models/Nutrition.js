const mongoose = require('mongoose');

// Schema cho nguyên liệu
const ingredientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên nguyên liệu là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên nguyên liệu không được quá 100 ký tự']
  },
  amount: {
    type: Number,
    required: [true, 'Số lượng nguyên liệu là bắt buộc'],
    min: [0, 'Số lượng phải lớn hơn hoặc bằng 0']
  },
  unit: {
    type: String,
    required: [true, 'Đơn vị là bắt buộc'],
    enum: ['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'clove', 'bunch']
  },
  calories: {
    type: Number,
    min: [0, 'Calories phải lớn hơn hoặc bằng 0'],
    default: 0
  },
  protein: {
    type: Number,
    min: [0, 'Protein phải lớn hơn hoặc bằng 0'],
    default: 0
  },
  carbs: {
    type: Number,
    min: [0, 'Carbs phải lớn hơn hoặc bằng 0'],
    default: 0
  },
  fat: {
    type: Number,
    min: [0, 'Fat phải lớn hơn hoặc bằng 0'],
    default: 0
  },
  fiber: {
    type: Number,
    min: [0, 'Fiber phải lớn hơn hoặc bằng 0'],
    default: 0
  }
}, { _id: false });

// Schema cho bữa ăn
const mealSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên món ăn là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên món ăn không được quá 100 ký tự']
  },
  description: {
    type: String,
    required: [true, 'Mô tả món ăn là bắt buộc'],
    maxlength: [500, 'Mô tả không được quá 500 ký tự']
  },
  category: {
    type: String,
    required: [true, 'Danh mục món ăn là bắt buộc'],
    enum: ['weight_loss', 'muscle_gain', 'maintenance', 'general', 'breakfast', 'lunch', 'dinner', 'snack']
  },
  mealType: {
    type: String,
    required: [true, 'Loại bữa ăn là bắt buộc'],
    enum: ['breakfast', 'lunch', 'dinner', 'snack']
  },
  cuisine: {
    type: String,
    enum: ['vietnamese', 'western', 'asian', 'mediterranean', 'mexican', 'indian', 'other'],
    default: 'vietnamese'
  },
  difficulty: {
    type: String,
    required: [true, 'Độ khó nấu là bắt buộc'],
    enum: ['easy', 'medium', 'hard'],
    default: 'easy'
  },
  prepTime: {
    type: Number,
    required: [true, 'Thời gian chuẩn bị là bắt buộc'],
    min: [1, 'Thời gian chuẩn bị phải ít nhất 1 phút'],
    max: [300, 'Thời gian chuẩn bị không được quá 300 phút']
  },
  cookTime: {
    type: Number,
    required: [true, 'Thời gian nấu là bắt buộc'],
    min: [1, 'Thời gian nấu phải ít nhất 1 phút'],
    max: [300, 'Thời gian nấu không được quá 300 phút']
  },
  servings: {
    type: Number,
    required: [true, 'Số khẩu phần là bắt buộc'],
    min: [1, 'Số khẩu phần phải ít nhất 1'],
    max: [20, 'Số khẩu phần không được quá 20']
  },
  ingredients: [ingredientSchema],
  instructions: [{
    type: String,
    required: true,
    maxlength: [500, 'Mỗi bước hướng dẫn không được quá 500 ký tự']
  }],
  nutrition: {
    calories: {
      type: Number,
      required: [true, 'Calories là bắt buộc'],
      min: [0, 'Calories phải lớn hơn hoặc bằng 0']
    },
    protein: {
      type: Number,
      required: [true, 'Protein là bắt buộc'],
      min: [0, 'Protein phải lớn hơn hoặc bằng 0']
    },
    carbs: {
      type: Number,
      required: [true, 'Carbs là bắt buộc'],
      min: [0, 'Carbs phải lớn hơn hoặc bằng 0']
    },
    fat: {
      type: Number,
      required: [true, 'Fat là bắt buộc'],
      min: [0, 'Fat phải lớn hơn hoặc bằng 0']
    },
    fiber: {
      type: Number,
      min: [0, 'Fiber phải lớn hơn hoặc bằng 0'],
      default: 0
    },
    sugar: {
      type: Number,
      min: [0, 'Sugar phải lớn hơn hoặc bằng 0'],
      default: 0
    },
    sodium: {
      type: Number,
      min: [0, 'Sodium phải lớn hơn hoặc bằng 0'],
      default: 0
    }
  },
  images: [{
    url: String,
    publicId: String,
    caption: String
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true
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

// Virtual cho tổng thời gian
mealSchema.virtual('totalTime').get(function() {
  return this.prepTime + this.cookTime;
});

// Virtual cho calories per serving
mealSchema.virtual('caloriesPerServing').get(function() {
  return Math.round(this.nutrition.calories / this.servings);
});

// Method để tăng view count
mealSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

// Method để cập nhật rating
mealSchema.methods.updateRating = function(newRating) {
  const totalRating = (this.averageRating * this.ratingCount) + newRating;
  this.ratingCount += 1;
  this.averageRating = totalRating / this.ratingCount;
  return this.save();
};

// Static method để tìm kiếm meals
mealSchema.statics.searchMeals = function(query, filters = {}) {
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

  if (filters.category) {
    searchQuery.$and.push({ category: filters.category });
  }
  if (filters.mealType) {
    searchQuery.$and.push({ mealType: filters.mealType });
  }
  if (filters.difficulty) {
    searchQuery.$and.push({ difficulty: filters.difficulty });
  }
  if (filters.cuisine) {
    searchQuery.$and.push({ cuisine: filters.cuisine });
  }
  if (filters.maxPrepTime) {
    searchQuery.$and.push({ prepTime: { $lte: filters.maxPrepTime } });
  }
  if (filters.maxCalories) {
    searchQuery.$and.push({ 'nutrition.calories': { $lte: filters.maxCalories } });
  }

  return this.find(searchQuery).populate('createdBy', 'fullName');
};

// Schema cho kế hoạch bữa ăn
const mealPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên kế hoạch bữa ăn là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên kế hoạch không được quá 100 ký tự']
  },
  description: {
    type: String,
    maxlength: [500, 'Mô tả không được quá 500 ký tự']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nutritionist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  goal: {
    type: String,
    required: [true, 'Mục tiêu dinh dưỡng là bắt buộc'],
    enum: ['weight_loss', 'muscle_gain', 'maintenance', 'general', 'performance']
  },
  duration: {
    type: Number,
    required: [true, 'Thời gian kế hoạch là bắt buộc'],
    min: [1, 'Thời gian phải ít nhất 1 ngày'],
    max: [365, 'Thời gian không được quá 365 ngày']
  },
  startDate: {
    type: Date,
    required: [true, 'Ngày bắt đầu là bắt buộc']
  },
  endDate: {
    type: Date,
    required: [true, 'Ngày kết thúc là bắt buộc']
  },
  dailyMeals: [{
    date: {
      type: Date,
      required: true
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
  totalCalories: {
    type: Number,
    default: 0
  },
  totalProtein: {
    type: Number,
    default: 0
  },
  totalCarbs: {
    type: Number,
    default: 0
  },
  totalFat: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Method để tính toán tổng dinh dưỡng
mealPlanSchema.methods.calculateNutrition = function() {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  this.dailyMeals.forEach(day => {
    day.meals.forEach(meal => {
      if (meal.meal && meal.meal.nutrition) {
        const multiplier = meal.servings || 1;
        totalCalories += meal.meal.nutrition.calories * multiplier;
        totalProtein += meal.meal.nutrition.protein * multiplier;
        totalCarbs += meal.meal.nutrition.carbs * multiplier;
        totalFat += meal.meal.nutrition.fat * multiplier;
      }
    });
  });

  this.totalCalories = Math.round(totalCalories);
  this.totalProtein = Math.round(totalProtein);
  this.totalCarbs = Math.round(totalCarbs);
  this.totalFat = Math.round(totalFat);

  return this.save();
};

// Schema cho food log (nhật ký ăn uống)
const foodLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Ngày là bắt buộc'],
    default: Date.now
  },
  meals: [{
    mealType: {
      type: String,
      required: true,
      enum: ['breakfast', 'lunch', 'dinner', 'snack']
    },
    meal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meal'
    },
    customFood: {
      name: String,
      nutrition: {
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number,
        fiber: Number
      }
    },
    servings: {
      type: Number,
      default: 1,
      min: 0.1,
      max: 10
    },
    notes: String,
    loggedAt: {
      type: Date,
      default: Date.now
    }
  }],
  totalCalories: {
    type: Number,
    default: 0
  },
  totalProtein: {
    type: Number,
    default: 0
  },
  totalCarbs: {
    type: Number,
    default: 0
  },
  totalFat: {
    type: Number,
    default: 0
  },
  waterIntake: {
    type: Number,
    min: 0,
    default: 0
  },
  notes: String
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Method để tính toán dinh dưỡng cho food log
foodLogSchema.methods.calculateNutrition = function() {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  this.meals.forEach(meal => {
    const multiplier = meal.servings || 1;
    
    if (meal.meal && meal.meal.nutrition) {
      totalCalories += meal.meal.nutrition.calories * multiplier;
      totalProtein += meal.meal.nutrition.protein * multiplier;
      totalCarbs += meal.meal.nutrition.carbs * multiplier;
      totalFat += meal.meal.nutrition.fat * multiplier;
    } else if (meal.customFood && meal.customFood.nutrition) {
      totalCalories += meal.customFood.nutrition.calories * multiplier;
      totalProtein += meal.customFood.nutrition.protein * multiplier;
      totalCarbs += meal.customFood.nutrition.carbs * multiplier;
      totalFat += meal.customFood.nutrition.fat * multiplier;
    }
  });

  this.totalCalories = Math.round(totalCalories);
  this.totalProtein = Math.round(totalProtein);
  this.totalCarbs = Math.round(totalCarbs);
  this.totalFat = Math.round(totalFat);

  return this.save();
};

// Tạo indexes
mealSchema.index({ name: 'text', description: 'text', tags: 'text' });
mealSchema.index({ category: 1, mealType: 1, difficulty: 1 });
mealSchema.index({ 'nutrition.calories': 1 });
mealSchema.index({ createdBy: 1, isActive: 1 });

mealPlanSchema.index({ user: 1, isActive: 1 });
mealPlanSchema.index({ goal: 1, isTemplate: 1, isPublic: 1 });

foodLogSchema.index({ user: 1, date: 1 });

const Meal = mongoose.model('Meal', mealSchema);
const MealPlan = mongoose.model('MealPlan', mealPlanSchema);
const FoodLog = mongoose.model('FoodLog', foodLogSchema);

module.exports = {
  Meal,
  MealPlan,
  FoodLog
};
