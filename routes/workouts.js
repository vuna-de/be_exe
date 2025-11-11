const express = require('express');
const { WorkoutPlan, WorkoutSession } = require('../models/Workout');
const Exercise = require('../models/Exercise');
const { authenticate, authorize, requirePremium } = require('../middleware/auth');
const { validateCreateWorkoutPlan, validateObjectId, validatePagination } = require('../utils/validation');
const { createNotification } = require('../services/notificationService');
const { checkOwnership } = require('../middleware/auth');

const router = express.Router();

// WORKOUT PLANS

// @route   GET /api/workouts/plans
// @desc    Lấy danh sách kế hoạch tập luyện
// @access  Private
router.get('/plans', authenticate, validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { category, difficulty, isTemplate } = req.query;
    
    // Build filter
    const filter = { isActive: true };
    
    // User chỉ xem được kế hoạch của mình hoặc templates public
    if (req.user.role !== 'admin') {
      filter.$or = [
        { user: req.user._id },
        { isTemplate: true, isPublic: true }
      ];
    }
    
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (isTemplate !== undefined) filter.isTemplate = isTemplate === 'true';
    
    const workoutPlans = await WorkoutPlan.find(filter)
      .populate('user', 'fullName')
      .populate('trainer', 'fullName')
      .populate('exercises.exercise', 'name category difficulty estimatedDuration')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await WorkoutPlan.countDocuments(filter);
    
    res.json({
      workoutPlans,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
    
  } catch (error) {
    console.error('Get workout plans error:', error);
    res.status(500).json({
      error: 'Lỗi server khi lấy danh sách kế hoạch tập luyện'
    });
  }
});

// @route   GET /api/workouts/plans/:id
// @desc    Lấy chi tiết kế hoạch tập luyện
// @access  Private
router.get('/plans/:id', authenticate, validateObjectId(), async (req, res) => {
  try {
    const workoutPlan = await WorkoutPlan.findById(req.params.id)
      .populate('user', 'fullName')
      .populate('trainer', 'fullName')
      .populate('exercises.exercise');
    
    if (!workoutPlan) {
      return res.status(404).json({
        error: 'Không tìm thấy kế hoạch tập luyện'
      });
    }
    
    // Kiểm tra quyền truy cập
    if (req.user.role !== 'admin' && 
        workoutPlan.user.toString() !== req.user._id.toString() &&
        !(workoutPlan.isTemplate && workoutPlan.isPublic)) {
      return res.status(403).json({
        error: 'Bạn không có quyền xem kế hoạch này'
      });
    }
    
    res.json({
      workoutPlan
    });
    
  } catch (error) {
    console.error('Get workout plan by ID error:', error);
    res.status(500).json({
      error: 'Lỗi server khi lấy chi tiết kế hoạch tập luyện'
    });
  }
});

// @route   POST /api/workouts/plans
// @desc    Tạo kế hoạch tập luyện mới
// @access  Private
router.post('/plans', authenticate, validateCreateWorkoutPlan, async (req, res) => {
  try {
    const workoutPlanData = {
      ...req.body,
      user: req.user._id
    };
    
    // Nếu là trainer tạo cho user khác
    if (req.body.userId && req.user.role === 'trainer') {
      workoutPlanData.user = req.body.userId;
      workoutPlanData.trainer = req.user._id;
    }
    
    // Kiểm tra tất cả exercises có tồn tại
    const exerciseIds = req.body.exercises.map(ex => ex.exercise);
    const exercises = await Exercise.find({ 
      _id: { $in: exerciseIds }, 
      isActive: true 
    });
    
    if (exercises.length !== exerciseIds.length) {
      return res.status(400).json({
        error: 'Một số bài tập không tồn tại hoặc đã bị vô hiệu hóa'
      });
    }
    
    // Tính total calories
    let totalCalories = 0;
    workoutPlanData.exercises.forEach((planExercise, index) => {
      const exercise = exercises.find(ex => ex._id.toString() === planExercise.exercise.toString());
      if (exercise && exercise.caloriesPerMinute) {
        const duration = planExercise.plannedDuration || exercise.estimatedDuration || 0;
        totalCalories += exercise.caloriesPerMinute * (duration / 60);
      }
    });
    
    workoutPlanData.totalCalories = Math.round(totalCalories);
    
    const workoutPlan = new WorkoutPlan(workoutPlanData);
    await workoutPlan.save();
    
    await workoutPlan.populate('user', 'fullName');
    await workoutPlan.populate('trainer', 'fullName');
    await workoutPlan.populate('exercises.exercise');
    
    res.status(201).json({
      message: 'Tạo kế hoạch tập luyện thành công',
      workoutPlan
    });
    try {
      await createNotification({
        user: workoutPlan.user,
        type: 'workout',
        title: 'Đã tạo kế hoạch tập',
        message: `Kế hoạch "${workoutPlan.name}" đã được tạo.`,
        data: { workoutPlanId: workoutPlan._id }
      });
    } catch {}
    
  } catch (error) {
    console.error('Create workout plan error:', error);
    res.status(500).json({
      error: 'Lỗi server khi tạo kế hoạch tập luyện'
    });
  }
});

// @route   PUT /api/workouts/plans/:id
// @desc    Cập nhật kế hoạch tập luyện (chỉ chủ sở hữu hoặc admin)
// @access  Private
router.put('/plans/:id', authenticate, validateObjectId(), async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });
    if (req.user.role !== 'admin' && plan.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Không có quyền chỉnh sửa kế hoạch này' });
    }
    const allowed = ['name','description','category','difficulty','estimatedDuration','frequency','exercises','tags','isActive'];
    allowed.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        plan[k] = req.body[k];
      }
    });
    await plan.save();
    await plan.populate('exercises.exercise');
    return res.json({ message: 'Cập nhật kế hoạch thành công', workoutPlan: plan });
  } catch (e) {
    return res.status(500).json({ error: 'Lỗi server khi cập nhật kế hoạch' });
  }
});

// @route   DELETE /api/workouts/plans/:id
// @desc    Xóa kế hoạch (chỉ chủ sở hữu hoặc admin)
// @access  Private
router.delete('/plans/:id', authenticate, validateObjectId(), async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });
    if (req.user.role !== 'admin' && plan.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Không có quyền xóa kế hoạch này' });
    }
    await plan.deleteOne();
    return res.json({ message: 'Đã xóa kế hoạch' });
  } catch (e) {
    return res.status(500).json({ error: 'Lỗi server khi xóa kế hoạch' });
  }
});

// @route   POST /api/workouts/plans/:id/copy
// @desc    Sao chép kế hoạch tập luyện
// @access  Private
router.post('/plans/:id/copy', authenticate, validateObjectId(), async (req, res) => {
  try {
    const originalPlan = await WorkoutPlan.findById(req.params.id);
    
    if (!originalPlan) {
      return res.status(404).json({
        error: 'Không tìm thấy kế hoạch tập luyện'
      });
    }
    
    // Kiểm tra quyền truy cập template
    if (!originalPlan.isTemplate || !originalPlan.isPublic) {
      if (req.user.role !== 'admin' && 
          originalPlan.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          error: 'Bạn không có quyền sao chép kế hoạch này'
        });
      }
    }
    
    const newPlanData = {
      name: `${originalPlan.name} (Copy)`,
      description: originalPlan.description,
      user: req.user._id,
      category: originalPlan.category,
      difficulty: originalPlan.difficulty,
      estimatedDuration: originalPlan.estimatedDuration,
      exercises: originalPlan.exercises,
      tags: originalPlan.tags,
      totalCalories: originalPlan.totalCalories,
      isTemplate: false,
      isPublic: false
    };
    
    const newPlan = new WorkoutPlan(newPlanData);
    await newPlan.save();
    
    await newPlan.populate('user', 'fullName');
    await newPlan.populate('exercises.exercise');
    
    res.status(201).json({
      message: 'Sao chép kế hoạch tập luyện thành công',
      workoutPlan: newPlan
    });
    
  } catch (error) {
    console.error('Copy workout plan error:', error);
    res.status(500).json({
      error: 'Lỗi server khi sao chép kế hoạch tập luyện'
    });
  }
});

// WORKOUT SESSIONS

// @route   GET /api/workouts/sessions
// @desc    Lấy danh sách phiên tập luyện
// @access  Private
router.get('/sessions', authenticate, validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { status, startDate, endDate } = req.query;
    
    // Build filter
    const filter = { user: req.user._id };
    
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }
    
    const sessions = await WorkoutSession.find(filter)
      .populate('workoutPlan', 'name category')
      .populate('exercises.exercise', 'name category')
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await WorkoutSession.countDocuments(filter);
    
    res.json({
      sessions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
    
  } catch (error) {
    console.error('Get workout sessions error:', error);
    res.status(500).json({
      error: 'Lỗi server khi lấy danh sách phiên tập luyện'
    });
  }
});

// @route   POST /api/workouts/sessions
// @desc    Bắt đầu phiên tập luyện mới
// @access  Private
router.post('/sessions', authenticate, async (req, res) => {
  try {
    const { workoutPlanId, name } = req.body;
    
    let sessionData = {
      user: req.user._id,
      name: name || 'Phiên tập luyện',
      startTime: new Date()
    };
    
    if (workoutPlanId) {
      const workoutPlan = await WorkoutPlan.findById(workoutPlanId)
        .populate('exercises.exercise');
      
      if (!workoutPlan) {
        return res.status(404).json({
          error: 'Không tìm thấy kế hoạch tập luyện'
        });
      }
      
      // Kiểm tra quyền truy cập
      if (req.user.role !== 'admin' && 
          workoutPlan.user.toString() !== req.user._id.toString() &&
          !(workoutPlan.isTemplate && workoutPlan.isPublic)) {
        return res.status(403).json({
          error: 'Bạn không có quyền sử dụng kế hoạch này'
        });
      }
      
      sessionData.workoutPlan = workoutPlanId;
      sessionData.name = workoutPlan.name;
      
      // Copy exercises từ workout plan (bỏ qua bài tập bị xóa)
      sessionData.exercises = workoutPlan.exercises
        .filter(ex => ex && ex.exercise)
        .map(ex => ({
        exercise: ex.exercise._id || ex.exercise,
        plannedSets: ex.plannedSets,
        plannedReps: ex.plannedReps,
        plannedWeight: ex.plannedWeight,
        plannedDuration: ex.plannedDuration,
        plannedDistance: ex.plannedDistance,
        notes: ex.notes,
        order: typeof ex.order === 'number' ? ex.order : 1,
        sets: []
      }));
    } else {
      sessionData.exercises = [];
    }
    
    const session = new WorkoutSession(sessionData);
    await session.save();
    
    await session.populate('workoutPlan', 'name category');
    await session.populate('exercises.exercise', 'name category');
    
    res.status(201).json({
      message: 'Bắt đầu phiên tập luyện thành công',
      session
    });
    
  } catch (error) {
    const logger = require('../services/logger');
    logger.error('Create workout session error', { message: error?.message, stack: error?.stack });
    res.status(500).json({
      error: 'Lỗi server khi bắt đầu phiên tập luyện'
    });
  }
});

// @route   PUT /api/workouts/sessions/:id
// @desc    Cập nhật phiên tập luyện
// @access  Private
router.put('/sessions/:id', authenticate, validateObjectId(), async (req, res) => {
  try {
    const session = await WorkoutSession.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!session) {
      return res.status(404).json({
        error: 'Không tìm thấy phiên tập luyện'
      });
    }
    
    if (session.status === 'completed') {
      return res.status(400).json({
        error: 'Không thể sửa phiên tập đã hoàn thành'
      });
    }
    
    const allowedUpdates = [
      'exercises', 'mood', 'energyLevel', 'difficultyRating', 'notes'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    Object.assign(session, updates);
    await session.save();
    
    await session.populate('workoutPlan', 'name category');
    await session.populate('exercises.exercise', 'name category');
    
    res.json({
      message: 'Cập nhật phiên tập luyện thành công',
      session
    });
    
  } catch (error) {
    console.error('Update workout session error:', error);
    res.status(500).json({
      error: 'Lỗi server khi cập nhật phiên tập luyện'
    });
  }
});

// @route   POST /api/workouts/sessions/:id/complete
// @desc    Hoàn thành phiên tập luyện
// @access  Private
router.post('/sessions/:id/complete', authenticate, validateObjectId(), async (req, res) => {
  try {
    const session = await WorkoutSession.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('exercises.exercise');
    
    if (!session) {
      return res.status(404).json({
        error: 'Không tìm thấy phiên tập luyện'
      });
    }
    
    if (session.status === 'completed') {
      return res.status(400).json({
        error: 'Phiên tập đã được hoàn thành'
      });
    }
    
    await session.complete();
    
    // Cập nhật thống kê user
    req.user.totalWorkouts += 1;
    await req.user.save();

  // Cập nhật thống kê cho kế hoạch (tăng completedCount, cộng dồn thời gian)
  if (session.workoutPlan) {
    try {
      const plan = await WorkoutPlan.findById(session.workoutPlan);
      if (plan) {
        plan.completedCount = (plan.completedCount || 0) + 1;
        plan.totalCompletedDuration = (plan.totalCompletedDuration || 0) + (session.totalDuration || 0);
        plan.totalCompletedCalories = (plan.totalCompletedCalories || 0) + (session.totalCaloriesBurned || 0);
        await plan.save();
      }
    } catch (e) {}
  }
    
    res.json({
      message: 'Hoàn thành phiên tập luyện thành công',
      session
    });
    try {
      await createNotification({
        user: req.user._id,
        type: 'success',
        title: 'Chúc mừng hoàn thành buổi tập!',
        message: `Bạn vừa hoàn thành "${session.name}".`,
        data: { sessionId: session._id }
      });
    } catch {}
    
  } catch (error) {
    console.error('Complete workout session error:', error);
    res.status(500).json({
      error: 'Lỗi server khi hoàn thành phiên tập luyện'
    });
  }
});

// Hủy phiên tập luyện
router.post('/sessions/:id/cancel', authenticate, validateObjectId(), async (req, res) => {
  try {
    const session = await WorkoutSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) {
      return res.status(404).json({ error: 'Không tìm thấy phiên tập luyện' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Phiên đã hoàn thành, không thể hủy' });
    }
    session.status = 'cancelled';
    session.endTime = new Date();
    await session.save();
    return res.json({ message: 'Đã hủy phiên tập', session });
  } catch (error) {
    const logger = require('../services/logger');
    logger.error('Cancel workout session error', { message: error?.message, stack: error?.stack });
    return res.status(500).json({ error: 'Lỗi server khi hủy phiên tập' });
  }
});

// @route   POST /api/workouts/plans/generate
// @desc    Tự động tạo kế hoạch tập luyện dựa trên mục tiêu
// @access  Private
router.post('/plans/generate', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { 
      goal, // 'weight_loss', 'muscle_gain', 'strength', 'endurance', 'general'
      difficulty, // 'beginner', 'intermediate', 'advanced'
      duration, // thời gian tập (phút)
      frequency, // 'daily', 'every_other_day', 'weekly'
      equipment = [] // thiết bị có sẵn
    } = req.body;

    // Validate input
    const validGoals = ['weight_loss', 'muscle_gain', 'strength', 'endurance', 'general'];
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    
    if (!goal || !validGoals.includes(goal)) {
      return res.status(400).json({
        error: 'Mục tiêu không hợp lệ. Chọn: weight_loss, muscle_gain, strength, endurance, general'
      });
    }

    if (!difficulty || !validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: 'Độ khó không hợp lệ. Chọn: beginner, intermediate, advanced'
      });
    }

    const targetDuration = duration || 45; // mặc định 45 phút

    // Lọc bài tập phù hợp
    let exerciseFilter = {
      isActive: true,
      isPublic: true,
      difficulty: difficulty
    };

    // Lọc theo thiết bị
    if (equipment.length > 0) {
      exerciseFilter.equipment = { $in: [...equipment, 'none'] };
    }

    // Lọc theo mục tiêu
    let categoryFilter = {};
    switch (goal) {
      case 'weight_loss':
        categoryFilter = {
          $or: [
            { category: 'cardio' },
            { category: 'full_body' },
            { type: 'cardio' }
          ]
        };
        break;
      case 'muscle_gain':
        categoryFilter = {
          $or: [
            { category: { $in: ['chest', 'back', 'shoulders', 'arms', 'legs'] } },
            { type: 'strength' }
          ]
        };
        break;
      case 'strength':
        categoryFilter = {
          type: 'strength'
        };
        break;
      case 'endurance':
        categoryFilter = {
          $or: [
            { category: 'cardio' },
            { type: 'cardio' }
          ]
        };
        break;
      default:
        categoryFilter = {}; // general - lấy tất cả
    }

    const exercises = await Exercise.find({
      ...exerciseFilter,
      ...categoryFilter
    }).sort({ averageRating: -1, viewCount: -1 });

    if (exercises.length === 0) {
      return res.status(400).json({
        error: 'Không tìm thấy bài tập phù hợp với yêu cầu'
      });
    }

    // Tạo kế hoạch tập luyện thông minh
    let selectedExercises = [];
    let totalDuration = 0;
    let totalCalories = 0;

    // Phân bổ bài tập theo nhóm cơ (đảm bảo cân bằng)
    const muscleGroups = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
    const exercisesByMuscle = {};
    
    // Nhóm bài tập theo nhóm cơ
    exercises.forEach(exercise => {
      exercise.primaryMuscles.forEach(muscle => {
        const group = muscleGroups.find(g => muscle.includes(g)) || 'other';
        if (!exercisesByMuscle[group]) {
          exercisesByMuscle[group] = [];
        }
        exercisesByMuscle[group].push(exercise);
      });
    });

    // Chọn bài tập từ mỗi nhóm cơ
    const targetExerciseCount = Math.min(
      difficulty === 'beginner' ? 6 : difficulty === 'intermediate' ? 8 : 10,
      Math.floor(targetDuration / 5) // tối đa 1 bài tập/5 phút
    );

    let exerciseIndex = 1;
    const usedExercises = new Set();

    // Ưu tiên các nhóm cơ chính
    const priorityGroups = goal === 'weight_loss' 
      ? ['cardio', 'full_body', 'legs', 'core']
      : goal === 'muscle_gain'
      ? ['chest', 'back', 'legs', 'shoulders', 'arms']
      : muscleGroups;

    for (const group of priorityGroups) {
      if (selectedExercises.length >= targetExerciseCount) break;
      
      const groupExercises = exercisesByMuscle[group] || [];
      const availableExercises = groupExercises.filter(ex => !usedExercises.has(ex._id.toString()));
      
      if (availableExercises.length > 0) {
        const exercise = availableExercises[0];
        usedExercises.add(exercise._id.toString());
        
        // Tính toán sets/reps dựa trên mục tiêu
        let plannedSets, plannedReps, plannedDuration;
        
        if (exercise.type === 'cardio') {
          plannedSets = 1;
          plannedReps = null;
          plannedDuration = Math.min(exercise.estimatedDuration || 10, 15) * 60; // giây
        } else {
          plannedSets = exercise.defaultSets || (difficulty === 'beginner' ? 2 : difficulty === 'intermediate' ? 3 : 4);
          plannedReps = {
            min: exercise.defaultReps?.min || (goal === 'strength' ? 6 : goal === 'muscle_gain' ? 8 : 10),
            max: exercise.defaultReps?.max || (goal === 'strength' ? 8 : goal === 'muscle_gain' ? 12 : 15)
          };
          plannedDuration = null;
        }

        selectedExercises.push({
          exercise: exercise._id,
          plannedSets,
          plannedReps,
          plannedWeight: null, // để user tự điều chỉnh
          plannedDuration,
          restTime: goal === 'strength' ? 120 : goal === 'muscle_gain' ? 90 : 60,
          order: exerciseIndex++,
          notes: `Bài tập ${exercise.name} cho ${exercise.primaryMuscles.join(', ')}`
        });

        // Tính toán thời gian và calories
        const exerciseDuration = plannedDuration 
          ? plannedDuration / 60 
          : (plannedSets * 2) + (plannedSets - 1) * (plannedSets > 1 ? 1.5 : 0); // ước tính

        totalDuration += exerciseDuration;
        
        if (exercise.caloriesPerMinute) {
          totalCalories += exercise.caloriesPerMinute * exerciseDuration;
        }
      }
    }

    // Nếu vẫn chưa đủ bài tập, thêm từ các bài tập còn lại
    if (selectedExercises.length < targetExerciseCount) {
      const remainingExercises = exercises.filter(ex => !usedExercises.has(ex._id.toString()));
      
      for (const exercise of remainingExercises.slice(0, targetExerciseCount - selectedExercises.length)) {
        let plannedSets, plannedReps, plannedDuration;
        
        if (exercise.type === 'cardio') {
          plannedSets = 1;
          plannedReps = null;
          plannedDuration = Math.min(exercise.estimatedDuration || 10, 15) * 60;
        } else {
          plannedSets = exercise.defaultSets || 3;
          plannedReps = {
            min: exercise.defaultReps?.min || 8,
            max: exercise.defaultReps?.max || 12
          };
          plannedDuration = null;
        }

        selectedExercises.push({
          exercise: exercise._id,
          plannedSets,
          plannedReps,
          plannedWeight: null,
          plannedDuration,
          restTime: 60,
          order: exerciseIndex++,
          notes: `Bài tập bổ sung: ${exercise.name}`
        });
      }
    }

    // Tạo tên kế hoạch thông minh
    const goalNames = {
      weight_loss: 'Giảm cân',
      muscle_gain: 'Tăng cơ', 
      strength: 'Tăng sức mạnh',
      endurance: 'Tăng sức bền',
      general: 'Tổng quát'
    };

    const difficultyNames = {
      beginner: 'Người mới',
      intermediate: 'Trung cấp', 
      advanced: 'Nâng cao'
    };

    const planName = `${goalNames[goal]} - ${difficultyNames[difficulty]} (${targetDuration}p)`;
    const planDescription = `Kế hoạch tập luyện ${goalNames[goal].toLowerCase()} được tạo tự động cho ${difficultyNames[difficulty].toLowerCase()}, thời gian ${targetDuration} phút.`;

    // Tạo WorkoutPlan
    const workoutPlan = new WorkoutPlan({
      name: planName,
      description: planDescription,
      user: user._id,
      category: goal === 'weight_loss' ? 'weight_loss' : goal === 'muscle_gain' ? 'muscle_gain' : goal,
      difficulty,
      estimatedDuration: Math.round(totalDuration),
      frequency,
      exercises: selectedExercises,
      totalCalories: Math.round(totalCalories),
      isTemplate: false,
      isPublic: false,
      tags: [goal, difficulty, 'auto_generated']
    });

    await workoutPlan.save();
    await workoutPlan.populate('exercises.exercise');

    res.status(201).json({
      message: 'Tạo kế hoạch tập luyện tự động thành công',
      workoutPlan,
      recommendations: {
        totalExercises: selectedExercises.length,
        estimatedDuration: Math.round(totalDuration),
        estimatedCalories: Math.round(totalCalories),
        muscleGroupsCovered: Object.keys(exercisesByMuscle).filter(group => 
          selectedExercises.some(ex => 
            exercises.find(e => e._id.toString() === ex.exercise.toString())
              ?.primaryMuscles.some(muscle => muscle.includes(group))
          )
        )
      }
    });

  } catch (error) {
    console.error('Generate workout plan error:', error);
    res.status(500).json({
      error: 'Lỗi server khi tạo kế hoạch tập luyện tự động'
    });
  }
});

// @route   GET /api/workouts/stats
// @desc    Lấy thống kê tập luyện
// @access  Private
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate;
    const endDate = new Date();
    
    switch (period) {
      case 'week':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const stats = await WorkoutSession.aggregate([
      {
        $match: {
          user: req.user._id,
          status: 'completed',
          startTime: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalDuration: { $sum: '$totalDuration' },
          totalCalories: { $sum: '$totalCaloriesBurned' },
          avgCompletionRate: { $avg: '$completionRate' },
          avgDuration: { $avg: '$totalDuration' }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalSessions: 0,
      totalDuration: 0,
      totalCalories: 0,
      avgCompletionRate: 0,
      avgDuration: 0
    };

    // Tính streak (current và best) trong vòng 1 năm
    const streakStart = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
    const sessionsYear = await WorkoutSession.find({
      user: req.user._id,
      status: 'completed',
      startTime: { $gte: streakStart, $lte: endDate }
    }).select('startTime').lean();

    const daysSet = new Set((sessionsYear || []).map(s => new Date(s.startTime).toDateString()));
    // Best streak
    const sortedDays = Array.from(daysSet)
      .map(d => new Date(d))
      .sort((a,b) => a.getTime() - b.getTime());
    let best = 0, cur = 0;
    let prev = null;
    for (const d of sortedDays) {
      if (prev) {
        const diff = Math.round((d.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
        if (diff === 1) {
          cur += 1;
        } else if (diff === 0) {
          // same day already accounted
        } else {
          best = Math.max(best, cur);
          cur = 1;
        }
      } else {
        cur = 1;
      }
      prev = d;
    }
    best = Math.max(best, cur);

    // Current streak (tính ngược từ hôm nay)
    let current = 0;
    for (let i = 0; i < 400; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (daysSet.has(d.toDateString())) current++;
      else break;
    }
    
    res.json({
      period,
      stats: {
        ...result,
        avgCompletionRate: Math.round(result.avgCompletionRate || 0),
        avgDuration: Math.round(result.avgDuration || 0),
        currentStreak: current,
        bestStreak: best
      }
    });
    
  } catch (error) {
    console.error('Get workout stats error:', error);
    res.status(500).json({
      error: 'Lỗi server khi lấy thống kê tập luyện'
    });
  }
});

module.exports = router;
