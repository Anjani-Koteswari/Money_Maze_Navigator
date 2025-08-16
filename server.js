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
  origin: true,        // allow all origins (adjust later if needed)
  credentials: true    // allow sending cookies
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
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ MySQL Connected to Clever Cloud...');
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
      db.query('INSERT INTO users SET ?', user, (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Server error' });
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
      res.json({
        success: true,
        user: results[0]
      });
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

// ===== Check username availability =====
app.get('/check-username', (req, res) => {
  const { username } = req.query;
  db.query('SELECT id FROM users WHERE username = ?', [username], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    res.json({ available: results.length === 0 });
  });
});

// ===== Check email availability =====
app.get('/check-email', (req, res) => {
  const { email } = req.query;
  db.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    res.json({ available: results.length === 0 });
  });
});

// ===== Expenses =====
// Get all expenses for the current user
app.get('/api/expenses', verifyToken, (req, res) => {
  db.query('SELECT * FROM expenses WHERE userId = ?', [req.userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    res.json(results);
  });
});

// Add a new expense
app.post('/api/expenses', verifyToken, (req, res) => {
  const { name, amount } = req.body;
  db.query('INSERT INTO expenses (userId, name, amount, date) VALUES (?, ?, ?, NOW())',
    [req.userId, name, amount], (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Server error' });
      res.json({ id: results.insertId, userId: req.userId, name, amount, date: new Date() });
    });
});

// Delete an expense
app.delete('/api/expenses/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM expenses WHERE id = ? AND userId = ?', [id, req.userId], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    res.json({ success: true });
  });
});

// Update an expense
app.put('/api/expenses/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  db.query('UPDATE expenses SET amount = ? WHERE id = ? AND userId = ?', [amount, id, req.userId], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    res.json({ success: true });
  });
});

// ===== Salary =====
// Get salary
app.get('/api/salary', verifyToken, (req, res) => {
  db.query('SELECT salary FROM users WHERE id = ?', [req.userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    res.json({ salary: results[0]?.salary || 0 });
  });
});

// Set salary
app.post('/api/salary', verifyToken, (req, res) => {
  const { salary } = req.body;
  db.query('UPDATE users SET salary = ? WHERE id = ?', [salary, req.userId], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    res.json({ success: true });
  });
});

// ===== Budget =====
// Get budgets
app.get('/api/budget', verifyToken, (req, res) => {
  db.query('SELECT * FROM budgets WHERE userId = ?', [req.userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    res.json(results);
  });
});

// Set budget
app.post('/api/budget', verifyToken, (req, res) => {
  const { name, amount } = req.body;
  db.query('INSERT INTO budgets (userId, name, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount = ?',
    [req.userId, name, amount, amount], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Server error' });
      res.json({ success: true });
    });
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
