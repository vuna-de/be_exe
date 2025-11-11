const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, requirePremium } = require('../middleware/auth');
const { 
  UserPreferences, 
  WorkoutHistory, 
  AIWorkoutPlan, 
  NutritionCalculator,
  AdaptiveLearning 
} = require('../models/Personalization');
const aiWorkoutPlanner = require('../services/aiWorkoutPlanner');
const nutritionCalculator = require('../services/nutritionCalculator');

const router = express.Router();

// ===== USER PREFERENCES =====

// Lấy preferences của user
router.get('/preferences', authenticate, requirePremium, async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user: req.user.id })
      .populate('user', 'name email');
    
    if (!preferences) {
      return res.status(404).json({ error: 'Chưa có thông tin preferences' });
    }
    
    res.json(preferences);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy preferences' });
  }
});

// Tạo hoặc cập nhật preferences
router.post('/preferences', authenticate, requirePremium, [
  body('fitnessGoals').isArray().withMessage('Mục tiêu tập luyện phải là mảng'),
  body('experienceLevel').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
  body('workoutFrequency').optional().isInt({ min: 1, max: 7 }),
  body('workoutDuration').optional().isInt({ min: 15, max: 180 }),
  body('availableEquipment').optional().isArray(),
  body('preferredWorkoutTypes').optional().isArray(),
  body('dietaryRestrictions').optional().isArray(),
  body('foodPreferences').optional().isArray(),
  body('mealFrequency').optional().isInt({ min: 1, max: 6 }),
  body('cookingSkill').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('budgetRange').optional().isIn(['low', 'medium', 'high']),
  body('motivationLevel').optional().isInt({ min: 1, max: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const preferencesData = {
      user: req.user.id,
      ...req.body
    };

    const preferences = await UserPreferences.findOneAndUpdate(
      { user: req.user.id },
      preferencesData,
      { upsert: true, new: true }
    );

    res.json(preferences);
  } catch (error) {
    console.error('Create/update preferences error:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo/cập nhật preferences' });
  }
});

// ===== AI WORKOUT PLANNER =====

// Tạo kế hoạch tập luyện AI
router.post('/ai-workout-plan', authenticate, requirePremium, [
  body('goals').isArray().withMessage('Mục tiêu phải là mảng'),
  body('constraints.duration').optional().isInt({ min: 1, max: 12 }),
  body('constraints.timePerSession').optional().isInt({ min: 15, max: 180 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { goals, constraints = {} } = req.body;
    
    const result = await aiWorkoutPlanner.generatePersonalizedWorkout(
      req.user.id,
      null, // preferences will be fetched from DB
      goals,
      constraints
    );

    res.json(result);
  } catch (error) {
    console.error('Generate AI workout plan error:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo kế hoạch tập luyện AI' });
  }
});

// Lấy kế hoạch AI hiện tại
router.get('/ai-workout-plan/current', authenticate, requirePremium, async (req, res) => {
  try {
    const aiPlan = await AIWorkoutPlan.findOne({ 
      user: req.user.id, 
      isActive: true 
    }).populate('basePlan');

    if (!aiPlan) {
      return res.status(404).json({ error: 'Chưa có kế hoạch AI nào' });
    }

    res.json(aiPlan);
  } catch (error) {
    console.error('Get current AI workout plan error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy kế hoạch AI' });
  }
});

// Cập nhật feedback cho kế hoạch AI
router.post('/ai-workout-plan/feedback', authenticate, requirePremium, [
  body('aiPlanId').isMongoId().withMessage('ID kế hoạch AI không hợp lệ'),
  body('userRating').isInt({ min: 1, max: 10 }).withMessage('Đánh giá phải từ 1-10'),
  body('completionRate').isFloat({ min: 0, max: 1 }).withMessage('Tỷ lệ hoàn thành phải từ 0-1'),
  body('effectiveness').isInt({ min: 1, max: 10 }).withMessage('Hiệu quả phải từ 1-10'),
  body('comments').optional().trim().isLength({ max: 500 }).withMessage('Bình luận không được quá 500 ký tự')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { aiPlanId, ...feedbackData } = req.body;

    const aiPlan = await AIWorkoutPlan.findOneAndUpdate(
      { _id: aiPlanId, user: req.user.id },
      { 
        feedback: feedbackData,
        lastUpdated: new Date()
      },
      { new: true }
    );

    if (!aiPlan) {
      return res.status(404).json({ error: 'Không tìm thấy kế hoạch AI' });
    }

    res.json(aiPlan);
  } catch (error) {
    console.error('Update AI workout plan feedback error:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật feedback' });
  }
});

// ===== NUTRITION CALCULATOR =====

// Tính toán dinh dưỡng cá nhân hóa
router.post('/nutrition-calculator', authenticate, requirePremium, [
  body('bodyComposition.weight').isFloat({ min: 20, max: 300 }).withMessage('Cân nặng phải từ 20-300kg'),
  body('bodyComposition.height').isFloat({ min: 100, max: 250 }).withMessage('Chiều cao phải từ 100-250cm'),
  body('bodyComposition.age').isInt({ min: 13, max: 100 }).withMessage('Tuổi phải từ 13-100'),
  body('bodyComposition.gender').isIn(['male', 'female', 'other']).withMessage('Giới tính không hợp lệ'),
  body('goals.primary').isIn(['weight_loss', 'muscle_gain', 'maintenance', 'performance', 'health']).withMessage('Mục tiêu chính không hợp lệ'),
  body('preferences.mealFrequency').optional().isInt({ min: 1, max: 6 }),
  body('preferences.restrictions.dietary').optional().isArray(),
  body('preferences.preferences.cuisine').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bodyComposition, goals, preferences = {} } = req.body;

    const nutritionData = await nutritionCalculator.calculatePersonalizedNutrition(
      req.user.id,
      bodyComposition,
      goals,
      preferences
    );

    res.json(nutritionData);
  } catch (error) {
    console.error('Calculate personalized nutrition error:', error);
    res.status(500).json({ error: 'Lỗi server khi tính toán dinh dưỡng' });
  }
});

// Lấy thông tin dinh dưỡng hiện tại
router.get('/nutrition-calculator/current', authenticate, requirePremium, async (req, res) => {
  try {
    const nutritionData = await NutritionCalculator.findOne({ 
      user: req.user.id, 
      isActive: true 
    });

    if (!nutritionData) {
      return res.status(404).json({ error: 'Chưa có thông tin dinh dưỡng' });
    }

    res.json(nutritionData);
  } catch (error) {
    console.error('Get current nutrition data error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy thông tin dinh dưỡng' });
  }
});

// Lấy khuyến nghị dinh dưỡng
router.get('/nutrition-calculator/recommendations', authenticate, requirePremium, async (req, res) => {
  try {
    const recommendations = await nutritionCalculator.getNutritionRecommendations(req.user.id);
    res.json(recommendations);
  } catch (error) {
    console.error('Get nutrition recommendations error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy khuyến nghị dinh dưỡng' });
  }
});

// Theo dõi tiến độ dinh dưỡng
router.post('/nutrition-calculator/track', authenticate, requirePremium, [
  body('date').isISO8601().withMessage('Ngày không hợp lệ'),
  body('meals').isArray().withMessage('Danh sách bữa ăn phải là mảng')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, meals } = req.body;

    const progress = await nutritionCalculator.trackNutritionProgress(
      req.user.id,
      date,
      meals
    );

    res.json(progress);
  } catch (error) {
    console.error('Track nutrition progress error:', error);
    res.status(500).json({ error: 'Lỗi server khi theo dõi tiến độ dinh dưỡng' });
  }
});

// Lấy insights dinh dưỡng
router.get('/nutrition-calculator/insights', authenticate, requirePremium, async (req, res) => {
  try {
    const period = req.query.period || 'week';
    const insights = await nutritionCalculator.getNutritionInsights(req.user.id, period);
    res.json(insights);
  } catch (error) {
    console.error('Get nutrition insights error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy insights dinh dưỡng' });
  }
});

// ===== WORKOUT HISTORY =====

// Lưu lịch sử tập luyện
router.post('/workout-history', authenticate, [
  body('workoutPlan').isMongoId().withMessage('ID kế hoạch tập luyện không hợp lệ'),
  body('session').isMongoId().withMessage('ID phiên tập không hợp lệ'),
  body('exercise').isMongoId().withMessage('ID bài tập không hợp lệ'),
  body('performance.sets').isArray().withMessage('Sets phải là mảng'),
  body('performance.sets.*.reps').isInt({ min: 0 }).withMessage('Số reps phải >= 0'),
  body('performance.sets.*.weight').isFloat({ min: 0 }).withMessage('Trọng lượng phải >= 0'),
  body('performance.sets.*.rpe').optional().isInt({ min: 1, max: 10 }).withMessage('RPE phải từ 1-10'),
  body('feedback.enjoyment').optional().isInt({ min: 1, max: 10 }).withMessage('Mức độ thích thú phải từ 1-10'),
  body('feedback.difficulty').optional().isInt({ min: 1, max: 10 }).withMessage('Độ khó phải từ 1-10'),
  body('feedback.effectiveness').optional().isInt({ min: 1, max: 10 }).withMessage('Hiệu quả phải từ 1-10')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const workoutHistoryData = {
      user: req.user.id,
      ...req.body
    };

    const workoutHistory = new WorkoutHistory(workoutHistoryData);
    await workoutHistory.save();

    res.status(201).json(workoutHistory);
  } catch (error) {
    console.error('Create workout history error:', error);
    res.status(500).json({ error: 'Lỗi server khi lưu lịch sử tập luyện' });
  }
});

// Lấy lịch sử tập luyện
router.get('/workout-history', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const workoutHistory = await WorkoutHistory.find({ user: req.user.id })
      .populate('workoutPlan', 'name')
      .populate('session', 'date')
      .populate('exercise', 'name category primaryMuscles')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await WorkoutHistory.countDocuments({ user: req.user.id });

    res.json({
      workoutHistory,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get workout history error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy lịch sử tập luyện' });
  }
});

// ===== ADAPTIVE LEARNING =====

// Lấy thông tin adaptive learning
router.get('/adaptive-learning', authenticate, requirePremium, async (req, res) => {
  try {
    const adaptiveLearning = await AdaptiveLearning.findOne({ user: req.user.id });

    if (!adaptiveLearning) {
      return res.status(404).json({ error: 'Chưa có thông tin adaptive learning' });
    }

    res.json(adaptiveLearning);
  } catch (error) {
    console.error('Get adaptive learning error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy thông tin adaptive learning' });
  }
});

// Cập nhật adaptive learning
router.post('/adaptive-learning/update', authenticate, requirePremium, [
  body('workoutPatterns.preferredDays').optional().isArray(),
  body('workoutPatterns.preferredTimes').optional().isArray(),
  body('exercisePreferences.favoriteExercises').optional().isArray(),
  body('exercisePreferences.avoidedExercises').optional().isArray(),
  body('nutritionPatterns.mealTiming').optional().isArray(),
  body('performanceInsights.strengthGains').optional().isArray(),
  body('performanceInsights.enduranceGains').optional().isArray(),
  body('recommendations.nextWorkout').optional().isIn(['strength', 'cardio', 'flexibility', 'rest', 'mixed'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = {
      ...req.body,
      lastAnalysis: new Date()
    };

    const adaptiveLearning = await AdaptiveLearning.findOneAndUpdate(
      { user: req.user.id },
      updateData,
      { upsert: true, new: true }
    );

    res.json(adaptiveLearning);
  } catch (error) {
    console.error('Update adaptive learning error:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật adaptive learning' });
  }
});

// ===== ANALYTICS & INSIGHTS =====

// Lấy analytics tổng hợp
router.get('/analytics', authenticate, requirePremium, async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const userId = req.user.id;

    // Get workout statistics
    const workoutStats = await WorkoutHistory.aggregate([
      { $match: { user: userId } },
      { $group: {
        _id: null,
        totalWorkouts: { $sum: 1 },
        avgRPE: { $avg: '$performance.averageRPE' },
        avgVolume: { $avg: '$performance.totalVolume' },
        consistency: { $avg: { $cond: ['$performance.completed', 1, 0] } }
      }}
    ]);

    // Get nutrition statistics
    const nutritionStats = await NutritionCalculator.findOne({ 
      user: userId, 
      isActive: true 
    });

    // Get AI plan performance
    const aiPlanStats = await AIWorkoutPlan.aggregate([
      { $match: { user: userId } },
      { $group: {
        _id: null,
        totalPlans: { $sum: 1 },
        avgRating: { $avg: '$feedback.userRating' },
        avgCompletion: { $avg: '$feedback.completionRate' }
      }}
    ]);

    const analytics = {
      workout: workoutStats[0] || {},
      nutrition: nutritionStats?.calculatedMacros || {},
      aiPlan: aiPlanStats[0] || {},
      period,
      generatedAt: new Date()
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy analytics' });
  }
});

module.exports = router;

// === Extended endpoints: advanced generate + quick nutrition calculate ===
// (Appended to support Premium quick actions)
router.post('/workout/advanced-generate', authenticate, requirePremium, async (req, res) => {
  try {
    const userId = req.user.id;
    const { goal = 'general', difficulty = 'intermediate' } = req.body || {};

    // Lấy preferences nếu có để lọc thiết bị/nhóm cơ tránh
    const prefs = await UserPreferences.findOne({ user: userId }).lean().catch(() => null);
    const equipmentFilter = prefs?.availableEquipment?.length ? { equipment: { $in: [...prefs.availableEquipment, 'none'] } } : {};
    const avoidParts = (prefs?.injuryHistory || []).map((i) => i.bodyPart);

    // Lọc exercise cơ bản theo độ khó và thiết bị
    const baseExercises = await require('../models/Exercise').find({ isActive: true, isPublic: true, difficulty, ...equipmentFilter })
      .sort({ averageRating: -1, viewCount: -1 })
      .limit(100)
      .lean();

    const filtered = baseExercises.filter((ex) => !avoidParts.some((a) => (ex.primaryMuscles || []).includes(a)));
    const picked = filtered.slice(0, 8).map((ex, idx) => ({
      exercise: ex._id,
      plannedSets: ex.defaultSets || 3,
      plannedReps: ex.defaultReps || { min: 8, max: 12 },
      restTime: 60,
      order: idx + 1
    }));

    const totalCalories = picked.reduce((sum, s) => {
      const ex = baseExercises.find((e) => e._id.toString() === s.exercise.toString());
      const duration = ex?.estimatedDuration || 10;
      return sum + (ex?.caloriesPerMinute || 6) * duration;
    }, 0);

    const { WorkoutPlan } = require('../models/Workout');
    const plan = new WorkoutPlan({
      name: `Kế hoạch cá nhân hóa (${goal})`,
      description: 'Sinh tự động từ lịch sử & preferences',
      user: userId,
      category: goal,
      difficulty,
      estimatedDuration: picked.length * 10,
      exercises: picked,
      totalCalories: Math.round(totalCalories),
      isTemplate: false,
      isPublic: false
    });
    await plan.save();

    return res.json({ message: 'Tạo kế hoạch nâng cao thành công', workoutPlan: plan });
  } catch (err) {
    console.error('advanced-generate error', err);
    return res.status(500).json({ error: 'Lỗi server khi tạo kế hoạch nâng cao' });
  }
});

router.post('/nutrition/calculate', authenticate, requirePremium, async (req, res) => {
  try {
    const { height, weight, age, gender, activityLevel, goal } = req.body || {};
    if (!height || !weight || !age || !gender) {
      return res.status(400).json({ error: 'Thiếu dữ liệu cơ thể (height, weight, age, gender)' });
    }
    const bmr = gender === 'male' ? (10 * weight + 6.25 * height - 5 * age + 5) : (10 * weight + 6.25 * height - 5 * age - 161);
    const factorMap = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
    const tdee = Math.round(bmr * (factorMap[activityLevel] || 1.55));
    let target = tdee;
    if (goal === 'weight_loss') target = tdee - 400; else if (goal === 'muscle_gain') target = tdee + 300;
    const protein = Math.round(weight * 2.0);
    const fat = Math.round((0.25 * target) / 9);
    const carbs = Math.round((target - protein * 4 - fat * 9) / 4);
    const distribution = { breakfast: 0.3, lunch: 0.35, dinner: 0.3, snack: 0.05 };
    return res.json({ stats: { bmr: Math.round(bmr), tdee, calories: target, protein, carbs, fat, distribution } });
  } catch (err) {
    console.error('nutrition calculate error', err);
    return res.status(500).json({ error: 'Lỗi server khi tính dinh dưỡng' });
  }
});
