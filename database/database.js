const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const SEED_FILE = path.join(__dirname, '../../frontend/config/services.json');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco SQLite:', err.message);
  } else {
    console.log('Conectado ao banco SQLite com sucesso.');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(async () => {
    // 1. Tabela de Usuários Admin
    db.run(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL
      )
    `);

    // 2. Tabela de Serviços
    db.run(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        promoPrice REAL,
        duration INTEGER NOT NULL,
        active BOOLEAN DEFAULT 1,
        featured BOOLEAN DEFAULT 0
      )
    `);

    // 3. Tabela de Configurações
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        whatsapp_number TEXT,
        instagram_url TEXT,
        endereco TEXT,
        horario_inicio TEXT,
        horario_fim TEXT,
        dias_fechados TEXT,
        duracao_padrao_minutos INTEGER,
        intervalo_minutos INTEGER,
        google_apps_script_url TEXT,
        google_calendar_id TEXT
      )
    `);

    // 4. Tabela de Clientes
    db.run(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT,
        notes TEXT,
        totalAppointments INTEGER DEFAULT 0,
        totalSpent REAL DEFAULT 0,
        isVip BOOLEAN DEFAULT 0,
        lastAppointmentAt TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Tabela de Agendamentos
    db.run(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clientId INTEGER,
        clientName TEXT,
        clientPhone TEXT,
        servicesJson TEXT,
        date TEXT,
        startTime TEXT,
        endTime TEXT,
        duration INTEGER,
        totalValue REAL,
        status TEXT DEFAULT 'scheduled',
        paymentStatus TEXT DEFAULT 'pending',
        paymentMethod TEXT,
        notes TEXT,
        source TEXT DEFAULT 'Sistema',
        googleEventId TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clientId) REFERENCES clients (id)
      )
    `);

    // 5.1 Tabela de Categorias de Despesas
    db.run(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);

    // 5.2 Tabela de Despesas
    db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        categoryId INTEGER,
        amount REAL NOT NULL,
        dueDate TEXT NOT NULL,
        paymentDate TEXT,
        status TEXT DEFAULT 'Pendente',
        paymentMethod TEXT,
        type TEXT DEFAULT 'Variável',
        recurrence TEXT DEFAULT 'Única',
        notes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoryId) REFERENCES expense_categories (id)
      )
    `);

    // 6. Seed: Criar Admin Inicial (se não existir)
    const adminEmail = process.env.ADMIN_EMAIL || 'deaneevellyn676@gmail.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    db.get('SELECT id FROM admin_users WHERE email = ?', [adminEmail], async (err, row) => {
      if (!row) {
        const hash = await bcrypt.hash(adminPass, 10);
        db.run('INSERT INTO admin_users (name, email, passwordHash) VALUES (?, ?, ?)', ['Administrador', adminEmail, hash]);
        console.log(`Admin criado: ${adminEmail}`);
      }
    });

    // 4. Seed: Migrar os serviços do JSON para o SQLite (se a tabela estiver vazia)
    db.get('SELECT COUNT(*) as count FROM services', (err, row) => {
      if (row && row.count === 0 && fs.existsSync(SEED_FILE)) {
        console.log('Tabela de serviços vazia. Importando de config/services.json...');
        try {
          const rawData = fs.readFileSync(SEED_FILE);
          const servicesList = JSON.parse(rawData);
          
          const stmt = db.prepare(`
            INSERT INTO services (id, name, category, description, price, promoPrice, duration, active, featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          servicesList.forEach(s => {
            stmt.run(
              s.id,
              s.name,
              s.category,
              s.description || '',
              s.price,
              s.promoPrice || null,
              s.duration,
              s.active ? 1 : 0,
              s.featured ? 1 : 0
            );
          });
          stmt.finalize();
          console.log(`Migração concluída: ${servicesList.length} serviços importados do JSON.`);
        } catch (e) {
          console.error('Erro ao ler services.json para seed:', e);
        }
      }
    });

    // 8. Seed: Configurações Iniciais
    db.get('SELECT COUNT(*) as count FROM settings', (err, row) => {
      if (row && row.count === 0) {
        db.run(`
          INSERT INTO settings (
            whatsapp_number, instagram_url, endereco, horario_inicio, horario_fim,
            dias_fechados, duracao_padrao_minutos, intervalo_minutos,
            google_apps_script_url, google_calendar_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          "5591985405632",
          "https://www.instagram.com/estetica_evellyndeane",
          "Avenida Martinho Monteiro 700 • Murinim - PA",
          "09:00",
          "19:00",
          "[0]",
          60,
          30,
          "",
          "deaneevellyn676@gmail.com"
        ]);
        console.log('Configurações default inseridas.');
      }
    });
    
    // Migrações seguras
    db.run("ALTER TABLE clients ADD COLUMN isVip BOOLEAN DEFAULT 0", function(err) {});
    db.run("ALTER TABLE appointments ADD COLUMN source TEXT DEFAULT 'Sistema'", function(err) {});
    db.run("ALTER TABLE appointments ADD COLUMN paymentStatus TEXT DEFAULT 'pending'", function(err) {});

    // Seed: Categorias de Despesas
    db.get('SELECT COUNT(*) as count FROM expense_categories', (err, row) => {
      if (row && row.count === 0) {
        const defaultCategories = [
          'Aluguel', 'Energia', 'Água', 'Internet', 'Telefone', 'Marketing',
          'Instagram Ads', 'Google Ads', 'Produtos', 'Materiais', 'Fornecedores',
          'Funcionários', 'Comissões', 'Contador', 'Impostos', 'Máquinas',
          'Equipamentos', 'Manutenção', 'Limpeza', 'Transporte', 'Outros'
        ];
        const stmt = db.prepare('INSERT INTO expense_categories (name) VALUES (?)');
        defaultCategories.forEach(cat => stmt.run(cat));
        stmt.finalize();
        console.log('Categorias de despesas padrão criadas.');
      }
    });
  });
}

module.exports = db;
