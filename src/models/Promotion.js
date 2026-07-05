const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  serviceId: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('Promotion', promotionSchema);
