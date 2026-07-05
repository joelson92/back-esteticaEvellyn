const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  whatsapp_number: { type: String, default: '' },
  instagram_url: { type: String, default: '' },
  endereco: { type: String, default: '' },
  horario_inicio: { type: String, default: '09:00' },
  horario_fim: { type: String, default: '19:00' },
  dias_fechados: { type: [Number], default: [0] },
  duracao_padrao_minutos: { type: Number, default: 60 },
  intervalo_minutos: { type: Number, default: 30 },
  google_apps_script_url: { type: String, default: '' },
  google_calendar_id: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('Setting', settingSchema);
