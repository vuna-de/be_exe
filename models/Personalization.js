const mongoose = require('mongoose');

// Schema cho user preferences và goals
const userPreferencesSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  fitnessGoals: [{
    type: String,
    enum: ['weight_loss', 'muscle_gain', 'endurance', 'strength', 'flexibility', 'general_fitness'],
    required: true
  }],
  experienceLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  workoutFrequency: {
    type: Number,
    min: 1,
    max: 7,
    default: 3
  },
  workoutDuration: {
    type: Number,
    min: 15,
    max: 180,
    default: 60
  },
  availableEquipment: [{
    type: String,
    enum: ['dumbbells', 'barbell', 'kettlebell', 'resistance_bands', 'pull_up_bar', 'bench', 'squat_rack', 'cardio_machine', 'yoga_mat', 'none']
  }],
  preferredWorkoutTypes: [{
    type: String,
    enum: ['strength_training', 'cardio', 'hiit', 'yoga', 'pilates', 'crossfit', 'bodyweight', 'sports']
  }],
  injuryHistory: [{
    bodyPart: {
      type: String,
      enum: ['neck', 'shoulder', 'elbow', 'wrist', 'back', 'hip', 'knee', 'ankle', 'other']
    },
    description: String,
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'severe']
    },
    recovered: {
      type: Boolean,
      default: false
    },
    restrictions: [String]
  }],
  dietaryRestrictions: [{
    type: String,
    enum: ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nut_allergy', 'shellfish_allergy', 'kosher', 'halal', 'keto', 'paleo', 'low_carb', 'low_fat']
  }],
  foodPreferences: [{
    type: String,
    enum: ['spicy', 'mild', 'sweet', 'savory', 'bitter', 'sour', 'crunchy', 'soft', 'hot', 'cold']
  }],
  mealFrequency: {
    type: Number,
    min: 1,
    max: 6,
    default: 3
  },
  cookingSkill: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  budgetRange: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  timeConstraints: {
    morning: { type: Boolean, default: false },
    afternoon: { type: Boolean, default: false },
    evening: { type: Boolean, default: false },
    weekend: { type: Boolean, default: false }
  },
  motivationLevel: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  socialPreferences: {
    solo: { type: Boolean, default: true },
    partner: { type: Boolean, default: false },
    group: { type: Boolean, default: false }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Schema cho workout history và performance tracking
const workoutHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workoutPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkoutPlan',
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkoutSession',
    required: true
  },
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true
  },
  performance: {
    sets: [{
      reps: Number,
      weight: Number,
      duration: Number, // for time-based exercises
      distance: Number, // for cardio
      restTime: Number,
      rpe: { // Rate of Perceived Exertion (1-10)
        type: Number,
        min: 1,
        max: 10
      },
      completed: {
        type: Boolean,
        default: true
      },
      notes: String
    }],
    totalVolume: Number, // total weight * reps
    maxWeight: Number,
    maxReps: Number,
    averageRPE: Number,
    difficulty: {
      type: String,
      enum: ['too_easy', 'easy', 'moderate', 'hard', 'too_hard']
    },
    form: {
      type: String,
      enum: ['poor', 'fair', 'good', 'excellent']
    },
    pain: {
      type: String,
      enum: ['none', 'mild', 'moderate', 'severe']
    }
  },
  feedback: {
    enjoyment: {
      type: Number,
      min: 1,
      max: 10
    },
    difficulty: {
      type: Number,
      min: 1,
      max: 10
    },
    effectiveness: {
      type: Number,
      min: 1,
      max: 10
    },
    comments: String,
    wouldRepeat: Boolean,
    modifications: [String]
  },
  improvements: [{
    type: String,
    enum: ['increase_weight', 'increase_reps', 'decrease_weight', 'decrease_reps', 'change_exercise', 'add_variation', 'perfect_form']
  }],
  nextSessionRecommendations: [{
    type: String,
    enum: ['progressive_overload', 'deload', 'variation', 'rest_day', 'different_exercise']
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Schema cho AI-generated workout plans
const aiWorkoutPlanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  basePlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkoutPlan'
  },
  aiVersion: {
    type: Number,
    default: 1
  },
  generationReason: {
    type: String,
    enum: ['initial_creation', 'adaptation', 'progression', 'plateau_break', 'injury_adaptation', 'goal_change']
  },
  algorithm: {
    type: String,
    enum: ['rule_based', 'ml_recommendation', 'hybrid'],
    default: 'hybrid'
  },
  personalizationFactors: [{
    factor: {
      type: String,
      enum: ['fitness_level', 'goals', 'equipment', 'time_constraints', 'injury_history', 'preferences', 'performance_history']
    },
    weight: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    applied: Boolean
  }],
  adaptations: [{
    type: {
      type: String,
      enum: ['exercise_substitution', 'intensity_adjustment', 'volume_modification', 'rest_optimization', 'progression_rate']
    },
    reason: String,
    originalValue: String,
    adaptedValue: String,
    confidence: {
      type: Number,
      min: 0,
      max: 1
    }
  }],
  performancePredictions: {
    expectedDifficulty: {
      type: Number,
      min: 1,
      max: 10
    },
    expectedDuration: Number,
    expectedCalories: Number,
    successProbability: {
      type: Number,
      min: 0,
      max: 1
    }
  },
  feedback: {
    userRating: {
      type: Number,
      min: 1,
      max: 10
    },
    completionRate: {
      type: Number,
      min: 0,
      max: 1
    },
    effectiveness: {
      type: Number,
      min: 1,
      max: 10
    },
    comments: String,
    improvements: [String]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Schema cho nutrition calculator và meal planning
const nutritionCalculatorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bodyComposition: {
    weight: {
      type: Number,
      required: true,
      min: 20,
      max: 300
    },
    height: {
      type: Number,
      required: true,
      min: 100,
      max: 250
    },
    age: {
      type: Number,
      required: true,
      min: 13,
      max: 100
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    bodyFatPercentage: {
      type: Number,
      min: 3,
      max: 50
    },
    activityLevel: {
      type: String,
      enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'],
      default: 'moderately_active'
    }
  },
  goals: {
    primary: {
      type: String,
      enum: ['weight_loss', 'muscle_gain', 'maintenance', 'performance', 'health'],
      required: true
    },
    targetWeight: Number,
    targetBodyFat: Number,
    timeline: Number, // weeks
    priority: {
      type: String,
      enum: ['weight', 'strength', 'endurance', 'aesthetics', 'health'],
      default: 'weight'
    }
  },
  calculatedMacros: {
    bmr: Number, // Basal Metabolic Rate
    tdee: Number, // Total Daily Energy Expenditure
    calories: {
      maintenance: Number,
      target: Number,
      deficit: Number,
      surplus: Number
    },
    protein: {
      grams: Number,
      percentage: Number,
      perKg: Number
    },
    carbs: {
      grams: Number,
      percentage: Number
    },
    fat: {
      grams: Number,
      percentage: Number
    },
    fiber: {
      grams: Number
    },
    water: {
      liters: Number,
      glasses: Number
    }
  },
  mealPlan: {
    mealsPerDay: {
      type: Number,
      min: 1,
      max: 6,
      default: 3
    },
    mealTiming: [{
      mealType: {
        type: String,
        enum: ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout']
      },
      time: String,
      calories: Number,
      macros: {
        protein: Number,
        carbs: Number,
        fat: Number
      }
    }],
    weeklyPlan: [{
      day: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      meals: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meal'
      }],
      totalCalories: Number,
      totalMacros: {
        protein: Number,
        carbs: Number,
        fat: Number
      }
    }]
  },
  restrictions: {
    allergies: [String],
    intolerances: [String],
    dietary: [String],
    budget: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    cookingTime: {
      type: String,
      enum: ['quick', 'moderate', 'extensive']
    }
  },
  preferences: {
    cuisine: [String],
    flavors: [String],
    textures: [String],
    temperature: [String],
    mealSize: {
      type: String,
      enum: ['small', 'medium', 'large']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Schema cho adaptive learning và recommendations
const adaptiveLearningSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  workoutPatterns: {
    preferredDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    preferredTimes: [{
      type: String,
      enum: ['morning', 'afternoon', 'evening']
    }],
    averageDuration: Number,
    consistency: {
      type: Number,
      min: 0,
      max: 1
    },
    progressionRate: {
      type: Number,
      min: 0,
      max: 1
    }
  },
  exercisePreferences: {
    favoriteExercises: [{
      exercise: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise'
      },
      frequency: Number,
      lastPerformed: Date,
      averageRating: Number
    }],
    avoidedExercises: [{
      exercise: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise'
      },
      reason: String,
      alternative: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise'
      }
    }],
    exerciseCategories: {
      strength: { preference: Number, proficiency: Number },
      cardio: { preference: Number, proficiency: Number },
      flexibility: { preference: Number, proficiency: Number },
      balance: { preference: Number, proficiency: Number }
    }
  },
  nutritionPatterns: {
    mealTiming: [{
      mealType: String,
      averageTime: String,
      consistency: Number
    }],
    macroPreferences: {
      protein: { preference: Number, tolerance: Number },
      carbs: { preference: Number, tolerance: Number },
      fat: { preference: Number, tolerance: Number }
    },
    foodPreferences: {
      liked: [String],
      disliked: [String],
      allergies: [String],
      intolerances: [String]
    }
  },
  performanceInsights: {
    strengthGains: [{
      exercise: String,
      improvement: Number,
      timeframe: Number
    }],
    enduranceGains: [{
      metric: String,
      improvement: Number,
      timeframe: Number
    }],
    plateaus: [{
      exercise: String,
      duration: Number,
      resolved: Boolean,
      solution: String
    }],
    injuries: [{
      bodyPart: String,
      severity: String,
      recoveryTime: Number,
      prevention: [String]
    }]
  },
  recommendations: {
    nextWorkout: {
      type: String,
      enum: ['strength', 'cardio', 'flexibility', 'rest', 'mixed']
    },
    focusAreas: [String],
    avoidAreas: [String],
    intensity: {
      type: String,
      enum: ['low', 'moderate', 'high']
    },
    duration: Number,
    exercises: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise'
    }]
  },
  learningRate: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.1
  },
  lastAnalysis: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userPreferencesSchema.index({ user: 1 });
workoutHistorySchema.index({ user: 1, createdAt: -1 });
workoutHistorySchema.index({ exercise: 1, user: 1 });
aiWorkoutPlanSchema.index({ user: 1, isActive: 1 });
nutritionCalculatorSchema.index({ user: 1, isActive: 1 });
adaptiveLearningSchema.index({ user: 1 });

const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);
const WorkoutHistory = mongoose.model('WorkoutHistory', workoutHistorySchema);
const AIWorkoutPlan = mongoose.model('AIWorkoutPlan', aiWorkoutPlanSchema);
const NutritionCalculator = mongoose.model('NutritionCalculator', nutritionCalculatorSchema);
const AdaptiveLearning = mongoose.model('AdaptiveLearning', adaptiveLearningSchema);

module.exports = {
  UserPreferences,
  WorkoutHistory,
  AIWorkoutPlan,
  NutritionCalculator,
  AdaptiveLearning
};
