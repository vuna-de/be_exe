const Notification = require('../models/Notification');
let ioRef = null;

function registerNotificationIO(io) {
  ioRef = io;
}

async function createNotification({ user, title, message, type = 'info', data }) {
  try {
    const noti = new Notification({ user, title, message, type, data });
    await noti.save();
    // emit realtime nếu đã cấu hình IO
    try {
      if (ioRef) {
        ioRef.of('/notifications').to(String(user)).emit('notification', noti.toJSON());
      }
    } catch (e) {
      // ignore
    }
    return noti;
  } catch (e) {
    console.warn('Create notification error:', e.message);
    return null;
  }
}

module.exports = {
  createNotification,
  registerNotificationIO,
};


