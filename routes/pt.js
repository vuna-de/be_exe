const express = require('express');
const { authenticate } = require('../middleware/auth');
const { Trainer, PTConnection, PTMessage } = require('../models/PT');
const { createNotification } = require('../services/notificationService');

const router = express.Router();

// Danh sách PT đang hoạt động
router.get('/trainers', authenticate, async (req, res) => {
  try {
    const trainers = await Trainer.find({ isActive: true })
      .populate('user', 'fullName email avatar role')
      .sort({ rating: -1, createdAt: -1 });
    res.json({ trainers });
  } catch (e) {
    console.error('get trainers error', e);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách PT' });
  }
});

// Yêu cầu kết nối PT
router.post('/connect', authenticate, async (req, res) => {
  try {
    const { trainerId } = req.body;
    if (!trainerId) return res.status(400).json({ error: 'Thiếu trainerId' });
    const existing = await PTConnection.findOne({ user: req.user._id, trainer: trainerId, status: { $in: ['pending','active'] } });
    if (existing) return res.status(400).json({ error: 'Bạn đã yêu cầu/kết nối PT này' });
    const conn = new PTConnection({ user: req.user._id, trainer: trainerId, status: 'pending' });
    await conn.save();
    res.status(201).json({ message: 'Đã gửi yêu cầu kết nối PT', connection: conn });
  } catch (e) {
    console.error('connect PT error', e);
    res.status(500).json({ error: 'Lỗi server khi kết nối PT' });
  }
});

// PT chấp nhận kết nối
router.post('/accept/:id', authenticate, async (req, res) => {
  try {
    const conn = await PTConnection.findById(req.params.id).populate('trainer');
    if (!conn) return res.status(404).json({ error: 'Không tìm thấy kết nối' });
    // Cho phép admin hoặc chính PT xác nhận
    if (req.user.role !== 'admin') {
      const trainer = await Trainer.findById(conn.trainer);
      if (!trainer || trainer.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Không có quyền' });
      }
    }
    conn.status = 'active';
    await conn.save();
    res.json({ message: 'Đã chấp nhận kết nối', connection: conn });
  } catch (e) {
    console.error('accept PT error', e);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Huỷ kết nối
router.post('/cancel/:id', authenticate, async (req, res) => {
  try {
    const conn = await PTConnection.findById(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Không tìm thấy kết nối' });
    if (req.user.role !== 'admin' && conn.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Không có quyền' });
    }
    conn.status = 'cancelled';
    await conn.save();
    res.json({ message: 'Đã huỷ kết nối', connection: conn });
  } catch (e) {
    console.error('cancel PT error', e);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Liệt kê các kết nối của user hiện tại
router.get('/connections', authenticate, async (req, res) => {
  try {
    const cons = await PTConnection.find({ user: req.user._id })
      .populate({ path: 'trainer', populate: { path: 'user', select: 'fullName email avatar' } })
      .sort({ createdAt: -1 });
    res.json({ connections: cons });
  } catch (e) {
    console.error('list connections error', e);
    res.status(500).json({ error: 'Lỗi server khi lấy kết nối PT' });
  }
});

// Liệt kê kết nối theo phía Trainer (dùng khi đăng nhập bằng tài khoản PT)
router.get('/trainer/connections', authenticate, async (req, res) => {
  try {
    const trainer = await Trainer.findOne({ user: req.user._id });
    if (!trainer) return res.json({ connections: [] });
    const cons = await PTConnection.find({ trainer: trainer._id })
      .populate({ path: 'user', select: 'fullName email avatar' })
      .sort({ createdAt: -1 });
    res.json({ connections: cons });
  } catch (e) {
    console.error('list trainer connections error', e);
    res.status(500).json({ error: 'Lỗi server khi lấy kết nối PT (trainer)' });
  }
});

// Lấy tin nhắn
router.get('/messages/:connectionId', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const conn = await PTConnection.findById(connectionId);
    if (!conn) return res.status(404).json({ error: 'Không tìm thấy kết nối' });
    let allowed = false;
    if (conn.user.toString() === req.user._id.toString()) allowed = true;
    const trainer = await Trainer.findOne({ user: req.user._id });
    if (trainer && conn.trainer.toString() === trainer._id.toString()) allowed = true;
    if (!allowed && req.user.role !== 'admin') return res.status(403).json({ error: 'Không có quyền' });
    const messages = await PTMessage.find({ connection: connectionId }).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (e) {
    console.error('get messages error', e);
    res.status(500).json({ error: 'Lỗi server khi lấy tin nhắn' });
  }
});

// Gửi tin nhắn
router.post('/messages/:connectionId', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { text, mediaUrl } = req.body;
    const conn = await PTConnection.findById(connectionId);
    if (!conn) return res.status(404).json({ error: 'Không tìm thấy kết nối' });
    let senderType = 'user';
    let allowed = false;
    if (conn.user.toString() === req.user._id.toString()) { allowed = true; senderType = 'user'; }
    const trainer = await Trainer.findOne({ user: req.user._id });
    if (trainer && conn.trainer.toString() === trainer._id.toString()) { allowed = true; senderType = 'trainer'; }
    if (!allowed && req.user.role !== 'admin') return res.status(403).json({ error: 'Không có quyền' });

    const msg = new PTMessage({ connection: connectionId, senderType, text, mediaUrl });
    await msg.save();
  // Thông báo cho đối phương
  try {
    if (senderType === 'user') {
      const connTrainer = await Trainer.findById(conn.trainer).populate('user', '_id');
      if (connTrainer?.user?._id) {
        await createNotification({
          user: connTrainer.user._id,
          type: 'system',
          title: 'Tin nhắn mới từ học viên',
          message: text?.slice(0, 120) || 'Bạn có tin nhắn mới',
          data: { connectionId }
        });
      }
    } else {
      await createNotification({
        user: conn.user,
        type: 'system',
        title: 'Tin nhắn mới từ PT',
        message: text?.slice(0, 120) || 'Bạn có tin nhắn mới',
        data: { connectionId }
      });
    }
  } catch {}
    res.status(201).json({ message: 'Đã gửi', msg });
  } catch (e) {
    console.error('send message error', e);
    res.status(500).json({ error: 'Lỗi server khi gửi tin nhắn' });
  }
});

module.exports = router;


