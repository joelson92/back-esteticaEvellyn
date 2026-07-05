const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, default: '' },
  type: { type: String, default: 'info' },
  read: { type: Boolean, default: false },
  target: { type: String, default: 'all' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('Notification', notificationSchema);
