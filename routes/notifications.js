const express = require('express');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Lấy danh sách thông báo (mới nhất trước)
router.get('/', authenticate, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const skip = Math.max(parseInt(req.query.skip || '0', 10), 0);
    const [items, total, unread] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments({ user: req.user._id }),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);
    res.json({ notifications: items, total, unread });
  } catch (e) {
    console.error('List notifications error:', e);
    res.status(500).json({ error: 'Lỗi server khi lấy thông báo' });
  }
});

// Đánh dấu đã đọc 1 thông báo
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const noti = await Notification.findOne({ _id: id, user: req.user._id });
    if (!noti) return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    if (!noti.isRead) {
      noti.isRead = true;
      noti.readAt = new Date();
      await noti.save();
    }
    res.json({ message: 'Đã đọc', notification: noti });
  } catch (e) {
    console.error('Read notification error:', e);
    res.status(500).json({ error: 'Lỗi server khi đánh dấu đã đọc' });
  }
});

// Đánh dấu đã đọc tất cả
router.post('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    res.json({ message: 'Đã đánh dấu tất cả là đã đọc' });
  } catch (e) {
    console.error('Read all notifications error:', e);
    res.status(500).json({ error: 'Lỗi server khi đánh dấu tất cả đã đọc' });
  }
});

module.exports = router;


