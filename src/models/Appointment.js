const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  clientName: { type: String, required: true },
  clientPhone: { type: String, required: true },
  servicesJson: { type: String, default: '' },
  services: { type: Array, default: [] },
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  duration: { type: Number, default: 0 },
  totalValue: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  source: { type: String, default: 'Sistema' },
  status: { type: String, default: 'scheduled' },
  googleEventId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('Appointment', appointmentSchema);
