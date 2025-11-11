const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const Exercise = require('../models/Exercise');
const { WorkoutPlan, WorkoutSession } = require('../models/Workout');
const { SubscriptionPlan, Payment, Subscription } = require('../models/Payment');
const { Trainer, PTConnection, PTMessage } = require('../models/PT');
const Voucher = require('../models/Voucher');
const { Meal, MealPlan, FoodLog } = require('../models/Nutrition');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadMealImages, handleUploadError, deleteOldImage } = require('../middleware/uploadMeals');

const router = express.Router();

// Middleware bảo vệ tất cả routes admin
router.use(authenticate);
router.use(requireRole('admin'));

// ==================== DASHBOARD STATS ====================

// Lấy thống kê tổng quan
router.get('/dashboard/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalExercises,
      totalWorkoutPlans,
      totalSessions,
      totalPayments,
      activeSubscriptions,
      totalRevenue,
      totalVouchers,
      activeVouchers,
      totalMeals,
      activeMeals,
      publicMeals
    ] = await Promise.all([
      User.countDocuments(),
      Exercise.countDocuments(),
      WorkoutPlan.countDocuments(),
      WorkoutSession.countDocuments(),
      Payment.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } }
      ]),
      Voucher.countDocuments(),
      Voucher.countDocuments({
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
      }),
      Meal.countDocuments(),
      Meal.countDocuments({ isActive: true }),
      Meal.countDocuments({ isPublic: true })
    ]);

    // Lấy users mới nhất
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fullName email membershipType createdAt');

    // Lấy payments gần đây
    const recentPayments = await Payment.find()
      .populate('user', 'fullName email')
      .populate('subscriptionPlan', 'name price')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('amount finalAmount status paymentMethod createdAt user subscriptionPlan');

    res.json({
      stats: {
        totalUsers,
        totalExercises,
        totalWorkoutPlans,
        totalSessions,
        totalPayments,
        activeSubscriptions,
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        totalVouchers,
        activeVouchers,
        totalMeals,
        activeMeals,
        publicMeals
      },
      recentUsers,
      recentPayments
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu dashboard' });
  }
});

// ==================== USER MANAGEMENT ====================

// Lấy danh sách users với filter và pagination
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page phải là số nguyên dương'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit phải từ 1-100'),
  query('search').optional().isString().withMessage('Search phải là chuỗi'),
  query('role').optional().isIn(['user', 'trainer', 'admin']).withMessage('Role không hợp lệ'),
  query('membershipType').optional().isIn(['free', 'premium', 'pro', 'year']).withMessage('MembershipType không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { fullName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.membershipType) {
      filter.membershipType = req.query.membershipType;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('fullName email role membershipType isActive createdAt lastLogin avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách users' });
  }
});

// Cập nhật user
router.put('/users/:id', [
  body('fullName').optional().isString().withMessage('FullName phải là chuỗi'),
  body('email').optional().isEmail().withMessage('Email không hợp lệ'),
  body('role').optional().isIn(['user', 'trainer', 'admin']).withMessage('Role không hợp lệ'),
  body('membershipType').optional().isIn(['free', 'premium', 'pro', 'year']).withMessage('MembershipType không hợp lệ'),
  body('isActive').optional().isBoolean().withMessage('IsActive phải là boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('fullName email role membershipType isActive createdAt lastLogin avatar');

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy user' });
    }

    res.json({ user, message: 'Cập nhật user thành công' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật user' });
  }
});

// Xóa user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy user' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Không thể xóa admin' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Xóa user thành công' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa user' });
  }
});

// ==================== EXERCISE MANAGEMENT ====================

// Lấy danh sách exercises với filter và pagination
router.get('/exercises', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page phải là số nguyên dương'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit phải từ 1-100'),
  query('search').optional().isString().withMessage('Search phải là chuỗi'),
  query('category').optional().isString().withMessage('Category phải là chuỗi'),
  query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Difficulty không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }

    const [exercises, total] = await Promise.all([
      Exercise.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Exercise.countDocuments(filter)
    ]);

    res.json({
      exercises,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get exercises error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách exercises' });
  }
});

// Tạo exercise mới
router.post('/exercises', [
  body('name').notEmpty().withMessage('Tên bài tập là bắt buộc'),
  body('description').notEmpty().withMessage('Mô tả là bắt buộc'),
  body('category').notEmpty().withMessage('Danh mục là bắt buộc'),
  body('difficulty').isIn(['beginner', 'intermediate', 'advanced']).withMessage('Độ khó không hợp lệ'),
  body('primaryMuscles').isArray().withMessage('PrimaryMuscles phải là mảng'),
  body('secondaryMuscles').isArray().withMessage('SecondaryMuscles phải là mảng'),
  body('equipment').isString().withMessage('Equipment phải là chuỗi'),
  body('instructions').isArray().withMessage('Instructions phải là mảng')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const exercise = new Exercise(req.body);
    await exercise.save();

    res.status(201).json({ exercise, message: 'Tạo exercise thành công' });
  } catch (error) {
    console.error('Create exercise error:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo exercise' });
  }
});

// Cập nhật exercise
router.put('/exercises/:id', [
  body('name').optional().isString().withMessage('Name phải là chuỗi'),
  body('description').optional().isString().withMessage('Description phải là chuỗi'),
  body('category').optional().isString().withMessage('Category phải là chuỗi'),
  body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Difficulty không hợp lệ'),
  body('primaryMuscles').optional().isArray().withMessage('PrimaryMuscles phải là mảng'),
  body('secondaryMuscles').optional().isArray().withMessage('SecondaryMuscles phải là mảng'),
  body('equipment').optional().isString().withMessage('Equipment phải là chuỗi'),
  body('instructions').optional().isArray().withMessage('Instructions phải là mảng')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const exercise = await Exercise.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!exercise) {
      return res.status(404).json({ error: 'Không tìm thấy exercise' });
    }

    res.json({ exercise, message: 'Cập nhật exercise thành công' });
  } catch (error) {
    console.error('Update exercise error:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật exercise' });
  }
});

// Xóa exercise
router.delete('/exercises/:id', async (req, res) => {
  try {
    const exercise = await Exercise.findByIdAndDelete(req.params.id);
    if (!exercise) {
      return res.status(404).json({ error: 'Không tìm thấy exercise' });
    }

    res.json({ message: 'Xóa exercise thành công' });
  } catch (error) {
    console.error('Delete exercise error:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa exercise' });
  }
});

// ==================== PAYMENT MANAGEMENT ====================

// Lấy danh sách payments với filter và pagination
router.get('/payments', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page phải là số nguyên dương'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit phải từ 1-100'),
  query('status').optional().isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('Status không hợp lệ'),
  query('paymentMethod').optional().isIn(['vnpay', 'momo', 'zalopay']).withMessage('PaymentMethod không hợp lệ'),
  query('dateFrom').optional().isISO8601().withMessage('DateFrom phải là ngày hợp lệ'),
  query('dateTo').optional().isISO8601().withMessage('DateTo phải là ngày hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.paymentMethod) {
      filter.paymentMethod = req.query.paymentMethod;
    }
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) {
        filter.createdAt.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filter.createdAt.$lte = new Date(req.query.dateTo);
      }
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('user', 'fullName email')
        .populate('subscriptionPlan', 'name price')
        .populate('coupon', 'code name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter)
    ]);

    res.json({
      payments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách payments' });
  }
});

// ==================== SUBSCRIPTION PLAN MANAGEMENT ====================

// Lấy danh sách subscription plans
router.get('/subscription-plans', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ sortOrder: 1, createdAt: -1 });
    res.json({ plans });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách gói đăng ký' });
  }
});

// Tạo subscription plan mới
router.post('/subscription-plans', [
  body('name').notEmpty().withMessage('Tên gói là bắt buộc'),
  body('description').notEmpty().withMessage('Mô tả là bắt buộc'),
  body('price').isNumeric().withMessage('Giá phải là số'),
  body('duration').isInt({ min: 1 }).withMessage('Thời hạn phải là số nguyên dương'),
  body('features').isArray().withMessage('Features phải là mảng'),
  body('isActive').isBoolean().withMessage('IsActive phải là boolean'),
  body('sortOrder').isInt({ min: 0 }).withMessage('SortOrder phải là số nguyên không âm')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const plan = new SubscriptionPlan(req.body);
    await plan.save();

    res.status(201).json({ plan, message: 'Tạo gói đăng ký thành công' });
  } catch (error) {
    console.error('Create subscription plan error:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo gói đăng ký' });
  }
});

// Cập nhật subscription plan
router.put('/subscription-plans/:id', [
  body('name').optional().isString().withMessage('Name phải là chuỗi'),
  body('description').optional().isString().withMessage('Description phải là chuỗi'),
  body('price').optional().isNumeric().withMessage('Price phải là số'),
  body('originalPrice').optional().isNumeric().withMessage('OriginalPrice phải là số'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration phải là số nguyên dương'),
  body('features').optional().isArray().withMessage('Features phải là mảng'),
  body('isActive').optional().isBoolean().withMessage('IsActive phải là boolean'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('SortOrder phải là số nguyên không âm')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({ error: 'Không tìm thấy gói đăng ký' });
    }

    res.json({ plan, message: 'Cập nhật gói đăng ký thành công' });
  } catch (error) {
    console.error('Update subscription plan error:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật gói đăng ký' });
  }
});

// Xóa subscription plan
router.delete('/subscription-plans/:id', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Không tìm thấy gói đăng ký' });
    }

    res.json({ message: 'Xóa gói đăng ký thành công' });
  } catch (error) {
    console.error('Delete subscription plan error:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa gói đăng ký' });
  }
});

// ==================== VOUCHER MANAGEMENT ====================

// Lấy danh sách vouchers với filter và pagination
router.get('/vouchers', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page phải là số nguyên dương'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit phải từ 1-100'),
  query('search').optional().isString().withMessage('Search phải là chuỗi'),
  query('discountType').optional().isIn(['percentage', 'fixed_amount']).withMessage('DiscountType không hợp lệ'),
  query('isActive').optional().isBoolean().withMessage('IsActive phải là boolean'),
  query('isPublic').optional().isBoolean().withMessage('IsPublic phải là boolean'),
  query('status').optional().isIn(['active', 'expired', 'inactive']).withMessage('Status không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { code: { $regex: req.query.search, $options: 'i' } },
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.discountType) {
      filter.discountType = req.query.discountType;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    if (req.query.isPublic !== undefined) {
      filter.isPublic = req.query.isPublic === 'true';
    }
    if (req.query.status) {
      const now = new Date();
      switch (req.query.status) {
        case 'active':
          filter.isActive = true;
          filter.validFrom = { $lte: now };
          filter.validUntil = { $gte: now };
          break;
        case 'expired':
          filter.validUntil = { $lt: now };
          break;
        case 'inactive':
          filter.isActive = false;
          break;
      }
    }

    const [vouchers, total] = await Promise.all([
      Voucher.find(filter)
        .populate('createdBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Voucher.countDocuments(filter)
    ]);

    res.json({
      vouchers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get vouchers error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách voucher' });
  }
});

// Tạo voucher mới
router.post('/vouchers', [
  body('code').notEmpty().withMessage('Mã voucher là bắt buộc')
    .matches(/^[A-Z0-9]{6,20}$/).withMessage('Mã voucher phải từ 6-20 ký tự, chỉ chứa chữ cái và số'),
  body('name').notEmpty().withMessage('Tên voucher là bắt buộc'),
  body('description').optional().isString().withMessage('Description phải là chuỗi'),
  body('discountType').isIn(['percentage', 'fixed_amount']).withMessage('Loại giảm giá không hợp lệ'),
  body('discountValue').isFloat({ min: 0.01 }).withMessage('Giá trị giảm giá phải lớn hơn 0'),
  body('maxDiscountAmount').optional().isFloat({ min: 0 }).withMessage('Số tiền giảm tối đa phải là số và không được âm'),
  body('minOrderAmount').optional().isFloat({ min: 0 }).withMessage('Đơn hàng tối thiểu phải là số và không được âm'),
  body('applicablePlans').optional().isArray().withMessage('ApplicablePlans phải là mảng'),
  body('usageLimit').optional().isInt({ min: 1 }).withMessage('Giới hạn sử dụng phải là số nguyên dương'),
  body('usageLimitPerUser').optional().isInt({ min: 1 }).withMessage('Giới hạn sử dụng mỗi user phải là số nguyên dương'),
  body('validFrom').isISO8601().withMessage('Ngày bắt đầu phải là ngày hợp lệ'),
  body('validUntil').isISO8601().withMessage('Ngày kết thúc phải là ngày hợp lệ'),
  body('isActive').optional().isBoolean().withMessage('IsActive phải là boolean'),
  body('isPublic').optional().isBoolean().withMessage('IsPublic phải là boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Kiểm tra mã voucher đã tồn tại chưa
    const existingVoucher = await Voucher.findOne({ code: req.body.code.toUpperCase() });
    if (existingVoucher) {
      return res.status(400).json({ error: 'Mã voucher đã tồn tại' });
    }

    // Kiểm tra ngày hiệu lực
    if (new Date(req.body.validFrom) >= new Date(req.body.validUntil)) {
      return res.status(400).json({ error: 'Ngày kết thúc phải sau ngày bắt đầu' });
    }

    // Kiểm tra giá trị giảm giá
    if (req.body.discountType === 'percentage' && req.body.discountValue > 100) {
      return res.status(400).json({ error: 'Phần trăm giảm giá không được quá 100%' });
    }

    const voucherData = {
      ...req.body,
      code: req.body.code.toUpperCase(),
      createdBy: req.user.id
    };

    const voucher = new Voucher(voucherData);
    await voucher.save();

    await voucher.populate('createdBy', 'fullName email');

    res.status(201).json({ voucher, message: 'Tạo voucher thành công' });
  } catch (error) {
    console.error('Create voucher error:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Mã voucher đã tồn tại' });
    } else {
      res.status(500).json({ error: 'Lỗi server khi tạo voucher' });
    }
  }
});

// Cập nhật voucher
router.put('/vouchers/:id', [
  body('code').optional().matches(/^[A-Z0-9]{6,20}$/).withMessage('Mã voucher phải từ 6-20 ký tự, chỉ chứa chữ cái và số'),
  body('name').optional().isString().withMessage('Name phải là chuỗi'),
  body('description').optional().isString().withMessage('Description phải là chuỗi'),
  body('discountType').optional().isIn(['percentage', 'fixed_amount']).withMessage('DiscountType không hợp lệ'),
  body('discountValue').optional().isFloat({ min: 0.01 }).withMessage('DiscountValue phải lớn hơn 0'),
  body('maxDiscountAmount').optional().isFloat({ min: 0 }).withMessage('MaxDiscountAmount phải là số và không được âm'),
  body('minOrderAmount').optional().isFloat({ min: 0 }).withMessage('MinOrderAmount phải là số và không được âm'),
  body('applicablePlans').optional().isArray().withMessage('ApplicablePlans phải là mảng'),
  body('usageLimit').optional().isInt({ min: 1 }).withMessage('UsageLimit phải là số nguyên dương'),
  body('usageLimitPerUser').optional().isInt({ min: 1 }).withMessage('UsageLimitPerUser phải là số nguyên dương'),
  body('validFrom').optional().isISO8601().withMessage('ValidFrom phải là ngày hợp lệ'),
  body('validUntil').optional().isISO8601().withMessage('ValidUntil phải là ngày hợp lệ'),
  body('isActive').optional().isBoolean().withMessage('IsActive phải là boolean'),
  body('isPublic').optional().isBoolean().withMessage('IsPublic phải là boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Kiểm tra voucher tồn tại
    const existingVoucher = await Voucher.findById(req.params.id);
    if (!existingVoucher) {
      return res.status(404).json({ error: 'Không tìm thấy voucher' });
    }

    // Kiểm tra mã voucher mới (nếu có thay đổi)
    if (req.body.code && req.body.code !== existingVoucher.code) {
      const duplicateVoucher = await Voucher.findOne({ 
        code: req.body.code.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (duplicateVoucher) {
        return res.status(400).json({ error: 'Mã voucher đã tồn tại' });
      }
      req.body.code = req.body.code.toUpperCase();
    }

    // Kiểm tra ngày hiệu lực (nếu có thay đổi)
    if (req.body.validFrom || req.body.validUntil) {
      const validFrom = req.body.validFrom ? new Date(req.body.validFrom) : existingVoucher.validFrom;
      const validUntil = req.body.validUntil ? new Date(req.body.validUntil) : existingVoucher.validUntil;
      
      if (validFrom >= validUntil) {
        return res.status(400).json({ error: 'Ngày kết thúc phải sau ngày bắt đầu' });
      }
    }

    // Kiểm tra giá trị giảm giá (nếu có thay đổi)
    if (req.body.discountType === 'percentage' && req.body.discountValue > 100) {
      return res.status(400).json({ error: 'Phần trăm giảm giá không được quá 100%' });
    }

    const voucher = await Voucher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName email');

    res.json({ voucher, message: 'Cập nhật voucher thành công' });
  } catch (error) {
    console.error('Update voucher error:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Mã voucher đã tồn tại' });
    } else {
      res.status(500).json({ error: 'Lỗi server khi cập nhật voucher' });
    }
  }
});

// Xóa voucher
router.delete('/vouchers/:id', async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ error: 'Không tìm thấy voucher' });
    }

    // Kiểm tra voucher đã được sử dụng chưa
    if (voucher.usedCount > 0) {
      return res.status(400).json({ error: 'Không thể xóa voucher đã được sử dụng' });
    }

    await Voucher.findByIdAndDelete(req.params.id);
    res.json({ message: 'Xóa voucher thành công' });
  } catch (error) {
    console.error('Delete voucher error:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa voucher' });
  }
});

// Lấy thống kê voucher
router.get('/vouchers/stats', async (req, res) => {
  try {
    const [
      totalVouchers,
      activeVouchers,
      expiredVouchers,
      totalUsage,
      totalDiscountGiven
    ] = await Promise.all([
      Voucher.countDocuments(),
      Voucher.countDocuments({
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
      }),
      Voucher.countDocuments({
        validUntil: { $lt: new Date() }
      }),
      Voucher.aggregate([
        { $group: { _id: null, total: { $sum: '$usedCount' } } }
      ]),
      Voucher.aggregate([
        { $group: { _id: null, total: { $sum: '$totalDiscountGiven' } } }
      ])
    ]);

    res.json({
      totalVouchers,
      activeVouchers,
      expiredVouchers,
      totalUsage: totalUsage.length > 0 ? totalUsage[0].total : 0,
      totalDiscountGiven: totalDiscountGiven.length > 0 ? totalDiscountGiven[0].total : 0
    });
  } catch (error) {
    console.error('Get voucher stats error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy thống kê voucher' });
  }
});

// ==================== MEAL MANAGEMENT ====================

// Lấy danh sách meals cho admin
router.get('/meals', requireRole('admin'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page phải là số nguyên dương'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit phải từ 1-100'),
  query('search').optional().isString().withMessage('Search phải là chuỗi'),
  query('category').optional().isString().withMessage('Category phải là chuỗi'),
  query('mealType').optional().isString().withMessage('MealType phải là chuỗi'),
  query('difficulty').optional().isString().withMessage('Difficulty phải là chuỗi'),
  query('cuisine').optional().isString().withMessage('Cuisine phải là chuỗi'),
  query('isActive').optional().isBoolean().withMessage('IsActive phải là boolean'),
  query('isPublic').optional().isBoolean().withMessage('IsPublic phải là boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const {
      search,
      category,
      mealType,
      difficulty,
      cuisine,
      isActive,
      isPublic,
      sort = '-createdAt'
    } = req.query;

    // Build filter
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    if (category) filter.category = category;
    if (mealType) filter.mealType = mealType;
    if (difficulty) filter.difficulty = difficulty;
    if (cuisine) filter.cuisine = cuisine;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isPublic !== undefined) filter.isPublic = isPublic === 'true';

    const meals = await Meal.find(filter)
      .populate('createdBy', 'fullName email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Meal.countDocuments(filter);

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

// Tạo meal mới
router.post('/meals', requireRole('admin'), [
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
  body('nutrition.fat').isFloat({ min: 0 }).withMessage('Fat phải lớn hơn hoặc bằng 0'),
  body('ingredients').isArray().withMessage('Ingredients phải là mảng'),
  body('instructions').isArray().withMessage('Instructions phải là mảng'),
  body('isActive').optional().isBoolean().withMessage('IsActive phải là boolean'),
  body('isPublic').optional().isBoolean().withMessage('IsPublic phải là boolean')
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
    await meal.populate('createdBy', 'fullName email');

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
router.put('/meals/:id', requireRole('admin'), [
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Tên món ăn phải từ 1-100 ký tự'),
  body('description').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Mô tả phải từ 1-500 ký tự'),
  body('category').optional().isIn(['weight_loss', 'muscle_gain', 'maintenance', 'general', 'breakfast', 'lunch', 'dinner', 'snack']).withMessage('Danh mục không hợp lệ'),
  body('mealType').optional().isIn(['breakfast', 'lunch', 'dinner', 'snack']).withMessage('Loại bữa ăn không hợp lệ'),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Độ khó không hợp lệ'),
  body('prepTime').optional().isInt({ min: 1, max: 300 }).withMessage('Thời gian chuẩn bị phải từ 1-300 phút'),
  body('cookTime').optional().isInt({ min: 1, max: 300 }).withMessage('Thời gian nấu phải từ 1-300 phút'),
  body('servings').optional().isInt({ min: 1, max: 20 }).withMessage('Số khẩu phần phải từ 1-20'),
  body('nutrition.calories').optional().isFloat({ min: 0 }).withMessage('Calories phải lớn hơn hoặc bằng 0'),
  body('nutrition.protein').optional().isFloat({ min: 0 }).withMessage('Protein phải lớn hơn hoặc bằng 0'),
  body('nutrition.carbs').optional().isFloat({ min: 0 }).withMessage('Carbs phải lớn hơn hoặc bằng 0'),
  body('nutrition.fat').optional().isFloat({ min: 0 }).withMessage('Fat phải lớn hơn hoặc bằng 0'),
  body('ingredients').optional().isArray().withMessage('Ingredients phải là mảng'),
  body('instructions').optional().isArray().withMessage('Instructions phải là mảng'),
  body('isActive').optional().isBoolean().withMessage('IsActive phải là boolean'),
  body('isPublic').optional().isBoolean().withMessage('IsPublic phải là boolean')
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

    Object.assign(meal, req.body);
    await meal.save();
    await meal.populate('createdBy', 'fullName email');

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
router.delete('/meals/:id', requireRole('admin'), async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn' });
    }

    meal.isActive = false;
    await meal.save();

    res.json({ message: 'Xóa món ăn thành công' });
  } catch (error) {
    console.error('Delete meal error:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa món ăn' });
  }
});

// Lấy thống kê meals
router.get('/meals/stats', requireRole('admin'), async (req, res) => {
  try {
    const totalMeals = await Meal.countDocuments();
    const activeMeals = await Meal.countDocuments({ isActive: true });
    const publicMeals = await Meal.countDocuments({ isPublic: true });
    const totalViews = await Meal.aggregate([
      { $group: { _id: null, total: { $sum: '$viewCount' } } }
    ]);
    const totalLikes = await Meal.aggregate([
      { $group: { _id: null, total: { $sum: '$likeCount' } } }
    ]);

    // Thống kê theo danh mục
    const categoryStats = await Meal.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Thống kê theo độ khó
    const difficultyStats = await Meal.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Thống kê theo ẩm thực
    const cuisineStats = await Meal.aggregate([
      { $group: { _id: '$cuisine', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      totalMeals,
      activeMeals,
      publicMeals,
      totalViews: totalViews.length > 0 ? totalViews[0].total : 0,
      totalLikes: totalLikes.length > 0 ? totalLikes[0].total : 0,
      categoryStats,
      difficultyStats,
      cuisineStats
    });
  } catch (error) {
    console.error('Get meal stats error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy thống kê món ăn' });
  }
});

// Upload ảnh cho meal
router.post('/meals/:id/images', requireRole('admin'), uploadMealImages.array('images', 5), handleUploadError, async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn ít nhất một ảnh' });
    }

    // Tạo array ảnh mới
    const newImages = req.files.map(file => ({
      url: `/uploads/meals/${file.filename}`,
      publicId: file.filename,
      caption: ''
    }));

    // Thêm ảnh mới vào meal
    meal.images = [...(meal.images || []), ...newImages];
    await meal.save();

    res.json({
      message: 'Upload ảnh thành công',
      images: newImages
    });
  } catch (error) {
    console.error('Upload meal images error:', error);
    res.status(500).json({ error: 'Lỗi server khi upload ảnh món ăn' });
  }
});

// Xóa ảnh của meal
router.delete('/meals/:id/images/:imageId', requireRole('admin'), async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn' });
    }

    const imageIndex = meal.images.findIndex(img => img.publicId === req.params.imageId);
    if (imageIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy ảnh' });
    }

    // Xóa file từ server
    const imageToDelete = meal.images[imageIndex];
    deleteOldImage(imageToDelete.url);

    // Xóa ảnh khỏi database
    meal.images.splice(imageIndex, 1);
    await meal.save();

    res.json({ message: 'Xóa ảnh thành công' });
  } catch (error) {
    console.error('Delete meal image error:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa ảnh món ăn' });
  }
});

module.exports = router;
