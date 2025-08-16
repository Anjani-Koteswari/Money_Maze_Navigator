const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();

// ===== Middleware =====
app.use(bodyParser.json());
app.use(cors({
  origin: true,            // same-origin on Render is fine; credentials allowed
  credentials: true
}));
app.use(cookieParser());

// ===== Serve static frontend =====
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

// ===== MySQL connection =====
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'bkye9jogrdgovgyqdhf1-mysql.services.clever-cloud.com',
  user: process.env.DB_USER || 'u2ssz7mhbct9qkak',
  password: process.env.DB_PASSWORD || '52aT3tAbyryNqkk7rTLZ',
  database: process.env.DB_NAME || 'bkye9jogrdgovgyqdhf1',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
});

db.connect(err => {
  if (err) {
    console.error('❌ MySQL connection error:', err);
    process.exit(1);
  }
  console.log('✅ MySQL Connected to Clever Cloud...');

  // Ensure required tables exist (safe if already created)
  const ensureSQL = `
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      date DATE NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS salaries (
      user_id INT PRIMARY KEY,
      amount DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      UNIQUE KEY uniq_user_cat (user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;
  db.query(ensureSQL, (e) => {
    if (e) console.error('⚠️ Table ensure error (can ignore if tables already exist):', e.sqlMessage || e);
    else console.log('🧱 Tables ready (expenses, salaries, budgets).');
  });
});

// ===== Middleware: verify JWT from cookies =====
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ success: false, message: 'No token' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: 'Unauthorized' });
    req.userId = decoded.userId;
    next();
  });
}

// ===== Register =====
app.post('/register', (req, res) => {
  const { firstName, lastName, email, pincode, username, password } = req.body;
  if (!firstName || !lastName || !email || !pincode || !username || !password) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const hashedPassword = bcrypt.hashSync(password, 8);

  db.query(
    'SELECT username, email FROM users WHERE username = ? OR email = ?',
    [username, email],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Server error' });

      if (results.length > 0) {
        if (results.find(r => r.username === username)) {
          return res.status(400).json({ success: false, message: 'Username already exists' });
        }
        if (results.find(r => r.email === email)) {
          return res.status(400).json({ success: false, message: 'Email already registered' });
        }
      }

      const user = { firstName, lastName, email, pincode, username, password: hashedPassword };
      db.query('INSERT INTO users SET ?', user, (err2) => {
        if (err2) return res.status(500).json({ success: false, message: 'Server error' });
        res.status(200).json({ success: true, message: 'Registration successful' });
      });
    }
  );
});

// ===== Login =====
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    if (results.length === 0) return res.status(400).json({ success: false, message: 'Username not found' });

    const user = results[0];
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) return res.status(401).json({ success: false, message: 'Invalid password' });

    // Generate JWT and store in HTTP-only cookie
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '2h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,        // Render uses HTTPS
      sameSite: 'none',
      maxAge: 2 * 60 * 60 * 1000
    });

    res.status(200).json({ success: true, message: 'Login successful' });
  });
});

// ===== Get current user =====
app.get('/api/me', verifyToken, (req, res) => {
  db.query(
    'SELECT id, username, email, firstName, lastName FROM users WHERE id = ?',
    [req.userId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Server error' });
      if (results.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

      // Wrap as your welcome.js expects
      res.json({ success: true, user: results[0] });
    }
  );
});

// ===== Expenses APIs (match welcome.js: no /api prefix) =====

// Create expense
app.post('/expenses', verifyToken, (req, res) => {
  const { name, amount } = req.body;
  if (!name || amount === undefined || amount === null) {
    return res.status(400).json({ success: false, message: 'Name and amount required' });
  }

  // Use today's date on the server
  db.query(
    'INSERT INTO expenses (user_id, name, amount, date) VALUES (?, ?, ?, CURDATE())',
    [req.userId, name, amount],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Error saving expense' });

      // Return full object so frontend can push directly
      res.json({
        id: result.insertId,
        name,
        amount: parseFloat(amount),
        date: new Date() // frontend just formats this
      });
    }
  );
});

// List expenses
app.get('/expenses', verifyToken, (req, res) => {
  db.query(
    'SELECT id, name, amount, date FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC',
    [req.userId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Error fetching expenses' });
      // Ensure numbers
      const rows = results.map(r => ({ ...r, amount: parseFloat(r.amount) }));
      res.json(rows);
    }
  );
});

// Update expense amount
app.put('/expenses/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  if (amount === undefined || amount === null) {
    return res.status(400).json({ success: false, message: 'Amount required' });
  }

  db.query(
    'UPDATE expenses SET amount = ? WHERE id = ? AND user_id = ?',
    [amount, id, req.userId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Error updating expense' });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Expense not found' });
      res.json({ success: true });
    }
  );
});

// Delete expense
app.delete('/expenses/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query(
    'DELETE FROM expenses WHERE id = ? AND user_id = ?',
    [id, req.userId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Error deleting expense' });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Expense not found' });
      res.json({ success: true, message: 'Expense deleted' });
    }
  );
});

// ===== Salary APIs (match welcome.js) =====
app.get('/salary', verifyToken, (req, res) => {
  db.query('SELECT amount FROM salaries WHERE user_id = ?', [req.userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching salary' });
    const amount = results.length ? parseFloat(results[0].amount) : 0;
    res.json({ salary: amount });
  });
});

app.post('/salary', verifyToken, (req, res) => {
  const { salary } = req.body;
  if (salary === undefined || salary === null) {
    return res.status(400).json({ success: false, message: 'Salary required' });
  }
  db.query(
    'INSERT INTO salaries (user_id, amount) VALUES (?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)',
    [req.userId, salary],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error saving salary' });
      res.json({ salary: parseFloat(salary) });
    }
  );
});

// ===== Budget APIs (match welcome.js) =====
app.get('/budget', verifyToken, (req, res) => {
  db.query('SELECT name, amount FROM budgets WHERE user_id = ?', [req.userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching budgets' });
    const rows = results.map(r => ({ name: r.name, amount: parseFloat(r.amount) }));
    res.json(rows);
  });
});

app.post('/budget', verifyToken, (req, res) => {
  const { name, amount } = req.body;
  if (!name || amount === undefined || amount === null) {
    return res.status(400).json({ success: false, message: 'Name and amount required' });
  }
  db.query(
    'INSERT INTO budgets (user_id, name, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)',
    [req.userId, name, amount],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error saving budget' });
      res.json({ name, amount: parseFloat(amount) });
    }
  );
});

// ===== Logout =====
app.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ success: true, message: 'Logged out' });
});

// ===== Default route (serve login.html) =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ===== Fallback for unknown routes =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ===== Start server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
