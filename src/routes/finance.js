const express = require('express');
const ExpenseCategory = require('../models/ExpenseCategory');
const Expense = require('../models/Expense');
const router = express.Router();

router.get('/expense-categories', async (req, res) => {
  try {
    const categories = await ExpenseCategory.find().sort({ name: 1 });
    res.json(categories.map(category => ({ id: category._id.toString(), name: category.name })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/expense-categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });

  try {
    const category = await ExpenseCategory.create({ name });
    res.json({ success: true, id: category._id.toString(), name: category.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/expenses', async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ dueDate: -1 });
    res.json(expenses.map(expense => ({
      id: expense._id.toString(),
      description: expense.description,
      categoryName: expense.category || '',
      amount: Number(expense.amount || 0),
      dueDate: expense.dueDate,
      paymentDate: expense.paidDate || null,
      status: expense.status,
      paymentMethod: expense.paymentMethod,
      type: expense.type,
      recurrence: expense.recurrence,
      notes: expense.notes,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/expenses', async (req, res) => {
  const { description, categoryId, amount, dueDate, paymentDate, status, paymentMethod, type, recurrence, notes } = req.body;

  if (!description || !amount || !dueDate) {
    return res.status(400).json({ error: 'Descrição, valor e data de vencimento são obrigatórios.' });
  }

  try {
    let categoryName = '';
    if (categoryId) {
      const category = await ExpenseCategory.findById(categoryId);
      if (category) categoryName = category.name;
    }

    const expense = await Expense.create({
      description,
      category: categoryName,
      amount: Number(amount),
      dueDate,
      paidDate: paymentDate || null,
      status: status || 'Pendente',
      paymentMethod: paymentMethod || '',
      type: type || 'Variável',
      recurrence: recurrence || 'Única',
      notes: notes || ''
    });

    res.json({ success: true, id: expense._id.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/expenses/:id', async (req, res) => {
  const { id } = req.params;
  const { description, categoryId, amount, dueDate, paymentDate, status, paymentMethod, type, recurrence, notes } = req.body;

  try {
    let categoryName = '';
    if (categoryId) {
      const category = await ExpenseCategory.findById(categoryId);
      if (category) categoryName = category.name;
    }

    const expense = await Expense.findByIdAndUpdate(id, {
      description,
      category: categoryName,
      amount: Number(amount),
      dueDate,
      paidDate: paymentDate || null,
      status,
      paymentMethod: paymentMethod || '',
      type,
      recurrence,
      notes: notes || '',
      updatedAt: new Date()
    }, { new: true });

    if (!expense) return res.status(404).json({ error: 'Despesa não encontrada' });
    res.json({ success: true, changes: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/expenses/:id', async (req, res) => {
  try {
    const result = await Expense.deleteOne({ _id: req.params.id });
    res.json({ success: true, changes: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/expenses/:id/pay', async (req, res) => {
  const { id } = req.params;
  const paymentDate = new Date().toISOString().split('T')[0];

  try {
    const expense = await Expense.findByIdAndUpdate(id, { status: 'Pago', paidDate: paymentDate, updatedAt: new Date() }, { new: true });
    if (!expense) return res.status(404).json({ error: 'Despesa não encontrada' });
    res.json({ success: true, changes: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
