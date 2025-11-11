const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { PTClient, ClientProgress, ClientPlan, PTStats } = require('../models/PTDashboard');
const { authenticate, requireRole } = require('../middleware/auth');
const { validatePagination } = require('../utils/validation');

const router = express.Router();

// Middleware bảo vệ tất cả routes
router.use(authenticate);

// ==================== PT DASHBOARD OVERVIEW ====================

// Lấy thống kê tổng quan cho PT
router.get('/stats', requireRole('trainer'), async (req, res) => {
  try {
    const ptId = req.user._id;
    
    // Lấy thống kê cơ bản
    const [
      totalClients,
      activeClients,
      totalSessions,
      totalPlansSent,
      recentClients,
      recentPlans
    ] = await Promise.all([
      PTClient.countDocuments({ pt: ptId }),
      PTClient.countDocuments({ pt: ptId, status: 'active', isActive: true }),
      ClientProgress.countDocuments({ 'ptClient.pt': ptId }),
      ClientPlan.countDocuments({ 'ptClient.pt': ptId }),
      PTClient.find({ pt: ptId })
        .populate('client', 'fullName email avatar membershipType')
        .sort({ startDate: -1 })
        .limit(5),
      ClientPlan.find({ 'ptClient.pt': ptId })
        .populate('ptClient', 'client')
        .populate('client', 'fullName email avatar')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    // Lấy thống kê tiến độ khách hàng
    const progressStats = await ClientProgress.aggregate([
      { $match: { 'ptClient.pt': ptId } },
      { $group: {
        _id: null,
        avgWeight: { $avg: '$weight' },
        avgBodyFat: { $avg: '$bodyFat' },
        completedWorkouts: { $sum: { $cond: ['$workoutCompleted', 1, 0] } },
        totalEntries: { $sum: 1 }
      }}
    ]);

    // Lấy thống kê theo tháng
    const monthlyStats = await ClientProgress.aggregate([
      { $match: { 'ptClient.pt': ptId } },
      { $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        sessions: { $sum: 1 },
        completedWorkouts: { $sum: { $cond: ['$workoutCompleted', 1, 0] } }
      }},
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    res.json({
      stats: {
        totalClients,
        activeClients,
        totalSessions,
        totalPlansSent,
        progressStats: progressStats[0] || {
          avgWeight: 0,
          avgBodyFat: 0,
          completedWorkouts: 0,
          totalEntries: 0
        }
      },
      recentClients,
      recentPlans,
      monthlyStats
    });
  } catch (error) {
    console.error('Get PT dashboard stats error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy thống kê dashboard PT' });
  }
});

// ==================== CLIENT MANAGEMENT ====================

// Lấy danh sách khách hàng
router.get('/clients', requireRole('trainer'), validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { status, search, sort = '-startDate' } = req.query;

    const filter = { pt: req.user._id };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { 'client.fullName': { $regex: search, $options: 'i' } },
        { 'client.email': { $regex: search, $options: 'i' } }
      ];
    }

    const clients = await PTClient.find(filter)
      .populate('client', 'fullName email avatar membershipType phone')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await PTClient.countDocuments(filter);

    res.json({
      clients,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get PT clients error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách khách hàng' });
  }
});

// Lấy chi tiết khách hàng
router.get('/clients/:clientId', requireRole('trainer'), async (req, res) => {
  try {
    const ptClient = await PTClient.findOne({
      pt: req.user._id,
      client: req.params.clientId
    }).populate('client', 'fullName email avatar membershipType phone');

    if (!ptClient) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    // Lấy tiến độ gần đây
    const recentProgress = await ClientProgress.find({ ptClient: ptClient._id })
      .sort({ date: -1 })
      .limit(10);

    // Lấy kế hoạch gần đây
    const recentPlans = await ClientPlan.find({ ptClient: ptClient._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Lấy thống kê tiến độ
    const progressStats = await ClientProgress.aggregate([
      { $match: { ptClient: ptClient._id } },
      { $group: {
        _id: null,
        avgWeight: { $avg: '$weight' },
        avgBodyFat: { $avg: '$bodyFat' },
        completedWorkouts: { $sum: { $cond: ['$workoutCompleted', 1, 0] } },
        totalEntries: { $sum: 1 },
        firstEntry: { $min: '$date' },
        lastEntry: { $max: '$date' }
      }}
    ]);

    res.json({
      client: ptClient,
      recentProgress,
      recentPlans,
      progressStats: progressStats[0] || null
    });
  } catch (error) {
    console.error('Get PT client detail error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết khách hàng' });
  }
});

// Cập nhật trạng thái khách hàng
router.put('/clients/:clientId/status', requireRole('trainer'), [
  body('status').isIn(['pending', 'active', 'paused', 'completed', 'cancelled'])
    .withMessage('Trạng thái không hợp lệ'),
  body('notes').optional().isString().withMessage('Ghi chú phải là chuỗi')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ptClient = await PTClient.findOne({
      pt: req.user._id,
      client: req.params.clientId
    });

    if (!ptClient) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    ptClient.status = req.body.status;
    if (req.body.notes) ptClient.notes = req.body.notes;

    await ptClient.save();

    res.json({
      message: 'Cập nhật trạng thái khách hàng thành công',
      client: ptClient
    });
  } catch (error) {
    console.error('Update client status error:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật trạng thái khách hàng' });
  }
});

// ==================== CLIENT PROGRESS ====================

// Lấy tiến độ khách hàng
router.get('/clients/:clientId/progress', requireRole('trainer'), async (req, res) => {
  try {
    const ptClient = await PTClient.findOne({
      pt: req.user._id,
      client: req.params.clientId
    });

    if (!ptClient) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const progress = await ClientProgress.find({ ptClient: ptClient._id })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ClientProgress.countDocuments({ ptClient: ptClient._id });

    res.json({
      progress,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get client progress error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy tiến độ khách hàng' });
  }
});

// Thêm tiến độ khách hàng
router.post('/clients/:clientId/progress', requireRole('trainer'), [
  body('weight').optional().isFloat({ min: 0 }).withMessage('Cân nặng phải lớn hơn 0'),
  body('bodyFat').optional().isFloat({ min: 0, max: 100 }).withMessage('Tỷ lệ mỡ phải từ 0-100'),
  body('muscleMass').optional().isFloat({ min: 0 }).withMessage('Khối lượng cơ phải lớn hơn 0'),
  body('mood').optional().isIn(['excellent', 'good', 'average', 'poor', 'terrible'])
    .withMessage('Tâm trạng không hợp lệ'),
  body('energy').optional().isIn(['high', 'medium', 'low']).withMessage('Năng lượng không hợp lệ'),
  body('sleep').optional().isFloat({ min: 0, max: 24 }).withMessage('Giấc ngủ phải từ 0-24 giờ'),
  body('waterIntake').optional().isFloat({ min: 0 }).withMessage('Lượng nước phải lớn hơn 0'),
  body('workoutCompleted').optional().isBoolean().withMessage('Hoàn thành tập luyện phải là boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ptClient = await PTClient.findOne({
      pt: req.user._id,
      client: req.params.clientId
    });

    if (!ptClient) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    const progress = new ClientProgress({
      ptClient: ptClient._id,
      client: req.params.clientId,
      ...req.body
    });

    await progress.save();

    res.status(201).json({
      message: 'Thêm tiến độ khách hàng thành công',
      progress
    });
  } catch (error) {
    console.error('Add client progress error:', error);
    res.status(500).json({ error: 'Lỗi server khi thêm tiến độ khách hàng' });
  }
});

// ==================== CLIENT PLANS ====================

// Lấy kế hoạch đã gửi cho khách hàng
router.get('/clients/:clientId/plans', requireRole('trainer'), async (req, res) => {
  try {
    const ptClient = await PTClient.findOne({
      pt: req.user._id,
      client: req.params.clientId
    });

    if (!ptClient) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const plans = await ClientPlan.find({ ptClient: ptClient._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ClientPlan.countDocuments({ ptClient: ptClient._id });

    res.json({
      plans,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get client plans error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy kế hoạch khách hàng' });
  }
});

// Gửi kế hoạch cho khách hàng
router.post('/clients/:clientId/plans', requireRole('trainer'), [
  body('type').isIn(['workout', 'nutrition', 'general']).withMessage('Loại kế hoạch không hợp lệ'),
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Tiêu đề phải từ 1-200 ký tự'),
  body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('Mô tả phải từ 1-1000 ký tự'),
  body('content').notEmpty().withMessage('Nội dung kế hoạch là bắt buộc'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Độ ưu tiên không hợp lệ'),
  body('dueDate').optional().isISO8601().withMessage('Ngày hết hạn không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ptClient = await PTClient.findOne({
      pt: req.user._id,
      client: req.params.clientId
    });

    if (!ptClient) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    const plan = new ClientPlan({
      ptClient: ptClient._id,
      client: req.params.clientId,
      ...req.body
    });

    await plan.save();

    // TODO: Gửi notification cho client

    res.status(201).json({
      message: 'Gửi kế hoạch cho khách hàng thành công',
      plan
    });
  } catch (error) {
    console.error('Send client plan error:', error);
    res.status(500).json({ error: 'Lỗi server khi gửi kế hoạch cho khách hàng' });
  }
});

// Cập nhật trạng thái kế hoạch
router.put('/plans/:planId/status', requireRole('trainer'), [
  body('status').isIn(['sent', 'received', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Trạng thái không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const plan = await ClientPlan.findOne({
      _id: req.params.planId,
      'ptClient.pt': req.user._id
    });

    if (!plan) {
      return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });
    }

    plan.status = req.body.status;
    if (req.body.status === 'completed') {
      plan.completedAt = new Date();
    }

    await plan.save();

    res.json({
      message: 'Cập nhật trạng thái kế hoạch thành công',
      plan
    });
  } catch (error) {
    console.error('Update plan status error:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật trạng thái kế hoạch' });
  }
});

// ==================== ANALYTICS ====================

// Lấy biểu đồ tiến độ khách hàng
router.get('/clients/:clientId/analytics', requireRole('trainer'), async (req, res) => {
  try {
    const ptClient = await PTClient.findOne({
      pt: req.user._id,
      client: req.params.clientId
    });

    if (!ptClient) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    const { period = '30d' } = req.query;
    
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const analytics = await ClientProgress.aggregate([
      { $match: { 
        ptClient: ptClient._id,
        date: { $gte: startDate }
      }},
      { $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        },
        avgWeight: { $avg: '$weight' },
        avgBodyFat: { $avg: '$bodyFat' },
        completedWorkouts: { $sum: { $cond: ['$workoutCompleted', 1, 0] } },
        totalEntries: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({ analytics });
  } catch (error) {
    console.error('Get client analytics error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy phân tích khách hàng' });
  }
});

module.exports = router;
