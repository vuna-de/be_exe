const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { Meal, MealPlan, FoodLog } = require('../models/Nutrition');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validatePagination } = require('../utils/validation');

const router = express.Router();

// ==================== MEAL ROUTES ====================

// Lấy danh sách meals với bộ lọc
router.get('/meals', optionalAuth, validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { 
      category, 
      mealType, 
      difficulty, 
      cuisine, 
      search, 
      maxPrepTime, 
      maxCalories,
      sort = '-createdAt' 
    } = req.query;

    const filter = { isActive: true, isPublic: true };

    if (category) filter.category = category;
    if (mealType) filter.mealType = mealType;
    if (difficulty) filter.difficulty = difficulty;
    if (cuisine) filter.cuisine = cuisine;
    if (maxPrepTime) filter.prepTime = { $lte: parseInt(maxPrepTime) };
    if (maxCalories) filter['nutrition.calories'] = { $lte: parseInt(maxCalories) };

    let query;
    if (search) {
      query = Meal.searchMeals(search, filter);
    } else {
      query = Meal.find(filter).populate('createdBy', 'fullName').sort(sort);
    }

    const meals = await query.skip(skip).limit(limit).lean();
    const total = await Meal.countDocuments(search ? { ...filter, $text: { $search: search } } : filter);

    res.json({
      meals,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get meals error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách món ăn' });
  }
});

// Lấy chi tiết meal
router.get('/meals/:id', optionalAuth, async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id)
      .populate('createdBy', 'fullName')
      .lean();

    if (!meal || !meal.isActive) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn' });
    }

    // Tăng view count nếu user đã đăng nhập
    if (req.user) {
      await Meal.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
    }

    res.json({ meal });
  } catch (error) {
    console.error('Get meal error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết món ăn' });
  }
});

// Tạo meal mới
router.post('/meals', authenticate, [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Tên món ăn phải từ 1-100 ký tự'),
  body('description').trim().isLength({ min: 1, max: 500 }).withMessage('Mô tả phải từ 1-500 ký tự'),
  body('category').isIn(['weight_loss', 'muscle_gain', 'maintenance', 'general', 'breakfast', 'lunch', 'dinner', 'snack']).withMessage('Danh mục không hợp lệ'),
  body('mealType').isIn(['breakfast', 'lunch', 'dinner', 'snack']).withMessage('Loại bữa ăn không hợp lệ'),
  body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Độ khó không hợp lệ'),
  body('prepTime').isInt({ min: 1, max: 300 }).withMessage('Thời gian chuẩn bị phải từ 1-300 phút'),
  body('cookTime').isInt({ min: 1, max: 300 }).withMessage('Thời gian nấu phải từ 1-300 phút'),
  body('servings').isInt({ min: 1, max: 20 }).withMessage('Số khẩu phần phải từ 1-20'),
  body('nutrition.calories').isFloat({ min: 0 }).withMessage('Calories phải lớn hơn hoặc bằng 0'),
  body('nutrition.protein').isFloat({ min: 0 }).withMessage('Protein phải lớn hơn hoặc bằng 0'),
  body('nutrition.carbs').isFloat({ min: 0 }).withMessage('Carbs phải lớn hơn hoặc bằng 0'),
  body('nutrition.fat').isFloat({ min: 0 }).withMessage('Fat phải lớn hơn hoặc bằng 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const meal = new Meal({
      ...req.body,
      createdBy: req.user._id
    });

    await meal.save();
    await meal.populate('createdBy', 'fullName');

    res.status(201).json({
      message: 'Tạo món ăn thành công',
      meal
    });
  } catch (error) {
    console.error('Create meal error:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo món ăn' });
  }
});

// Cập nhật meal
router.put('/meals/:id', authenticate, async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    
    if (!meal) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn' });
    }

    // Chỉ cho phép tác giả hoặc admin cập nhật
    if (meal.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Không có quyền cập nhật món ăn này' });
    }

    Object.assign(meal, req.body);
    await meal.save();
    await meal.populate('createdBy', 'fullName');

    res.json({
      message: 'Cập nhật món ăn thành công',
      meal
    });
  } catch (error) {
    console.error('Update meal error:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật món ăn' });
  }
});

// Xóa meal (soft delete)
router.delete('/meals/:id', authenticate, async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    
    if (!meal) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn' });
    }

    // Chỉ cho phép tác giả hoặc admin xóa
    if (meal.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Không có quyền xóa món ăn này' });
    }

    meal.isActive = false;
    await meal.save();

    res.json({ message: 'Xóa món ăn thành công' });
  } catch (error) {
    console.error('Delete meal error:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa món ăn' });
  }
});

// Đánh giá meal
router.post('/meals/:id/rate', authenticate, [
  body('rating').isFloat({ min: 1, max: 5 }).withMessage('Đánh giá phải từ 1-5 sao')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn' });
    }

    await meal.updateRating(req.body.rating);

    res.json({
      message: 'Đánh giá thành công',
      averageRating: meal.averageRating,
      ratingCount: meal.ratingCount
    });
  } catch (error) {
    console.error('Rate meal error:', error);
    res.status(500).json({ error: 'Lỗi server khi đánh giá món ăn' });
  }
});

// Lấy metadata cho filters
router.get('/meals/categories/list', async (req, res) => {
  try {
    const categories = [
      { value: 'weight_loss', label: 'Giảm cân' },
      { value: 'muscle_gain', label: 'Tăng cơ' },
      { value: 'maintenance', label: 'Duy trì' },
      { value: 'general', label: 'Tổng quát' },
      { value: 'breakfast', label: 'Sáng' },
      { value: 'lunch', label: 'Trưa' },
      { value: 'dinner', label: 'Tối' },
      { value: 'snack', label: 'Ăn vặt' }
    ];

    const mealTypes = [
      { value: 'breakfast', label: 'Bữa sáng' },
      { value: 'lunch', label: 'Bữa trưa' },
      { value: 'dinner', label: 'Bữa tối' },
      { value: 'snack', label: 'Ăn vặt' }
    ];

    const difficulties = [
      { value: 'easy', label: 'Dễ' },
      { value: 'medium', label: 'Trung bình' },
      { value: 'hard', label: 'Khó' }
    ];

    const cuisines = [
      { value: 'vietnamese', label: 'Việt Nam' },
      { value: 'western', label: 'Tây phương' },
      { value: 'asian', label: 'Châu Á' },
      { value: 'mediterranean', label: 'Địa Trung Hải' },
      { value: 'mexican', label: 'Mexico' },
      { value: 'indian', label: 'Ấn Độ' },
      { value: 'other', label: 'Khác' }
    ];

    res.json({
      categories,
      mealTypes,
      difficulties,
      cuisines
    });
  } catch (error) {
    console.error('Get meal metadata error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy metadata' });
  }
});

// ==================== MEAL PLAN ROUTES ====================

// Lấy danh sách meal plans
router.get('/meal-plans', authenticate, validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { goal, isTemplate } = req.query;
    const filter = { user: req.user._id, isActive: true };

    if (goal) filter.goal = goal;
    if (isTemplate !== undefined) filter.isTemplate = isTemplate === 'true';

    const mealPlans = await MealPlan.find(filter)
      .populate('nutritionist', 'fullName')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await MealPlan.countDocuments(filter);

    res.json({
      mealPlans,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get meal plans error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách kế hoạch bữa ăn' });
  }
});

// Tạo meal plan mới
router.post('/meal-plans', authenticate, [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Tên kế hoạch phải từ 1-100 ký tự'),
  body('goal').isIn(['weight_loss', 'muscle_gain', 'maintenance', 'general', 'performance']).withMessage('Mục tiêu không hợp lệ'),
  body('duration').isInt({ min: 1, max: 365 }).withMessage('Thời gian phải từ 1-365 ngày'),
  body('startDate').isISO8601().withMessage('Ngày bắt đầu không hợp lệ'),
  body('endDate').isISO8601().withMessage('Ngày kết thúc không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const mealPlan = new MealPlan({
      ...req.body,
      user: req.user._id
    });

    await mealPlan.save();
    await mealPlan.populate('nutritionist', 'fullName');

    res.status(201).json({
      message: 'Tạo kế hoạch bữa ăn thành công',
      mealPlan
    });
  } catch (error) {
    console.error('Create meal plan error:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo kế hoạch bữa ăn' });
  }
});

// Tạo meal plan từ template
router.post('/meal-plans/generate', authenticate, [
  body('goal').isIn(['weight_loss', 'muscle_gain', 'maintenance', 'general', 'performance']).withMessage('Mục tiêu không hợp lệ'),
  body('duration').isInt({ min: 1, max: 30 }).withMessage('Thời gian phải từ 1-30 ngày'),
  body('preferences').optional().isArray().withMessage('Sở thích phải là mảng')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { goal, duration, preferences = [] } = req.body;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + duration - 1);

    // Tìm meals phù hợp với mục tiêu
    const mealFilter = {
      isActive: true,
      isPublic: true,
      category: goal === 'weight_loss' ? 'weight_loss' : 
                goal === 'muscle_gain' ? 'muscle_gain' : 'general'
    };

    const meals = await Meal.find(mealFilter).limit(50);
    
    if (meals.length === 0) {
      return res.status(400).json({ error: 'Không tìm thấy món ăn phù hợp' });
    }

    // Tạo daily meals
    const dailyMeals = [];
    for (let i = 0; i < duration; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dayMeals = [
        { mealType: 'breakfast', meal: meals[Math.floor(Math.random() * meals.length)]._id, servings: 1 },
        { mealType: 'lunch', meal: meals[Math.floor(Math.random() * meals.length)]._id, servings: 1 },
        { mealType: 'dinner', meal: meals[Math.floor(Math.random() * meals.length)]._id, servings: 1 }
      ];

      dailyMeals.push({ date, meals: dayMeals });
    }

    const mealPlan = new MealPlan({
      name: `Kế hoạch ${goal === 'weight_loss' ? 'Giảm cân' : 
                        goal === 'muscle_gain' ? 'Tăng cơ' : 'Dinh dưỡng'} - ${duration} ngày`,
      description: `Kế hoạch bữa ăn tự động cho mục tiêu ${goal}`,
      user: req.user._id,
      goal,
      duration,
      startDate,
      endDate,
      dailyMeals,
      isTemplate: false
    });

    await mealPlan.save();
    await mealPlan.calculateNutrition();
    await mealPlan.populate('dailyMeals.meals.meal');

    res.status(201).json({
      message: 'Tạo kế hoạch bữa ăn tự động thành công',
      mealPlan
    });
  } catch (error) {
    console.error('Generate meal plan error:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo kế hoạch bữa ăn tự động' });
  }
});

// ==================== FOOD LOG ROUTES ====================

// Lấy food log theo ngày
router.get('/food-logs', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const foodLog = await FoodLog.findOne({
      user: req.user._id,
      date: targetDate
    }).populate('meals.meal');

    if (!foodLog) {
      return res.json({ foodLog: null });
    }

    res.json({ foodLog });
  } catch (error) {
    console.error('Get food log error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy nhật ký ăn uống' });
  }
});

// Tạo/cập nhật food log
router.post('/food-logs', authenticate, [
  body('date').isISO8601().withMessage('Ngày không hợp lệ'),
  body('meals').isArray().withMessage('Bữa ăn phải là mảng'),
  body('waterIntake').optional().isFloat({ min: 0 }).withMessage('Lượng nước phải lớn hơn hoặc bằng 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, meals, waterIntake, notes } = req.body;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    let foodLog = await FoodLog.findOne({
      user: req.user._id,
      date: targetDate
    });

    if (foodLog) {
      foodLog.meals = meals;
      foodLog.waterIntake = waterIntake || 0;
      foodLog.notes = notes;
    } else {
      foodLog = new FoodLog({
        user: req.user._id,
        date: targetDate,
        meals,
        waterIntake: waterIntake || 0,
        notes
      });
    }

    await foodLog.calculateNutrition();
    await foodLog.populate('meals.meal');

    res.json({
      message: 'Lưu nhật ký ăn uống thành công',
      foodLog
    });
  } catch (error) {
    console.error('Save food log error:', error);
    res.status(500).json({ error: 'Lỗi server khi lưu nhật ký ăn uống' });
  }
});

// Lấy thống kê dinh dưỡng
router.get('/nutrition-stats', authenticate, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    const foodLogs = await FoodLog.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    const stats = {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalWater: 0,
      averageCalories: 0,
      averageProtein: 0,
      averageCarbs: 0,
      averageFat: 0,
      averageWater: 0,
      daysLogged: foodLogs.length,
      period
    };

    foodLogs.forEach(log => {
      stats.totalCalories += log.totalCalories || 0;
      stats.totalProtein += log.totalProtein || 0;
      stats.totalCarbs += log.totalCarbs || 0;
      stats.totalFat += log.totalFat || 0;
      stats.totalWater += log.waterIntake || 0;
    });

    if (foodLogs.length > 0) {
      stats.averageCalories = Math.round(stats.totalCalories / foodLogs.length);
      stats.averageProtein = Math.round(stats.totalProtein / foodLogs.length);
      stats.averageCarbs = Math.round(stats.totalCarbs / foodLogs.length);
      stats.averageFat = Math.round(stats.totalFat / foodLogs.length);
      stats.averageWater = Math.round(stats.totalWater / foodLogs.length);
    }

    res.json({ stats });
  } catch (error) {
    console.error('Get nutrition stats error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy thống kê dinh dưỡng' });
  }
});

module.exports = router;