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

// ===== Expenses APIs =====

// Create expense
app.post('/api/expenses', verifyToken, (req, res) => {
  const { name, amount } = req.body;
  if (!name || !amount) {
    return res.status(400).json({ success: false, message: 'Name and amount required' });
  }

  const expense = { user_id: req.userId, name, amount, date: new Date() };
  db.query('INSERT INTO expenses SET ?', expense, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Error saving expense' });

    res.json({
      id: result.insertId,
      name,
      amount,
      date: expense.date
    });
  });
});

// List expenses
app.get('/api/expenses', verifyToken, (req, res) => {
  db.query('SELECT id, name, amount, date FROM expenses WHERE user_id = ? ORDER BY date DESC',
    [req.userId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Error fetching expenses' });
      res.json(results);
    });
});

// Delete expense
app.delete('/api/expenses/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, req.userId], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Error deleting expense' });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.json({ success: true, message: 'Expense deleted' });
  });
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
