const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'wood-design-system-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Database
const db = new sqlite3.Database('./wood_design.db', (err) => {
  if (err) console.error('Database error:', err.message);
  else console.log('Database connected');
});

// Initialize database
function initializeDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS targets (
      id INTEGER PRIMARY KEY,
      department TEXT UNIQUE NOT NULL,
      monthly_target REAL,
      daily_target REAL,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY,
      work_date DATE NOT NULL,
      contract_value REAL,
      payment_amount REAL,
      doors_count INTEGER,
      operation_type TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS production (
      id INTEGER PRIMARY KEY,
      work_date DATE NOT NULL,
      doors_manufactured INTEGER,
      doors_installed INTEGER,
      rework_count INTEGER,
      problem_reason TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS finance (
      id INTEGER PRIMARY KEY,
      work_date DATE NOT NULL,
      receipts REAL,
      payments REAL,
      local_purchases REAL,
      cash_balance REAL,
      bank_balance REAL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY,
      work_date DATE NOT NULL,
      inventory_value REAL,
      wood_quantity REAL,
      accessories_value REAL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS factory_notes (
      id INTEGER PRIMARY KEY,
      work_date DATE NOT NULL,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      action TEXT,
      table_name TEXT,
      record_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    insertDefaultUsers();
  });
}

function insertDefaultUsers() {
  const users = [
    { username: 'owner', password: '0000', role: 'المالك', department: 'الإدارة' },
    { username: 'factory_manager', password: '0001', role: 'مدير المصنع', department: 'المصنع' },
    { username: 'production_manager', password: '0011', role: 'مدير الإنتاج', department: 'الإنتاج' },
    { username: 'finance', password: '0010', role: 'المحاسب', department: 'المالية' },
    { username: 'sales', password: '0100', role: 'مدير المبيعات', department: 'المبيعات' },
    { username: 'inventory', password: '0101', role: 'أمين المستودع', department: 'المستودع' }
  ];

  users.forEach(user => {
    const hash = bcrypt.hashSync(user.password, 10);
    db.run('INSERT OR IGNORE INTO users (username, password_hash, role, department) VALUES (?, ?, ?, ?)',
      [user.username, hash, user.role, user.department]
    );
  });
}

initializeDatabase();

// Auth middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'بيانات غير صحيحة' });

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ error: 'بيانات غير صحيحة' });

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.userRole = user.role;
    req.session.department = user.department;

    res.json({ success: true, redirect: '/dashboard' });
  });
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/api/user', isAuthenticated, (req, res) => {
  res.json({
    userId: req.session.userId,
    username: req.session.username,
    role: req.session.userRole,
    department: req.session.department
  });
});

app.get('/api/sales', isAuthenticated, (req, res) => {
  db.all('SELECT * FROM sales ORDER BY work_date DESC LIMIT 30', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/sales', isAuthenticated, (req, res) => {
  const { work_date, contract_value, payment_amount, doors_count, operation_type } = req.body;
  db.run('INSERT INTO sales (work_date, contract_value, payment_amount, doors_count, operation_type, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [work_date, contract_value, payment_amount, doors_count, operation_type, req.session.userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.get('/api/production', isAuthenticated, (req, res) => {
  db.all('SELECT * FROM production ORDER BY work_date DESC LIMIT 30', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/production', isAuthenticated, (req, res) => {
  const { work_date, doors_manufactured, doors_installed, rework_count, problem_reason } = req.body;
  db.run('INSERT INTO production (work_date, doors_manufactured, doors_installed, rework_count, problem_reason, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [work_date, doors_manufactured, doors_installed, rework_count, problem_reason, req.session.userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Static files
app.use(express.static('public'));

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`النظام يعمل على http://0.0.0.0:${PORT}`);
  console.log('اسم الشركة: شركة التصميم الخشبي الصناعية');
  console.log('بيانات الدخول الافتراضية:');
  console.log('المالك: owner / 0000');
  console.log('مدير المصنع: factory_manager / 0001');
});
