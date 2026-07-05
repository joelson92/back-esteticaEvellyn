const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  category: { type: String, default: '' },
  amount: { type: Number, required: true },
  dueDate: { type: String, required: true },
  paidDate: { type: String, default: null },
  status: { type: String, default: 'Pendente' },
  paymentMethod: { type: String, default: '' },
  type: { type: String, default: 'Variável' },
  recurrence: { type: String, default: 'Única' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('Expense', expenseSchema);
