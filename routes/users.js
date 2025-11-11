const express = require('express');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { validateUpdateProfile, validateObjectId, validatePagination } = require('../utils/validation');
const { uploadAvatar, handleUploadError, deleteOldAvatar } = require('../middleware/upload');
const { body } = require('express-validator');
const path = require('path');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Lấy thông tin profile của user hiện tại
// @access  Private
router.get('/profile', authenticate, (req, res) => {
  res.json({
    user: req.user.toJSON()
  });
});

// @route   PUT /api/users/profile
// @desc    Cập nhật thông tin profile
// @access  Private
router.put('/profile', authenticate, validateUpdateProfile, async (req, res) => {
  try {
    const allowedUpdates = [
      'fullName', 'dateOfBirth', 'gender', 'height', 'weight', 
      'fitnessGoal', 'activityLevel'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    // Chuyển đổi dateOfBirth thành Date object
    if (updates.dateOfBirth) {
      updates.dateOfBirth = new Date(updates.dateOfBirth);
    }
    
    Object.assign(req.user, updates);
    await req.user.save();
    
    res.json({
      message: 'Cập nhật profile thành công',
      user: req.user.toJSON()
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Lỗi server khi cập nhật profile'
    });
  }
});

// @route   POST /api/users/upload-avatar
// @desc    Upload ảnh đại diện
// @access  Private
router.post('/upload-avatar', authenticate, uploadAvatar, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn file ảnh để upload'
      });
    }

    // Xóa avatar cũ (nếu có và không phải avatar mặc định)
    if (req.user.avatar && !req.user.avatar.includes('ui-avatars.com')) {
      deleteOldAvatar(req.user.avatar);
    }

    // Tạo URL cho avatar mới
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    // Cập nhật avatar trong database
    req.user.avatar = avatarUrl;
    await req.user.save();
    
    res.json({
      success: true,
      message: 'Upload ảnh đại diện thành công',
      data: {
        avatar: req.user.avatar,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });
    
  } catch (error) {
    console.error('Upload avatar error:', error);
    
    // Xóa file đã upload nếu có lỗi
    if (req.file) {
      deleteOldAvatar(`/uploads/avatars/${req.file.filename}`);
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi upload ảnh đại diện'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Lấy thống kê của user
// @access  Private
router.get('/stats', authenticate, async (req, res) => {
  try {
    // TODO: Tính toán thống kê từ workout sessions
    const stats = {
      totalWorkouts: req.user.totalWorkouts,
      membershipType: req.user.membershipType,
      membershipExpiry: req.user.membershipExpiry,
      joinedDate: req.user.joinedDate,
      bmi: req.user.bmi,
      age: req.user.age,
      // Thêm các thống kê khác
      weeklyWorkouts: 0, // TODO: Tính từ database
      monthlyWorkouts: 0, // TODO: Tính từ database
      totalCaloriesBurned: 0, // TODO: Tính từ workout sessions
      favoriteExerciseCategory: null // TODO: Tính từ workout history
    };
    
    res.json({
      stats
    });
    
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Lỗi server khi lấy thống kê'
    });
  }
});

// @route   POST /api/users/upgrade-premium
// @desc    Nâng cấp lên Premium (tạm thời, sau này sẽ tích hợp payment)
// @access  Private
router.post('/upgrade-premium', authenticate, [
  body('months')
    .isInt({ min: 1, max: 12 })
    .withMessage('Số tháng phải từ 1-12'),
], async (req, res) => {
  try {
    const { months = 1 } = req.body;
    
    // TODO: Tích hợp payment gateway
    // Hiện tại chỉ demo
    
    const currentExpiry = req.user.membershipExpiry || new Date();
    const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()));
    newExpiry.setMonth(newExpiry.getMonth() + months);
    
    req.user.membershipType = 'premium';
    req.user.membershipExpiry = newExpiry;
    await req.user.save();
    
    res.json({
      message: `Nâng cấp Premium thành công cho ${months} tháng`,
      membershipType: req.user.membershipType,
      membershipExpiry: req.user.membershipExpiry
    });
    
  } catch (error) {
    console.error('Upgrade premium error:', error);
    res.status(500).json({
      error: 'Lỗi server khi nâng cấp Premium'
    });
  }
});

// ADMIN ROUTES

// @route   GET /api/users
// @desc    Lấy danh sách users (Admin only)
// @access  Private/Admin
router.get('/', authenticate, authorize('admin'), validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { role, membershipType, isActive, search } = req.query;
    
    // Build filter
    const filter = {};
    if (role) filter.role = role;
    if (membershipType) filter.membershipType = membershipType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(filter)
      .select('-password -refreshTokens -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(filter);
    
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
    res.status(500).json({
      error: 'Lỗi server khi lấy danh sách users'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Lấy thông tin user theo ID (Admin only)
// @access  Private/Admin
router.get('/:id', authenticate, authorize('admin'), validateObjectId(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshTokens -resetPasswordToken -resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({
        error: 'Không tìm thấy user'
      });
    }
    
    res.json({
      user: user.toJSON()
    });
    
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      error: 'Lỗi server khi lấy thông tin user'
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Cập nhật thông tin user (Admin only)
// @access  Private/Admin
router.put('/:id', authenticate, authorize('admin'), validateObjectId(), async (req, res) => {
  try {
    const allowedUpdates = [
      'fullName', 'email', 'phone', 'role', 'membershipType', 
      'membershipExpiry', 'isActive', 'isEmailVerified'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    // Validate email uniqueness if updating
    if (updates.email) {
      const existingUser = await User.findOne({ 
        email: updates.email.toLowerCase(),
        _id: { $ne: req.params.id }
      });
      
      if (existingUser) {
        return res.status(400).json({
          error: 'Email đã được sử dụng'
        });
      }
      
      updates.email = updates.email.toLowerCase();
    }
    
    // Validate phone uniqueness if updating
    if (updates.phone) {
      const existingUser = await User.findOne({ 
        phone: updates.phone,
        _id: { $ne: req.params.id }
      });
      
      if (existingUser) {
        return res.status(400).json({
          error: 'Số điện thoại đã được sử dụng'
        });
      }
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password -refreshTokens -resetPasswordToken -resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({
        error: 'Không tìm thấy user'
      });
    }
    
    res.json({
      message: 'Cập nhật user thành công',
      user: user.toJSON()
    });
    
  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        error: `${field === 'email' ? 'Email' : 'Số điện thoại'} đã được sử dụng`
      });
    }
    
    res.status(500).json({
      error: 'Lỗi server khi cập nhật user'
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Xóa user (Admin only)
// @access  Private/Admin
router.delete('/:id', authenticate, authorize('admin'), validateObjectId(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'Không tìm thấy user'
      });
    }
    
    // Không cho phép xóa admin cuối cùng
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({
          error: 'Không thể xóa admin cuối cùng'
        });
      }
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    res.json({
      message: 'Xóa user thành công'
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Lỗi server khi xóa user'
    });
  }
});

// @route   GET /api/users/dashboard/stats
// @desc    Lấy thống kê tổng quan (Admin only)
// @access  Private/Admin
router.get('/dashboard/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const premiumUsers = await User.countDocuments({ membershipType: 'premium' });
    const trainers = await User.countDocuments({ role: 'trainer' });
    
    // Users registered in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newUsers = await User.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo } 
    });
    
    // Users by membership type
    const membershipStats = await User.aggregate([
      {
        $group: {
          _id: '$membershipType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Users by role
    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      totalUsers,
      activeUsers,
      premiumUsers,
      trainers,
      newUsers,
      membershipStats: membershipStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      roleStats: roleStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
    
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      error: 'Lỗi server khi lấy thống kê dashboard'
    });
  }
});

// @route   GET /api/users/subscription
// @desc    Lấy thông tin subscription của user hiện tại
// @access  Private
router.get('/subscription', authenticate, async (req, res) => {
  try {
    const { Subscription } = require('../models/Payment');
    
    // Tìm subscription active của user
    const subscription = await Subscription.findOne({
      user: req.user._id,
      status: 'active'
    }).populate('subscriptionPlan');
    
    if (!subscription) {
      return res.json({
        subscription: null,
        subscriptionPlan: null
      });
    }
    
    res.json({
      subscription: {
        _id: subscription._id,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        status: subscription.status,
        autoRenew: subscription.autoRenew
      },
      subscriptionPlan: subscription.subscriptionPlan ? {
        _id: subscription.subscriptionPlan._id,
        name: subscription.subscriptionPlan.name,
        description: subscription.subscriptionPlan.description,
        price: subscription.subscriptionPlan.price,
        duration: subscription.subscriptionPlan.duration
      } : null
    });
    
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      error: 'Lỗi server khi lấy thông tin subscription'
    });
  }
});

module.exports = router;
