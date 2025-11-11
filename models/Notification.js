const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['info','success','warning','error','achievement','payment','workout','system'], default: 'info', index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Object },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);


