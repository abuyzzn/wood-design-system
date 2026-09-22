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
app.use(express.static('public'));

app.use(session({
  secret: 'wood-design-system-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Database initialization
const db = new sqlite3.Database('wood_design.db', (err) => {
  if (err) console.error('Database error:', err.message);
  else console.log('Database connected');
});

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Targets table
    db.run(`CREATE TABLE IF NOT EXISTS targets (
      id INTEGER PRIMARY KEY,
      department TEXT UNIQUE NOT NULL,
      monthly_target REAL,
      daily_target REAL,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Sales table
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

    // Production table
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

    // Finance table
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

    // Inventory table
    db.run(`CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY,
      work_date DATE NOT NULL,
      inventory_value REAL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Factory notes table
    db.run(`CREATE TABLE IF NOT EXISTS factory_notes (
      id INTEGER PRIMARY KEY,
      work_date DATE NOT NULL,
      note_type TEXT,
      content TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Audit log table
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY,
      work_date DATE NOT NULL,
      operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      department TEXT,
      operation TEXT,
      old_value TEXT,
      new_value TEXT,
      table_name TEXT
    )`);

    // Insert default users
    const users = [
      { username: 'owner', role: 'المالك', department: 'الإدارة', password: '0000' },
      { username: 'factory_manager', role: 'مدير المصنع', department: 'التشغيل', password: '0001' },
      { username: 'production_manager', role: 'مدير الإنتاج', department: 'الإنتاج', password: '0011' },
      { username: 'finance', role: 'المالية', department: 'المالية', password: '0010' },
      { username: 'sales', role: 'المبيعات', department: 'المبيعات', password: '0100' },
      { username: 'inventory', role: 'المخزون والمشتريات', department: 'المخزون', password: '0101' }
    ];

    users.forEach(user => {
      const hash = bcrypt.hashSync(user.password, 10);
      db.run('INSERT OR IGNORE INTO users (username, role, department, password_hash, email) VALUES (?, ?, ?, ?, ?)',
        [user.username, user.role, user.department, hash, 'abuyzzn@gmail.com']);
    });

    // Insert default targets
    const targets = [
      { department: 'المبيعات', monthly_target: 236500, daily_target: 8452.86 },
      { department: 'الإنتاج', monthly_target: 275, daily_target: 13 },
      { department: 'التركيب', monthly_target: 275, daily_target: 13 },
      { department: 'المخزون', monthly_target: 261000, daily_target: 261000 }
    ];

    targets.forEach(target => {
      db.run('INSERT OR IGNORE INTO targets (department, monthly_target, daily_target) VALUES (?, ?, ?)',
        [target.department, target.monthly_target, target.daily_target]);
    });
  });
}

initializeDatabase();

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Permission middleware
function hasPermission(allowedRoles) {
  return (req, res, next) => {
    if (allowedRoles.includes(req.session.userRole)) {
      next();
    } else {
      res.status(403).json({ error: 'صلاحية غير كافية' });
    }
  };
}

// Routes - Default redirect to login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Routes - Login
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

// Routes - Dashboard
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// API Routes - Get user info
app.get('/api/user', isAuthenticated, (req, res) => {
  res.json({
    userId: req.session.userId,
    username: req.session.username,
    role: req.session.userRole,
    department: req.session.department
  });
});

// API Routes - Get targets
app.get('/api/targets', isAuthenticated, (req, res) => {
  db.all('SELECT * FROM targets', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// API Routes - Update targets (Owner + Factory Manager only)
app.post('/api/targets/:id', isAuthenticated, hasPermission(['المالك', 'مدير المصنع']), (req, res) => {
  const { monthly_target, daily_target } = req.body;
  const { id } = req.params;

  db.run(
    'UPDATE targets SET monthly_target = ?, daily_target = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [monthly_target, daily_target, req.session.userId, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// API Routes - Get sales data
app.get('/api/sales', isAuthenticated, (req, res) => {
  const { start_date, end_date } = req.query;
  let query = 'SELECT * FROM sales WHERE 1=1';
  let params = [];

  if (start_date) {
    query += ' AND work_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND work_date <= ?';
    params.push(end_date);
  }

  db.all(query + ' ORDER BY work_date DESC', params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// API Routes - Add sales data
app.post('/api/sales', isAuthenticated, (req, res) => {
  if (!['المبيعات', 'المالك', 'مدير المصنع'].includes(req.session.userRole)) {
    return res.status(403).json({ error: 'صلاحية غير كافية' });
  }

  const { work_date, contract_value, payment_amount, doors_count, operation_type } = req.body;

  db.run(
    `INSERT INTO sales (work_date, contract_value, payment_amount, doors_count, operation_type, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [work_date, contract_value, payment_amount, doors_count, operation_type, req.session.userId, req.session.userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        `INSERT INTO audit_logs (work_date, user_id, department, operation, new_value, table_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [work_date, req.session.userId, req.session.department, 'إضافة عملية بيع',
         JSON.stringify({contract_value, payment_amount, doors_count, operation_type}), 'sales']
      );

      res.json({ success: true, id: this.lastID });
    }
  );
});

// API Routes - Get production data
app.get('/api/production', isAuthenticated, (req, res) => {
  const { start_date, end_date } = req.query;
  let query = 'SELECT * FROM production WHERE 1=1';
  let params = [];

  if (start_date) {
    query += ' AND work_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND work_date <= ?';
    params.push(end_date);
  }

  db.all(query + ' ORDER BY work_date DESC', params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// API Routes - Add production data
app.post('/api/production', isAuthenticated, (req, res) => {
  if (!['مدير الإنتاج', 'المالك', 'مدير المصنع'].includes(req.session.userRole)) {
    return res.status(403).json({ error: 'صلاحية غير كافية' });
  }

  const { work_date, doors_manufactured, doors_installed, rework_count, problem_reason } = req.body;

  db.run(
    `INSERT INTO production (work_date, doors_manufactured, doors_installed, rework_count, problem_reason, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [work_date, doors_manufactured, doors_installed, rework_count, problem_reason, req.session.userId, req.session.userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        `INSERT INTO audit_logs (work_date, user_id, department, operation, new_value, table_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [work_date, req.session.userId, req.session.department, 'إضافة بيانات إنتاج',
         JSON.stringify({doors_manufactured, doors_installed, rework_count}), 'production']
      );

      res.json({ success: true, id: this.lastID });
    }
  );
});

// API Routes - Get finance data
app.get('/api/finance', isAuthenticated, (req, res) => {
  const { start_date, end_date } = req.query;
  let query = 'SELECT * FROM finance WHERE 1=1';
  let params = [];

  if (start_date) {
    query += ' AND work_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND work_date <= ?';
    params.push(end_date);
  }

  db.all(query + ' ORDER BY work_date DESC', params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// API Routes - Add finance data
app.post('/api/finance', isAuthenticated, (req, res) => {
  if (!['المالية', 'المالك', 'مدير المصنع'].includes(req.session.userRole)) {
    return res.status(403).json({ error: 'صلاحية غير كافية' });
  }

  const { work_date, receipts, payments, local_purchases, cash_balance, bank_balance } = req.body;

  db.run(
    `INSERT INTO finance (work_date, receipts, payments, local_purchases, cash_balance, bank_balance, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [work_date, receipts, payments, local_purchases, cash_balance, bank_balance, req.session.userId, req.session.userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// API Routes - Get inventory data
app.get('/api/inventory', isAuthenticated, (req, res) => {
  db.all('SELECT * FROM inventory ORDER BY work_date DESC LIMIT 1', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows && rows[0] ? rows[0] : { inventory_value: 326557.53 });
  });
});

// API Routes - Add inventory data
app.post('/api/inventory', isAuthenticated, (req, res) => {
  if (!['المخزون والمشتريات', 'المالك', 'مدير المصنع'].includes(req.session.userRole)) {
    return res.status(403).json({ error: 'صلاحية غير كافية' });
  }

  const { work_date, inventory_value } = req.body;

  db.run(
    `INSERT INTO inventory (work_date, inventory_value, created_by, updated_by)
     VALUES (?, ?, ?, ?)`,
    [work_date, inventory_value, req.session.userId, req.session.userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// API Routes - Get audit logs
app.get('/api/audit-logs', isAuthenticated, hasPermission(['المالك']), (req, res) => {
  const { start_date, end_date } = req.query;
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  let params = [];

  if (start_date) {
    query += ' AND work_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND work_date <= ?';
    params.push(end_date);
  }

  db.all(query + ' ORDER BY operation_time DESC', params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// API Routes - Get dashboard metrics
app.get('/api/metrics', isAuthenticated, (req, res) => {
  const period = req.query.period || 'month';
  const today = new Date();
  let startDate, endDate = today.toISOString().split('T')[0];

  switch(period) {
    case 'day':
      startDate = endDate;
      break;
    case 'week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
      break;
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      break;
  }

  const metrics = {};
  let completed = 0;
  const totalQueries = 4;

  // Sales metrics
  db.all('SELECT SUM(contract_value) as total, COUNT(*) as count FROM sales WHERE work_date >= ?', [startDate], (err, rows) => {
    if (!err && rows[0]) {
      metrics.sales = {
        total: rows[0].total || 0,
        count: rows[0].count || 0
      };
    }
    completed++;
    if (completed === totalQueries) res.json(metrics);
  });

  // Production metrics
  db.all('SELECT SUM(doors_manufactured) as manufactured, SUM(doors_installed) as installed, SUM(rework_count) as rework FROM production WHERE work_date >= ?', [startDate], (err, rows) => {
    if (!err && rows[0]) {
      metrics.production = {
        manufactured: rows[0].manufactured || 0,
        installed: rows[0].installed || 0,
        rework: rows[0].rework || 0
      };
    }
    completed++;
    if (completed === totalQueries) res.json(metrics);
  });

  // Finance metrics
  db.all('SELECT SUM(receipts) as receipts, SUM(payments) as payments FROM finance WHERE work_date >= ?', [startDate], (err, rows) => {
    if (!err && rows[0]) {
      metrics.finance = {
        receipts: rows[0].receipts || 0,
        payments: rows[0].payments || 0
      };
    }
    completed++;
    if (completed === totalQueries) res.json(metrics);
  });

  // Inventory metrics
  db.get('SELECT inventory_value FROM inventory WHERE work_date <= ? ORDER BY work_date DESC LIMIT 1', [endDate], (err, row) => {
    if (!err && row) {
      metrics.inventory = {
        value: row.inventory_value || 0
      };
    }
    completed++;
    if (completed === totalQueries) res.json(metrics);
  });
});

// Serve static files
app.use(express.static('public'));

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`النظام يعمل على http://localhost:${PORT}`);
  console.log('اسم الشركة: شركة التصميم الخشبي الصناعية');
  console.log('بيانات الدخول الافتراضية:');
  console.log('المالك: owner / 0000');
  console.log('مدير المصنع: factory_manager / 0001');
});
