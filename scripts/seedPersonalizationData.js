const mongoose = require('mongoose');
const { UserPreferences, WorkoutHistory, AIWorkoutPlan, NutritionCalculator, AdaptiveLearning } = require('../models/Personalization');
const User = require('../models/User');
const Exercise = require('../models/Exercise');
const { WorkoutPlan } = require('../models/Workout');
const { WorkoutSession } = require('../models/Workout');
const { Meal } = require('../models/Nutrition');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-manager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function clearPersonalizationData() {
  console.log('🧹 Clearing existing personalization data...');
  
  await UserPreferences.deleteMany({});
  await WorkoutHistory.deleteMany({});
  await AIWorkoutPlan.deleteMany({});
  await NutritionCalculator.deleteMany({});
  await AdaptiveLearning.deleteMany({});
  
  console.log('✅ Personalization data cleared');
}

async function createSampleUserPreferences() {
  console.log('👤 Creating sample user preferences...');
  
  const users = await User.find().limit(5);
  if (users.length === 0) {
    console.log('❌ No users found. Please run seed data first.');
    return [];
  }

  const preferences = [];
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    const userPrefs = {
      user: user._id,
      fitnessGoals: i % 2 === 0 ? ['muscle_gain', 'strength'] : ['weight_loss', 'endurance'],
      experienceLevel: ['beginner', 'intermediate', 'advanced'][i % 3],
      workoutFrequency: [2, 3, 4, 5][i % 4],
      workoutDuration: [30, 45, 60, 90][i % 4],
      availableEquipment: i % 2 === 0 
        ? ['dumbbells', 'barbell', 'bench', 'squat_rack']
        : ['resistance_bands', 'yoga_mat', 'none'],
      preferredWorkoutTypes: i % 2 === 0 
        ? ['strength_training', 'hiit']
        : ['cardio', 'yoga', 'pilates'],
      injuryHistory: i === 0 ? [{
        bodyPart: 'knee',
        description: 'Chấn thương đầu gối nhẹ',
        severity: 'minor',
        recovered: true,
        restrictions: ['squat', 'lunge']
      }] : [],
      dietaryRestrictions: i % 3 === 0 ? ['vegetarian'] : i % 3 === 1 ? ['gluten_free'] : [],
      foodPreferences: ['spicy', 'savory', 'crunchy'],
      mealFrequency: [3, 4, 5][i % 3],
      cookingSkill: ['beginner', 'intermediate', 'advanced'][i % 3],
      budgetRange: ['low', 'medium', 'high'][i % 3],
      timeConstraints: {
        morning: i % 2 === 0,
        afternoon: i % 3 === 0,
        evening: i % 2 === 1,
        weekend: true
      },
      motivationLevel: [5, 7, 8, 9][i % 4],
      socialPreferences: {
        solo: i % 2 === 0,
        partner: i % 3 === 0,
        group: i % 4 === 0
      }
    };

    const preference = new UserPreferences(userPrefs);
    await preference.save();
    preferences.push(preference);
    
    console.log(`✅ Created preferences for user ${user.name}`);
  }

  return preferences;
}

async function createSampleWorkoutHistory() {
  console.log('📊 Creating sample workout history...');
  
  const users = await User.find().limit(3);
  const exercises = await Exercise.find().limit(10);
  const workoutPlans = await WorkoutPlan.find().limit(3);
  
  if (users.length === 0 || exercises.length === 0 || workoutPlans.length === 0) {
    console.log('❌ Missing required data. Please run seed data first.');
    return [];
  }

  const workoutHistory = [];
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const workoutPlan = workoutPlans[i % workoutPlans.length];
    
    // Create workout sessions
    const sessions = [];
    for (let j = 0; j < 5; j++) {
      const session = new WorkoutSession({
        user: user._id,
        workoutPlan: workoutPlan._id,
        date: new Date(Date.now() - j * 7 * 24 * 60 * 60 * 1000), // 5 weeks ago
        duration: [30, 45, 60, 75, 90][j],
        exercises: [],
        notes: `Session ${j + 1}`,
        completed: Math.random() > 0.2
      });
      await session.save();
      sessions.push(session);
    }

    // Create workout history for each exercise
    for (let j = 0; j < exercises.length; j++) {
      const exercise = exercises[j];
      const session = sessions[j % sessions.length];
      
      const sets = [];
      const numSets = [2, 3, 4, 5][j % 4];
      const baseWeight = [10, 20, 30, 40, 50][j % 5];
      const baseReps = [8, 10, 12, 15][j % 4];
      
      for (let k = 0; k < numSets; k++) {
        sets.push({
          reps: baseReps + Math.floor(Math.random() * 3),
          weight: baseWeight + Math.floor(Math.random() * 10),
          restTime: [60, 90, 120][k % 3],
          rpe: [6, 7, 8, 9][Math.floor(Math.random() * 4)],
          completed: Math.random() > 0.1,
          notes: k === numSets - 1 ? 'Set cuối cùng' : ''
        });
      }

      const totalVolume = sets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
      const maxWeight = Math.max(...sets.map(s => s.weight));
      const maxReps = Math.max(...sets.map(s => s.reps));
      const avgRPE = sets.reduce((sum, set) => sum + set.rpe, 0) / sets.length;

      const history = new WorkoutHistory({
        user: user._id,
        workoutPlan: workoutPlan._id,
        session: session._id,
        exercise: exercise._id,
        performance: {
          sets,
          totalVolume,
          maxWeight,
          maxReps,
          averageRPE: Math.round(avgRPE * 10) / 10,
          difficulty: ['too_easy', 'easy', 'moderate', 'hard', 'too_hard'][Math.floor(Math.random() * 5)],
          form: ['poor', 'fair', 'good', 'excellent'][Math.floor(Math.random() * 4)],
          pain: ['none', 'mild', 'moderate', 'severe'][Math.floor(Math.random() * 4)]
        },
        feedback: {
          enjoyment: [6, 7, 8, 9][Math.floor(Math.random() * 4)],
          difficulty: [4, 5, 6, 7, 8][Math.floor(Math.random() * 5)],
          effectiveness: [6, 7, 8, 9][Math.floor(Math.random() * 4)],
          comments: j % 3 === 0 ? 'Bài tập rất hiệu quả' : '',
          wouldRepeat: Math.random() > 0.3,
          modifications: j % 4 === 0 ? ['increase_weight', 'add_variation'] : []
        },
        improvements: ['increase_weight', 'increase_reps', 'perfect_form'].slice(0, Math.floor(Math.random() * 3)),
        nextSessionRecommendations: ['progressive_overload', 'variation'].slice(0, Math.floor(Math.random() * 2))
      });

      await history.save();
      workoutHistory.push(history);
    }
    
    console.log(`✅ Created workout history for user ${user.name}`);
  }

  return workoutHistory;
}

async function createSampleAIWorkoutPlans() {
  console.log('🤖 Creating sample AI workout plans...');
  
  const users = await User.find().limit(3);
  const workoutPlans = await WorkoutPlan.find().limit(3);
  
  if (users.length === 0 || workoutPlans.length === 0) {
    console.log('❌ Missing required data. Please run seed data first.');
    return [];
  }

  const aiPlans = [];
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const basePlan = workoutPlans[i % workoutPlans.length];
    
    const aiPlan = new AIWorkoutPlan({
      user: user._id,
      basePlan: basePlan._id,
      aiVersion: 1,
      generationReason: ['initial_creation', 'adaptation', 'progression'][i % 3],
      algorithm: 'hybrid',
      personalizationFactors: [
        { factor: 'fitness_level', weight: 0.3, applied: true },
        { factor: 'goals', weight: 0.25, applied: true },
        { factor: 'equipment', weight: 0.15, applied: true },
        { factor: 'time_constraints', weight: 0.1, applied: true },
        { factor: 'injury_history', weight: 0.1, applied: i === 0 },
        { factor: 'preferences', weight: 0.05, applied: true },
        { factor: 'performance_history', weight: 0.05, applied: true }
      ],
      adaptations: [
        {
          type: 'exercise_substitution',
          reason: 'Thay thế bài tập phù hợp với thiết bị có sẵn',
          originalValue: 'Barbell Squat',
          adaptedValue: 'Dumbbell Squat',
          confidence: 0.8
        },
        {
          type: 'intensity_adjustment',
          reason: 'Điều chỉnh cường độ phù hợp với trình độ',
          originalValue: 'High',
          adaptedValue: 'Medium',
          confidence: 0.9
        }
      ],
      performancePredictions: {
        expectedDifficulty: [6, 7, 8][i % 3],
        expectedDuration: [45, 60, 75][i % 3],
        expectedCalories: [300, 400, 500][i % 3],
        successProbability: [0.7, 0.8, 0.9][i % 3]
      },
      feedback: i > 0 ? {
        userRating: [7, 8, 9][i % 3],
        completionRate: [0.8, 0.9, 1.0][i % 3],
        effectiveness: [7, 8, 9][i % 3],
        comments: 'Kế hoạch AI rất phù hợp với mục tiêu của tôi',
        improvements: ['Tăng cường độ', 'Thêm bài tập mới']
      } : undefined,
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    await aiPlan.save();
    aiPlans.push(aiPlan);
    
    console.log(`✅ Created AI workout plan for user ${user.name}`);
  }

  return aiPlans;
}

async function createSampleNutritionCalculators() {
  console.log('🍎 Creating sample nutrition calculators...');
  
  const users = await User.find().limit(3);
  const meals = await Meal.find().limit(20);
  
  if (users.length === 0 || meals.length === 0) {
    console.log('❌ Missing required data. Please run seed data first.');
    return [];
  }

  const nutritionCalculators = [];
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    const bodyComposition = {
      weight: [60, 70, 80, 90][i % 4],
      height: [160, 170, 175, 180][i % 4],
      age: [25, 30, 35, 40][i % 4],
      gender: ['male', 'female'][i % 2],
      bodyFatPercentage: [15, 20, 25, 30][i % 4],
      activityLevel: ['moderately_active', 'very_active', 'extremely_active'][i % 3]
    };

    const bmr = bodyComposition.gender === 'male' 
      ? 10 * bodyComposition.weight + 6.25 * bodyComposition.height - 5 * bodyComposition.age + 5
      : 10 * bodyComposition.weight + 6.25 * bodyComposition.height - 5 * bodyComposition.age - 161;

    const activityMultipliers = {
      moderately_active: 1.55,
      very_active: 1.725,
      extremely_active: 1.9
    };

    const tdee = bmr * activityMultipliers[bodyComposition.activityLevel];
    const targetCalories = Math.round(tdee + (i % 2 === 0 ? -500 : 300)); // Weight loss or muscle gain

    const goals = {
      primary: i % 2 === 0 ? 'weight_loss' : 'muscle_gain',
      priority: i % 2 === 0 ? 'weight' : 'strength',
      targetWeight: bodyComposition.weight + (i % 2 === 0 ? -5 : 5),
      timeline: 12
    };

    const macros = {
      protein: {
        grams: Math.round(targetCalories * 0.3 / 4),
        percentage: 30
      },
      carbs: {
        grams: Math.round(targetCalories * 0.45 / 4),
        percentage: 45
      },
      fat: {
        grams: Math.round(targetCalories * 0.25 / 9),
        percentage: 25
      }
    };

    const mealTiming = [
      {
        mealType: 'breakfast',
        time: '07:00',
        calories: Math.round(targetCalories * 0.25),
        macros: {
          protein: Math.round(macros.protein.grams * 0.25),
          carbs: Math.round(macros.carbs.grams * 0.25),
          fat: Math.round(macros.fat.grams * 0.25)
        }
      },
      {
        mealType: 'lunch',
        time: '12:00',
        calories: Math.round(targetCalories * 0.35),
        macros: {
          protein: Math.round(macros.protein.grams * 0.35),
          carbs: Math.round(macros.carbs.grams * 0.35),
          fat: Math.round(macros.fat.grams * 0.35)
        }
      },
      {
        mealType: 'dinner',
        time: '19:00',
        calories: Math.round(targetCalories * 0.3),
        macros: {
          protein: Math.round(macros.protein.grams * 0.3),
          carbs: Math.round(macros.carbs.grams * 0.3),
          fat: Math.round(macros.fat.grams * 0.3)
        }
      },
      {
        mealType: 'snack',
        time: '15:00',
        calories: Math.round(targetCalories * 0.1),
        macros: {
          protein: Math.round(macros.protein.grams * 0.1),
          carbs: Math.round(macros.carbs.grams * 0.1),
          fat: Math.round(macros.fat.grams * 0.1)
        }
      }
    ];

    const weeklyPlan = [];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const day of days) {
      const dayMeals = meals.slice(0, 4).map(meal => meal._id);
      weeklyPlan.push({
        day,
        meals: dayMeals,
        totalCalories: targetCalories,
        totalMacros: {
          protein: macros.protein.grams,
          carbs: macros.carbs.grams,
          fat: macros.fat.grams
        }
      });
    }

    const nutritionCalculator = new NutritionCalculator({
      user: user._id,
      bodyComposition,
      goals,
      calculatedMacros: {
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        calories: {
          maintenance: Math.round(tdee),
          target: targetCalories,
          deficit: Math.max(0, Math.round(tdee - targetCalories)),
          surplus: Math.max(0, Math.round(targetCalories - tdee))
        },
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: {
          grams: Math.round(bodyComposition.weight * 0.5 + 14),
          per1000Cal: 14
        },
        water: {
          liters: Math.round(bodyComposition.weight * 35 / 1000 * 10) / 10,
          glasses: Math.round(bodyComposition.weight * 35 / 250)
        }
      },
      mealPlan: {
        mealsPerDay: 4,
        mealTiming,
        weeklyPlan
      },
      restrictions: {
        allergies: [],
        intolerances: [],
        dietary: i % 3 === 0 ? ['vegetarian'] : [],
        budget: ['low', 'medium', 'high'][i % 3],
        cookingTime: ['quick', 'moderate', 'extensive'][i % 3]
      },
      preferences: {
        cuisine: ['vietnamese', 'international'],
        flavors: ['spicy', 'savory'],
        textures: ['crunchy', 'soft'],
        temperature: ['hot', 'cold'],
        mealSize: ['medium', 'large'][i % 2]
      },
      isActive: true,
      lastUpdated: new Date()
    });

    await nutritionCalculator.save();
    nutritionCalculators.push(nutritionCalculator);
    
    console.log(`✅ Created nutrition calculator for user ${user.name}`);
  }

  return nutritionCalculators;
}

async function createSampleAdaptiveLearning() {
  console.log('🧠 Creating sample adaptive learning data...');
  
  const users = await User.find().limit(3);
  // Lấy một số bài tập để tham chiếu ObjectId cho avoidedExercises/alternative
  const sampleExercises = await Exercise.find({}).limit(5).lean();
  
  if (users.length === 0) {
    console.log('❌ No users found. Please run seed data first.');
    return [];
  }

  const adaptiveLearningData = [];
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    const squatLike = sampleExercises.find(e => /squat/i.test(e.name));
    const legPressLike = sampleExercises.find(e => /leg\s*press/i.test(e.name));

    const adaptiveLearning = new AdaptiveLearning({
      user: user._id,
      workoutPatterns: {
        preferredDays: ['monday', 'wednesday', 'friday'],
        preferredTimes: ['morning', 'evening'][i % 2],
        averageDuration: [45, 60, 75][i % 3],
        consistency: [0.7, 0.8, 0.9][i % 3],
        progressionRate: [0.1, 0.15, 0.2][i % 3]
      },
      exercisePreferences: {
        favoriteExercises: [],
        avoidedExercises: i === 0 && squatLike ? [{
          exercise: squatLike._id,
          reason: 'Chấn thương đầu gối',
          alternative: legPressLike ? legPressLike._id : undefined
        }] : [],
        exerciseCategories: {
          strength: { preference: [7, 8, 9][i % 3], proficiency: [6, 7, 8][i % 3] },
          cardio: { preference: [5, 6, 7][i % 3], proficiency: [5, 6, 7][i % 3] },
          flexibility: { preference: [6, 7, 8][i % 3], proficiency: [5, 6, 7][i % 3] },
          balance: { preference: [4, 5, 6][i % 3], proficiency: [4, 5, 6][i % 3] }
        }
      },
      nutritionPatterns: {
        mealTiming: [
          { mealType: 'breakfast', averageTime: '07:30', consistency: 0.8 },
          { mealType: 'lunch', averageTime: '12:30', consistency: 0.9 },
          { mealType: 'dinner', averageTime: '19:00', consistency: 0.7 }
        ],
        macroPreferences: {
          protein: { preference: [7, 8, 9][i % 3], tolerance: 0.2 },
          carbs: { preference: [6, 7, 8][i % 3], tolerance: 0.3 },
          fat: { preference: [5, 6, 7][i % 3], tolerance: 0.25 }
        },
        foodPreferences: {
          liked: ['spicy', 'savory', 'crunchy'],
          disliked: ['bitter', 'sour'],
          allergies: [],
          intolerances: i % 3 === 0 ? ['lactose'] : []
        }
      },
      performanceInsights: {
        strengthGains: [
          { exercise: 'bench_press', improvement: 15, timeframe: 4 },
          { exercise: 'squat', improvement: 20, timeframe: 6 }
        ],
        enduranceGains: [
          { metric: 'running_distance', improvement: 25, timeframe: 8 },
          { metric: 'cycling_duration', improvement: 30, timeframe: 6 }
        ],
        plateaus: [
          { exercise: 'deadlift', duration: 3, resolved: true, solution: 'Deload week' }
        ],
        injuries: i === 0 ? [
          { bodyPart: 'knee', severity: 'minor', recoveryTime: 2, prevention: ['proper_warmup', 'gradual_progression'] }
        ] : []
      },
      recommendations: {
        nextWorkout: ['strength', 'cardio', 'flexibility'][i % 3],
        focusAreas: ['upper_body', 'core'],
        avoidAreas: i === 0 ? ['knee'] : [],
        intensity: ['moderate', 'high'][i % 2],
        duration: [45, 60][i % 2],
        exercises: []
      },
      learningRate: 0.1,
      lastAnalysis: new Date()
    });

    await adaptiveLearning.save();
    adaptiveLearningData.push(adaptiveLearning);
    
    console.log(`✅ Created adaptive learning data for user ${user.name}`);
  }

  return adaptiveLearningData;
}

async function seedPersonalizationData() {
  try {
    console.log('🚀 Starting personalization data seeding...');
    
    await clearPersonalizationData();
    
    const preferences = await createSampleUserPreferences();
    const workoutHistory = await createSampleWorkoutHistory();
    const aiPlans = await createSampleAIWorkoutPlans();
    const nutritionCalculators = await createSampleNutritionCalculators();
    const adaptiveLearningData = await createSampleAdaptiveLearning();
    
    console.log('\n🎉 Personalization data seeding completed successfully!');
    console.log(`📊 Created:`);
    console.log(`   - ${preferences.length} user preferences`);
    console.log(`   - ${workoutHistory.length} workout history records`);
    console.log(`   - ${aiPlans.length} AI workout plans`);
    console.log(`   - ${nutritionCalculators.length} nutrition calculators`);
    console.log(`   - ${adaptiveLearningData.length} adaptive learning records`);
    
  } catch (error) {
    console.error('❌ Error seeding personalization data:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the seeding
if (require.main === module) {
  seedPersonalizationData();
}

module.exports = { seedPersonalizationData };
