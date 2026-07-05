const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envCandidates = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '..', '.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    if (process.env.MONGODB_URI) break;
  }
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { connectMongo, getConnectionStatus } = require('../database/mongoDatabase');
const financeRoutes = require('./routes/finance');

const AdminUser = require('./models/AdminUser');
const Service = require('./models/Service');
const Client = require('./models/Client');
const Appointment = require('./models/Appointment');
const Setting = require('./models/Setting');
const Expense = require('./models/Expense');
const ExpenseCategory = require('./models/ExpenseCategory');

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('Vulnerabilidade Crítica: JWT_SECRET não definido no ambiente de produção.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_123';

app.use(helmet());

const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
  const sanitize = (val) => {
    if (typeof val === 'string') {
      return val.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    }
    return val;
  };
  if (req.body) {
    for (const key in req.body) {
      req.body[key] = sanitize(req.body[key]);
    }
  }
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Muitas requisições originadas deste IP, por favor tente novamente mais tarde.' }
});
app.use('/api/', limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' }
});

function mapId(doc) {
  if (!doc) return null;
  const data = doc.toObject ? doc.toObject() : { ...doc };
  const id = data.serviceId || data._id?.toString();
  return { ...data, id: id || data.id?.toString?.() || data._id?.toString?.() || null };
}

function serializeService(doc) {
  const data = mapId(doc);
  return {
    ...data,
    _id: undefined,
    active: Boolean(data.active),
    featured: Boolean(data.featured)
  };
}

function serializeClient(doc) {
  const data = mapId(doc);
  return {
    ...data,
    _id: undefined,
    isVip: Boolean(data.isVip),
    totalSpent: Number(data.totalSpent || 0)
  };
}

function serializeAppointment(doc) {
  const data = mapId(doc);
  return {
    ...data,
    _id: undefined,
    totalValue: Number(data.totalValue || 0),
    duration: Number(data.duration || 0),
    status: data.status || 'scheduled',
    source: data.source || 'Sistema'
  };
}

function serializeSetting(doc) {
  const data = mapId(doc);
  return {
    ...data,
    _id: undefined,
    dias_fechados: Array.isArray(data.dias_fechados) ? data.dias_fechados : [0]
  };
}

function serializeExpense(doc) {
  const data = mapId(doc);
  return {
    ...data,
    _id: undefined,
    amount: Number(data.amount || 0),
    categoryName: data.category || data.categoryName || ''
  };
}

function serializeCategory(doc) {
  const data = mapId(doc);
  return {
    ...data,
    _id: undefined
  };
}

async function ensureSeedData() {
  const adminEmail = process.env.ADMIN_EMAIL || 'deaneevellyn676@gmail.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await AdminUser.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPass, 10);
    await AdminUser.create({
      name: 'Administrador',
      email: adminEmail,
      passwordHash,
      role: 'admin'
    });
    console.log(`Admin criado: ${adminEmail}`);
  }

  const existingSetting = await Setting.findOne();
  if (!existingSetting) {
    await Setting.create({
      whatsapp_number: '5591985405632',
      instagram_url: 'https://www.instagram.com/estetica_evellyndeane',
      endereco: 'Avenida Martinho Monteiro 700 • Murinim - PA',
      horario_inicio: '09:00',
      horario_fim: '19:00',
      dias_fechados: [0],
      duracao_padrao_minutos: 60,
      intervalo_minutos: 30,
      google_apps_script_url: '',
      google_calendar_id: 'deaneevellyn676@gmail.com'
    });
    console.log('Configurações default inseridas.');
  }

  const serviceCount = await Service.countDocuments();
  if (serviceCount === 0) {
    const seedPath = path.join(__dirname, '..', '..', 'frontend', 'config', 'services.json');
    let servicesList = [];

    if (fs.existsSync(seedPath)) {
      servicesList = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    } else {
      servicesList = [
        { id: 'cilios-seda', name: 'Cílios de seda', category: 'Cílios', description: '', price: 120, promoPrice: 99, duration: 60, active: true, featured: true },
        { id: 'lash-lifting', name: 'Lash Lifting', category: 'Cílios', description: '', price: 140, promoPrice: null, duration: 60, active: true, featured: false },
        { id: 'extensao-fio-a-fio', name: 'Extensão fio a fio', category: 'Cílios', description: '', price: 180, promoPrice: 149, duration: 90, active: true, featured: true },
        { id: 'volume-brasileiro', name: 'Volume Brasileiro', category: 'Cílios', description: '', price: 200, promoPrice: null, duration: 90, active: true, featured: false },
        { id: 'egipcio-3d', name: 'Egípcio 3D', category: 'Cílios', description: '', price: 220, promoPrice: null, duration: 90, active: true, featured: false },
        { id: 'volume-4d-5d', name: 'Volume 4D/5D', category: 'Cílios', description: '', price: 240, promoPrice: null, duration: 100, active: true, featured: false },
        { id: 'buco', name: 'Buço', category: 'Estética', description: '', price: 50, promoPrice: null, duration: 30, active: true, featured: false },
        { id: 'rosto', name: 'Rosto', category: 'Estética', description: '', price: 80, promoPrice: null, duration: 45, active: true, featured: false },
        { id: 'virilha-total', name: 'Virilha total', category: 'Estética', description: '', price: 90, promoPrice: null, duration: 45, active: true, featured: false },
        { id: 'limpeza-pele', name: 'Limpeza de pele', category: 'Estética', description: '', price: 70, promoPrice: null, duration: 40, active: true, featured: false },
        { id: 'microagulhamento', name: 'Microagulhamento', category: 'Estética', description: '', price: 110, promoPrice: null, duration: 60, active: true, featured: false },
        { id: 'ventosaterapia', name: 'Ventosaterapia', category: 'Estética', description: '', price: 60, promoPrice: null, duration: 30, active: true, featured: false }
      ];
    }

    await Service.insertMany(servicesList.map(item => ({
      serviceId: item.id,
      name: item.name,
      category: item.category,
      description: item.description || '',
      price: Number(item.price || 0),
      promoPrice: item.promoPrice != null ? Number(item.promoPrice) : null,
      duration: Number(item.duration || 60),
      active: item.active !== false,
      featured: Boolean(item.featured)
    })));
    console.log('Serviços padrão carregados.');
  }

  const expenseCategoryCount = await ExpenseCategory.countDocuments();
  if (expenseCategoryCount === 0) {
    const defaultCategories = ['Aluguel', 'Energia', 'Água', 'Internet', 'Telefone', 'Marketing', 'Instagram Ads', 'Google Ads', 'Produtos', 'Materiais', 'Fornecedores', 'Funcionários', 'Comissões', 'Contador', 'Impostos', 'Máquinas', 'Equipamentos', 'Manutenção', 'Limpeza', 'Transporte', 'Outros'];
    await ExpenseCategory.insertMany(defaultCategories.map(name => ({ name })));
  }
}

app.get('/health', async (req, res) => {
  const status = getConnectionStatus();
  if (status.isConnected) {
    return res.status(200).json({ status: 'ok', database: 'connected', provider: 'mongodb', uptime: process.uptime() });
  }
  return res.status(503).json({ status: 'error', database: 'disconnected', provider: 'mongodb', timestamp: new Date().toISOString() });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token ausente.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Sessão inválida ou expirada.' });
    req.user = user;
    next();
  });
}

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });

  try {
    const user = await AdminUser.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Credenciais inválidas.' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, name: user.name });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao validar credenciais.' });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find({ active: true }).sort({ category: 1, price: 1 });
    res.json(services.map(serializeService));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar serviços.' });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const setting = await Setting.findOne();
    if (!setting) return res.status(404).json({ error: 'Configurações não encontradas.' });
    res.json(serializeSetting(setting));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configurações.' });
  }
});

app.get('/api/availability', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Data é obrigatória' });

  try {
    const appointments = await Appointment.find({ date, status: { $nin: ['canceled', 'no_show'] } }).select('startTime endTime');
    res.json({ occupied: appointments });
  } catch (error) {
    res.status(500).json({ error: 'Erro no banco' });
  }
});

app.post('/api/appointments', async (req, res) => {
  const { clientName, clientPhone, date, startTime, endTime, duration, totalValue, servicesJson, notes, googleEventId } = req.body;
  if (!clientName || !clientPhone || !date || !startTime) return res.status(400).json({ error: 'Dados incompletos' });

  try {
    let client = await Client.findOne({ phone: clientPhone });
    if (!client) {
      client = await Client.create({ name: clientName, phone: clientPhone, lastAppointmentAt: new Date() });
    } else {
      client.name = clientName;
      client.lastAppointmentAt = new Date();
      await client.save();
    }

    const appointment = await Appointment.create({
      clientId: client._id,
      clientName,
      clientPhone,
      servicesJson: servicesJson || '',
      date,
      startTime,
      endTime: endTime || startTime,
      duration: Number(duration || 0),
      totalValue: Number(totalValue || 0),
      notes: notes || '',
      googleEventId: googleEventId || '',
      source: 'Sistema',
      status: 'scheduled'
    });

    res.status(201).json({ message: 'Agendamento salvo', id: appointment._id.toString() });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar agendamento' });
  }
});

app.get('/api/admin/services', authenticateToken, async (req, res) => {
  try {
    const services = await Service.find().sort({ category: 1, price: 1 });
    res.json(services.map(serializeService));
  } catch (error) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/admin/services', authenticateToken, async (req, res) => {
  const { id, name, category, description, price, promoPrice, duration, active, featured } = req.body;

  if (!name || !category || price === undefined || !duration) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
  }

  try {
    const serviceIdValue = id || `${Date.now()}`;
    const existing = await Service.findOne({ $or: [{ serviceId: serviceIdValue }, { _id: serviceIdValue }] });
    if (existing) return res.status(400).json({ error: 'ID de serviço já existe.' });

    await Service.create({
      serviceId: serviceIdValue,
      name,
      category,
      description: description || '',
      price: Number(price),
      promoPrice: promoPrice != null ? Number(promoPrice) : null,
      duration: Number(duration),
      active: Boolean(active),
      featured: Boolean(featured)
    });
    res.status(201).json({ message: 'Serviço criado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar.' });
  }
});

app.put('/api/admin/services/:id', authenticateToken, async (req, res) => {
  const { name, category, description, price, promoPrice, duration, active, featured } = req.body;

  if (!name || !category || price === undefined || !duration) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
  }

  try {
    const service = await Service.findOneAndUpdate(
      { $or: [{ serviceId: req.params.id }, { _id: req.params.id }] },
      {
        name,
        category,
        description: description || '',
        price: Number(price),
        promoPrice: promoPrice != null ? Number(promoPrice) : null,
        duration: Number(duration),
        active: Boolean(active),
        featured: Boolean(featured),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!service) return res.status(404).json({ error: 'Serviço não encontrado.' });
    res.json({ message: 'Serviço atualizado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar.' });
  }
});

app.delete('/api/admin/services/:id', authenticateToken, async (req, res) => {
  try {
    const result = await Service.deleteOne({ $or: [{ serviceId: req.params.id }, { _id: req.params.id }] });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Serviço não encontrado.' });
    res.json({ message: 'Deletado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar.' });
  }
});

app.get('/api/admin/appointments', authenticateToken, async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ date: -1, startTime: -1 });
    res.json(appointments.map(serializeAppointment));
  } catch (error) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/admin/appointments', authenticateToken, async (req, res) => {
  const { clientName, clientPhone, date, startTime, endTime, duration, totalValue, servicesJson, notes, source } = req.body;
  if (!clientName || !clientPhone || !date || !startTime || !endTime) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  try {
    const conflicts = await Appointment.find({
      date,
      status: { $nin: ['canceled', 'no_show'] },
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
        { startTime: { $gte: startTime, $lt: endTime } }
      ]
    });

    if (conflicts.length > 0) return res.status(409).json({ error: 'Conflito de horário! Já existe um agendamento neste período.' });

    let client = await Client.findOne({ phone: clientPhone });
    if (!client) {
      client = await Client.create({ name: clientName, phone: clientPhone, lastAppointmentAt: new Date() });
    } else {
      client.name = clientName;
      client.lastAppointmentAt = new Date();
      await client.save();
    }

    const appointment = await Appointment.create({
      clientId: client._id,
      clientName,
      clientPhone,
      servicesJson: servicesJson || '',
      date,
      startTime,
      endTime,
      duration: Number(duration || 0),
      totalValue: Number(totalValue || 0),
      notes: notes || '',
      source: source || 'Sistema',
      status: 'scheduled'
    });

    res.status(201).json({ success: true, message: 'Agendamento salvo com sucesso.', id: appointment._id.toString() });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar agendamento.' });
  }
});

app.patch('/api/admin/appointments/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  const allowed = ['scheduled', 'completed', 'canceled', 'no_show'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Status inválido' });

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado.' });

    appointment.status = status;
    appointment.updatedAt = new Date();
    await appointment.save();

    if (status === 'completed' && appointment.clientId) {
      const client = await Client.findById(appointment.clientId);
      if (client) {
        client.totalSpent = Number(client.totalSpent || 0) + Number(appointment.totalValue || 0);
        client.lastAppointmentAt = new Date();
        await client.save();
      }
    }

    res.json({ message: 'Status atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

app.get('/api/admin/clients', authenticateToken, async (req, res) => {
  try {
    const clients = await Client.find().sort({ name: 1 });
    res.json(clients.map(serializeClient));
  } catch (error) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.patch('/api/admin/clients/:id/vip', authenticateToken, async (req, res) => {
  const { isVip, vip } = req.body;
  const vipValue = isVip === true || vip === true;

  try {
    const client = await Client.findByIdAndUpdate(req.params.id, { isVip: vipValue, updatedAt: new Date() }, { new: true });
    if (!client) return res.status(400).json({ success: false, error: 'Cliente não encontrado no banco' });
    res.json({ success: true, client: serializeClient(client) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar status VIP' });
  }
});

app.put('/api/admin/settings', authenticateToken, async (req, res) => {
  const { whatsapp_number, instagram_url, endereco, horario_inicio, horario_fim, dias_fechados, duracao_padrao_minutos, intervalo_minutos, google_apps_script_url, google_calendar_id } = req.body;

  try {
    const setting = await Setting.findOneAndUpdate({}, {
      whatsapp_number,
      instagram_url,
      endereco,
      horario_inicio,
      horario_fim,
      dias_fechados: Array.isArray(dias_fechados) ? dias_fechados : [0],
      duracao_padrao_minutos,
      intervalo_minutos,
      google_apps_script_url,
      google_calendar_id,
      updatedAt: new Date()
    }, { new: true, upsert: true });

    res.json({ message: 'Configurações atualizadas', setting: serializeSetting(setting) });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

app.use('/api/admin', authenticateToken, financeRoutes);

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = `${today.substring(0, 8)}01`;

    const [receitaBruta, receitaPendente, despesasPagas, despesasPendentes, appointmentsMonth, totalClients, activeServices, promoServices] = await Promise.all([
      Appointment.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$totalValue' } } }]),
      Appointment.aggregate([{ $match: { status: { $in: ['scheduled', 'confirmed'] }, date: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$totalValue' } } }]),
      Expense.aggregate([{ $match: { status: 'Pago' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $match: { status: { $ne: 'Pago' } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Appointment.countDocuments({ date: { $gte: firstDayOfMonth }, status: 'completed' }),
      Client.countDocuments(),
      Service.countDocuments({ active: true }),
      Service.countDocuments({ active: true, promoPrice: { $ne: null } })
    ]);

    const receitaBrutaValue = receitaBruta[0]?.total || 0;
    const receitaPendenteValue = receitaPendente[0]?.total || 0;
    const despesasPagasValue = despesasPagas[0]?.total || 0;
    const despesasPendentesValue = despesasPendentes[0]?.total || 0;
    const lucroLiquido = receitaBrutaValue - despesasPagasValue;
    const lucroPrevisto = (receitaBrutaValue + receitaPendenteValue) - (despesasPagasValue + despesasPendentesValue);
    const margemLucro = receitaBrutaValue > 0 ? (lucroLiquido / receitaBrutaValue) * 100 : 0;
    const ticketMedio = appointmentsMonth > 0 ? (receitaBrutaValue / appointmentsMonth) : 0;

    res.json({
      receitaBruta: receitaBrutaValue,
      receitaRecebida: receitaBrutaValue,
      receitaPendente: receitaPendenteValue,
      receitaaReceber: receitaPendenteValue,
      despesasPagas: despesasPagasValue,
      despesasPendentes: despesasPendentesValue,
      lucroBruto: receitaBrutaValue,
      lucroLiquido,
      lucroPrevisto,
      margemLucro,
      ticketMedio,
      appointmentsToday: 0,
      appointmentsMonth,
      expectedRevenueMonth: receitaBrutaValue + receitaPendenteValue,
      realizedRevenueMonth: receitaBrutaValue,
      averageTicket: ticketMedio,
      totalClients: totalClients,
      activeServices,
      activePromotions: promoServices,
      nextAppointments: [],
      revenueChart: [],
      topServices: []
    });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao carregar ERP Financeiro' });
  }
});

async function startServer() {
  try {
    await connectMongo();
    await ensureSeedData();
  } catch (error) {
    console.error('Falha ao inicializar MongoDB:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
  });
}

startServer();

setInterval(() => {}, 1000 * 60 * 60 * 24);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection no Backend:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception no Backend:', error);
});
