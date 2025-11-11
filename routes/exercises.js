const express = require('express');
const Exercise = require('../models/Exercise');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validateCreateExercise, validateObjectId, validatePagination } = require('../utils/validation');

const router = express.Router();

// @route   GET /api/exercises
// @desc    Lấy danh sách bài tập
// @access  Public
router.get('/', optionalAuth, validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { 
      category, 
      difficulty, 
      type, 
      equipment, 
      muscles, 
      search,
      sort = '-createdAt'
    } = req.query;
    
    // Build filter
    const filter = { isActive: true, isPublic: true };
    
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (type) filter.type = type;
    if (equipment) filter.equipment = { $in: equipment.split(',') };
    if (muscles) {
      const muscleList = muscles.split(',');
      filter.$or = [
        { primaryMuscles: { $in: muscleList } },
        { secondaryMuscles: { $in: muscleList } }
      ];
    }
    
    let query;
    let regex;
    
    if (search) {
      // Hỗ trợ tìm kiếm linh hoạt theo từ khóa (không cần khớp toàn văn bản)
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(escaped, 'i');
      query = Exercise.find({
        ...filter,
        $or: [
          { name: regex },
          { description: regex },
          { tags: regex },
          { primaryMuscles: { $in: [search] } },
          { secondaryMuscles: { $in: [search] } }
        ]
      })
      .populate('createdBy', 'fullName')
      .sort(sort);
    } else {
      query = Exercise.find(filter)
        .populate('createdBy', 'fullName')
        .sort(sort);
    }
    
    const exercises = await query
      .skip(skip)
      .limit(limit);
    
    const total = await Exercise.countDocuments(search ? {
      ...filter,
      $or: [
        { name: regex },
        { description: regex },
        { tags: regex },
        { primaryMuscles: { $in: [search] } },
        { secondaryMuscles: { $in: [search] } }
      ]
    } : filter);
    
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
    res.status(500).json({
      error: 'Lỗi server khi lấy danh sách bài tập'
    });
  }
});

// @route   GET /api/exercises/:id
// @desc    Lấy chi tiết bài tập
// @access  Public
router.get('/:id', optionalAuth, validateObjectId(), async (req, res) => {
  try {
    const exercise = await Exercise.findOne({
      _id: req.params.id,
      isActive: true,
      isPublic: true
    }).populate('createdBy', 'fullName');
    
    if (!exercise) {
      return res.status(404).json({
        error: 'Không tìm thấy bài tập'
      });
    }
    
    // Tăng view count
    await exercise.incrementView();
    
    res.json({
      exercise
    });
    
  } catch (error) {
    console.error('Get exercise by ID error:', error);
    res.status(500).json({
      error: 'Lỗi server khi lấy chi tiết bài tập'
    });
  }
});

// @route   POST /api/exercises
// @desc    Tạo bài tập mới
// @access  Private/Admin,Trainer
router.post('/', authenticate, authorize('admin', 'trainer'), validateCreateExercise, async (req, res) => {
  try {
    const exerciseData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    const exercise = new Exercise(exerciseData);
    await exercise.save();
    
    await exercise.populate('createdBy', 'fullName');
    
    res.status(201).json({
      message: 'Tạo bài tập thành công',
      exercise
    });
    
  } catch (error) {
    console.error('Create exercise error:', error);
    res.status(500).json({
      error: 'Lỗi server khi tạo bài tập'
    });
  }
});

// @route   PUT /api/exercises/:id
// @desc    Cập nhật bài tập
// @access  Private/Admin,Trainer (chỉ người tạo hoặc admin)
router.put('/:id', authenticate, authorize('admin', 'trainer'), validateObjectId(), async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    
    if (!exercise) {
      return res.status(404).json({
        error: 'Không tìm thấy bài tập'
      });
    }
    
    // Kiểm tra quyền sửa (admin hoặc người tạo)
    if (req.user.role !== 'admin' && exercise.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Bạn không có quyền sửa bài tập này'
      });
    }
    
    const allowedUpdates = [
      'name', 'description', 'instructions', 'category', 'primaryMuscles', 
      'secondaryMuscles', 'difficulty', 'type', 'equipment', 'images', 'videos',
      'caloriesPerMinute', 'estimatedDuration', 'defaultSets', 'defaultReps',
      'tags', 'isActive', 'isPublic'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    Object.assign(exercise, updates);
    await exercise.save();
    
    await exercise.populate('createdBy', 'fullName');
    
    res.json({
      message: 'Cập nhật bài tập thành công',
      exercise
    });
    
  } catch (error) {
    console.error('Update exercise error:', error);
    res.status(500).json({
      error: 'Lỗi server khi cập nhật bài tập'
    });
  }
});

// @route   DELETE /api/exercises/:id
// @desc    Xóa bài tập
// @access  Private/Admin,Trainer (chỉ người tạo hoặc admin)
router.delete('/:id', authenticate, authorize('admin', 'trainer'), validateObjectId(), async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    
    if (!exercise) {
      return res.status(404).json({
        error: 'Không tìm thấy bài tập'
      });
    }
    
    // Kiểm tra quyền xóa (admin hoặc người tạo)
    if (req.user.role !== 'admin' && exercise.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Bạn không có quyền xóa bài tập này'
      });
    }
    
    // Soft delete
    exercise.isActive = false;
    await exercise.save();
    
    res.json({
      message: 'Xóa bài tập thành công'
    });
    
  } catch (error) {
    console.error('Delete exercise error:', error);
    res.status(500).json({
      error: 'Lỗi server khi xóa bài tập'
    });
  }
});

// @route   GET /api/exercises/categories/list
// @desc    Lấy danh sách categories và muscles
// @access  Public
router.get('/categories/list', (req, res) => {
  const categories = [
    { value: 'chest', label: 'Ngực' },
    { value: 'back', label: 'Lưng' },
    { value: 'shoulders', label: 'Vai' },
    { value: 'arms', label: 'Cánh tay' },
    { value: 'legs', label: 'Chân' },
    { value: 'core', label: 'Cơ bụng' },
    { value: 'cardio', label: 'Tim mạch' },
    { value: 'flexibility', label: 'Linh hoạt' },
    { value: 'full_body', label: 'Toàn thân' }
  ];
  
  const muscles = [
    { value: 'chest', label: 'Ngực' },
    { value: 'upper_chest', label: 'Ngực trên' },
    { value: 'lower_chest', label: 'Ngực dưới' },
    { value: 'lats', label: 'Cơ xô' },
    { value: 'rhomboids', label: 'Cơ thoi' },
    { value: 'traps', label: 'Cơ thang' },
    { value: 'lower_back', label: 'Lưng dưới' },
    { value: 'front_delts', label: 'Vai trước' },
    { value: 'side_delts', label: 'Vai giữa' },
    { value: 'rear_delts', label: 'Vai sau' },
    { value: 'biceps', label: 'Cơ tay trước' },
    { value: 'triceps', label: 'Cơ tay sau' },
    { value: 'forearms', label: 'Cẳng tay' },
    { value: 'quads', label: 'Cơ tứ đầu' },
    { value: 'hamstrings', label: 'Cơ gân kheo' },
    { value: 'glutes', label: 'Cơ mông' },
    { value: 'calves', label: 'Cơ bắp chân' },
    { value: 'abs', label: 'Cơ bụng' },
    { value: 'obliques', label: 'Cơ bụng chéo' },
    { value: 'lower_abs', label: 'Cơ bụng dưới' }
  ];
  
  const equipment = [
    { value: 'none', label: 'Không cần thiết bị' },
    { value: 'dumbbells', label: 'Tạ đơn' },
    { value: 'barbell', label: 'Tạ đòn' },
    { value: 'kettlebell', label: 'Tạ ấm' },
    { value: 'resistance_band', label: 'Dây kháng lực' },
    { value: 'pull_up_bar', label: 'Xà đơn' },
    { value: 'bench', label: 'Ghế tập' },
    { value: 'cable_machine', label: 'Máy cáp' },
    { value: 'treadmill', label: 'Máy chạy bộ' },
    { value: 'bike', label: 'Xe đạp' },
    { value: 'yoga_mat', label: 'Thảm yoga' },
    { value: 'medicine_ball', label: 'Bóng tập' },
    { value: 'foam_roller', label: 'Con lăn massage' },
    { value: 'other', label: 'Khác' }
  ];
  
  const difficulties = [
    { value: 'beginner', label: 'Người mới bắt đầu' },
    { value: 'intermediate', label: 'Trung cấp' },
    { value: 'advanced', label: 'Nâng cao' }
  ];
  
  const types = [
    { value: 'strength', label: 'Sức mạnh' },
    { value: 'cardio', label: 'Tim mạch' },
    { value: 'flexibility', label: 'Linh hoạt' },
    { value: 'balance', label: 'Thăng bằng' },
    { value: 'plyometric', label: 'Bật nhảy' }
  ];
  
  res.json({
    categories,
    muscles,
    equipment,
    difficulties,
    types
  });
});

// @route   POST /api/exercises/:id/rate
// @desc    Đánh giá bài tập
// @access  Private
router.post('/:id/rate', authenticate, validateObjectId(), async (req, res) => {
  try {
    const { rating } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Đánh giá phải từ 1-5 sao'
      });
    }
    
    const exercise = await Exercise.findById(req.params.id);
    
    if (!exercise) {
      return res.status(404).json({
        error: 'Không tìm thấy bài tập'
      });
    }
    
    // TODO: Lưu rating của user và kiểm tra đã rate chưa
    // Hiện tại chỉ cập nhật rating trung bình
    await exercise.updateRating(rating);
    
    res.json({
      message: 'Đánh giá bài tập thành công',
      averageRating: exercise.averageRating,
      ratingCount: exercise.ratingCount
    });
    
  } catch (error) {
    console.error('Rate exercise error:', error);
    res.status(500).json({
      error: 'Lỗi server khi đánh giá bài tập'
    });
  }
});

module.exports = router;
