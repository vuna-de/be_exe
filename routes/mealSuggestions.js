const express = require('express');
const { body, validationResult, query } = require('express-validator');
const MealTemplate = require('../models/MealTemplate');
const Meal = require('../models/Nutrition').Meal;
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validatePagination } = require('../utils/validation');

const router = express.Router();

// ==================== MEAL TEMPLATE ROUTES ====================

// Lấy danh sách meal templates với bộ lọc
router.get('/templates', optionalAuth, validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { 
      goal, 
      difficulty, 
      duration, 
      maxCalories,
      search, 
      sort = '-createdAt' 
    } = req.query;

    const filters = {};
    if (goal) filters.goal = goal;
    if (difficulty) filters.difficulty = difficulty;
    if (duration) filters.duration = { $lte: parseInt(duration) };
    if (maxCalories) filters.targetCalories = { $lte: parseInt(maxCalories) };

    let query;
    if (search) {
      query = MealTemplate.searchTemplates(search, filters);
    } else {
      query = MealTemplate.find({
        isActive: true,
        isPublic: true,
        ...filters
      }).populate('createdBy', 'fullName').sort(sort);
    }

    const templates = await query.skip(skip).limit(limit).lean();
    const total = await MealTemplate.countDocuments({
      isActive: true,
      isPublic: true,
      ...filters
    });

    res.json({
      templates,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get meal templates error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách thực đơn mẫu' });
  }
});

// Lấy metadata cho filters
router.get('/templates/metadata', async (req, res) => {
  try {
    const goals = [
      { value: 'weight_loss', label: 'Giảm cân' },
      { value: 'muscle_gain', label: 'Tăng cơ' },
      { value: 'maintenance', label: 'Duy trì cân nặng' },
      { value: 'general', label: 'Sức khỏe chung' },
      { value: 'performance', label: 'Hiệu suất thể thao' }
    ];

    const difficulties = [
      { value: 'beginner', label: 'Người mới bắt đầu' },
      { value: 'intermediate', label: 'Trung cấp' },
      { value: 'advanced', label: 'Nâng cao' }
    ];

    const activityLevels = [
      { value: 'sedentary', label: 'Ít vận động' },
      { value: 'light', label: 'Vận động nhẹ' },
      { value: 'moderate', label: 'Vận động vừa phải' },
      { value: 'active', label: 'Vận động nhiều' },
      { value: 'very_active', label: 'Vận động rất nhiều' }
    ];

    const durations = [
      { value: 7, label: '1 tuần' },
      { value: 14, label: '2 tuần' },
      { value: 30, label: '1 tháng' }
    ];

    res.json({
      goals,
      difficulties,
      activityLevels,
      durations
    });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy metadata' });
  }
});

// Lấy chi tiết meal template
router.get('/templates/:id', optionalAuth, async (req, res) => {
  try {
    const template = await MealTemplate.findById(req.params.id)
      .populate('createdBy', 'fullName')
      .populate('dailyMeals.meals.meal');

    if (!template || !template.isActive || !template.isPublic) {
      return res.status(404).json({ error: 'Không tìm thấy thực đơn mẫu' });
    }

    // Tăng view count nếu user đã đăng nhập
    if (req.user) {
      await MealTemplate.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
    }

    res.json({ template });
  } catch (error) {
    console.error('Get meal template error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết thực đơn mẫu' });
  }
});

// Tạo meal template mới (admin only)
router.post('/templates', authenticate, [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Tên thực đơn phải từ 1-100 ký tự'),
  body('description').trim().isLength({ min: 1, max: 500 }).withMessage('Mô tả phải từ 1-500 ký tự'),
  body('goal').isIn(['weight_loss', 'muscle_gain', 'maintenance', 'general', 'performance']).withMessage('Mục tiêu không hợp lệ'),
  body('difficulty').isIn(['beginner', 'intermediate', 'advanced']).withMessage('Độ khó không hợp lệ'),
  body('duration').isInt({ min: 1, max: 30 }).withMessage('Thời gian phải từ 1-30 ngày'),
  body('targetCalories').isInt({ min: 800, max: 5000 }).withMessage('Calories mục tiêu phải từ 800-5000'),
  body('targetProtein').isFloat({ min: 0 }).withMessage('Protein mục tiêu phải lớn hơn hoặc bằng 0'),
  body('targetCarbs').isFloat({ min: 0 }).withMessage('Carbs mục tiêu phải lớn hơn hoặc bằng 0'),
  body('targetFat').isFloat({ min: 0 }).withMessage('Fat mục tiêu phải lớn hơn hoặc bằng 0'),
  body('mealsPerDay').isInt({ min: 1, max: 8 }).withMessage('Số bữa ăn phải từ 1-8'),
  body('dailyMeals').isArray().withMessage('Daily meals phải là mảng')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Chỉ admin mới có thể tạo template
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới có thể tạo thực đơn mẫu' });
    }

    const template = new MealTemplate({
      ...req.body,
      createdBy: req.user._id
    });

    await template.save();
    await template.populate('createdBy', 'fullName');

    res.status(201).json({
      message: 'Tạo thực đơn mẫu thành công',
      template
    });
  } catch (error) {
    console.error('Create meal template error:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo thực đơn mẫu' });
  }
});

// Đánh giá meal template
router.post('/templates/:id/rate', authenticate, [
  body('rating').isFloat({ min: 1, max: 5 }).withMessage('Đánh giá phải từ 1-5 sao')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const template = await MealTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Không tìm thấy thực đơn mẫu' });
    }

    await template.updateRating(req.body.rating);

    res.json({
      message: 'Đánh giá thành công',
      averageRating: template.averageRating,
      ratingCount: template.ratingCount
    });
  } catch (error) {
    console.error('Rate meal template error:', error);
    res.status(500).json({ error: 'Lỗi server khi đánh giá thực đơn mẫu' });
  }
});

// ==================== MEAL SUGGESTIONS ROUTES ====================

// Gợi ý thực đơn dựa trên mục tiêu và thông tin cá nhân
router.post('/suggest', authenticate, [
  body('goal').isIn(['weight_loss', 'muscle_gain', 'maintenance', 'general', 'performance']).withMessage('Mục tiêu không hợp lệ'),
  body('currentWeight').optional().isFloat({ min: 30, max: 200 }).withMessage('Cân nặng phải từ 30-200kg'),
  body('height').optional().isFloat({ min: 100, max: 250 }).withMessage('Chiều cao phải từ 100-250cm'),
  body('age').optional().isInt({ min: 13, max: 100 }).withMessage('Tuổi phải từ 13-100'),
  body('activityLevel').optional().isIn(['sedentary', 'light', 'moderate', 'active', 'very_active']).withMessage('Mức độ hoạt động không hợp lệ'),
  body('preferences').optional().isArray().withMessage('Sở thích phải là mảng'),
  body('allergies').optional().isArray().withMessage('Dị ứng phải là mảng'),
  body('duration').optional().isInt({ min: 1, max: 30 }).withMessage('Thời gian phải từ 1-30 ngày')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      goal,
      currentWeight,
      height,
      age,
      activityLevel = 'moderate',
      preferences = [],
      allergies = [],
      duration = 7
    } = req.body;

    // Tính toán calories mục tiêu dựa trên thông tin cá nhân
    let targetCalories = 2000; // Default
    if (currentWeight && height && age) {
      // Sử dụng công thức Mifflin-St Jeor
      const bmr = 10 * currentWeight + 6.25 * height - 5 * age + 5;
      const activityMultipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9
      };
      
      targetCalories = Math.round(bmr * activityMultipliers[activityLevel]);
      
      // Điều chỉnh theo mục tiêu
      if (goal === 'weight_loss') {
        targetCalories = Math.round(targetCalories * 0.8); // Giảm 20%
      } else if (goal === 'muscle_gain') {
        targetCalories = Math.round(targetCalories * 1.1); // Tăng 10%
      }
    }

    // Tìm templates phù hợp
    const filter = {
      goal,
      duration: { $lte: duration },
      targetCalories: { 
        $gte: Math.round(targetCalories * 0.9), 
        $lte: Math.round(targetCalories * 1.1) 
      }
    };

    const templates = await MealTemplate.find({
      isActive: true,
      isPublic: true,
      ...filter
    })
    .populate('createdBy', 'fullName')
    .populate('dailyMeals.meals.meal')
    .sort({ averageRating: -1, viewCount: -1 })
    .limit(10);

    // Lọc theo sở thích và dị ứng nếu có
    let filteredTemplates = templates;
    
    if (preferences.length > 0) {
      filteredTemplates = templates.filter(template => 
        template.tags.some(tag => 
          preferences.some(pref => 
            tag.includes(pref.toLowerCase())
          )
        )
      );
    }

    if (allergies.length > 0) {
      filteredTemplates = filteredTemplates.filter(template => {
        return template.dailyMeals.every(day => 
          day.meals.every(meal => 
            !meal.meal.ingredients.some(ingredient => 
              allergies.some(allergy => 
                ingredient.name.toLowerCase().includes(allergy.toLowerCase())
              )
            )
          )
        );
      });
    }

    // Nếu không tìm thấy template phù hợp, trả về templates mặc định
    if (filteredTemplates.length === 0) {
      filteredTemplates = await MealTemplate.find({
        isActive: true,
        isPublic: true,
        goal
      })
      .populate('createdBy', 'fullName')
      .populate('dailyMeals.meals.meal')
      .sort({ averageRating: -1 })
      .limit(5);
    }

    res.json({
      suggestions: filteredTemplates,
      targetCalories,
      goal,
      duration
    });
  } catch (error) {
    console.error('Suggest meals error:', error);
    res.status(500).json({ error: 'Lỗi server khi gợi ý thực đơn' });
  }
});

// Lấy thống kê meal suggestions
router.get('/stats', async (req, res) => {
  try {
    const totalTemplates = await MealTemplate.countDocuments({ isActive: true, isPublic: true });
    const totalViews = await MealTemplate.aggregate([
      { $match: { isActive: true, isPublic: true } },
      { $group: { _id: null, total: { $sum: '$viewCount' } } }
    ]);
    const totalLikes = await MealTemplate.aggregate([
      { $match: { isActive: true, isPublic: true } },
      { $group: { _id: null, total: { $sum: '$likeCount' } } }
    ]);

    // Thống kê theo mục tiêu
    const goalStats = await MealTemplate.aggregate([
      { $match: { isActive: true, isPublic: true } },
      { $group: { _id: '$goal', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Thống kê theo độ khó
    const difficultyStats = await MealTemplate.aggregate([
      { $match: { isActive: true, isPublic: true } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      totalTemplates,
      totalViews: totalViews.length > 0 ? totalViews[0].total : 0,
      totalLikes: totalLikes.length > 0 ? totalLikes[0].total : 0,
      goalStats,
      difficultyStats
    });
  } catch (error) {
    console.error('Get meal suggestions stats error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy thống kê gợi ý thực đơn' });
  }
});

module.exports = router;
