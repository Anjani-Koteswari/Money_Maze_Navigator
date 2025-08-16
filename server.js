const express = require('express'); 
const mysql = require('mysql');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ===== JWT secret =====
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

// ===== Default page =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

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
  console.log('MySQL Connected to Clever Cloud...');
});

// ===== Middleware: verify JWT =====
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ success: false, message: 'No token provided' });

  jwt.verify(token.replace('Bearer ', ''), JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: 'Unauthorized' });
    req.userId = decoded.userId;
    next();
  });
}

// ===== Username availability =====
app.get('/check-username', (req, res) => {
  const { username } = req.query;
  if (!username) return res.json({ available: false });

  db.query('SELECT id FROM users WHERE username = ?', [username], (err, results) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ available: false });
    }
    res.json({ available: results.length === 0 });
  });
});

// ===== Email availability =====
app.get('/check-email', (req, res) => {
  const { email } = req.query;
  if (!email) return res.json({ available: false });

  db.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ available: false });
    }
    res.json({ available: results.length === 0 });
  });
});

// ===== Register =====
app.post('/register', (req, res) => {
  const { firstName, lastName, email, pincode, username, password } = req.body;
  if (!firstName || !lastName || !email || !pincode || !username || !password) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const hashedPassword = bcrypt.hashSync(password, 8);

  // Check both username and email
  db.query(
    'SELECT username, email FROM users WHERE username = ? OR email = ?',
    [username, email],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Server error' });

      if (results.length > 0) {
        const takenUsername = results.find(r => r.username === username);
        const takenEmail = results.find(r => r.email === email);

        if (takenUsername) {
          return res.status(400).json({ success: false, message: 'Username already exists' });
        }
        if (takenEmail) {
          return res.status(400).json({ success: false, message: 'Email already registered' });
        }
      }

      const user = { firstName, lastName, email, pincode, username, password: hashedPassword };
      db.query('INSERT INTO users SET ?', user, (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Server error' });
        res.status(200).json({ success: true, message: 'Registration successful', redirect: 'login.html' });
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

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '2h' });

    res.status(200).json({
      success: true,
      message: 'Welcome to Money Maze Navigator!',
      redirect: 'welcome.html',
      token,
    });
  });
});

// ===== Welcome page =====
app.get('/welcome', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'welcome.html'));
});

// ===== EXPENSES (protected) =====
app.get('/expenses', verifyToken, (req, res) => {
  db.query('SELECT * FROM expenses WHERE userId = ?', [req.userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'DB error' });
    res.json(results);
  });
});

app.post('/expenses', verifyToken, (req, res) => {
  const { date, name, amount } = req.body;
  db.query(
    'INSERT INTO expenses (userId, date, name, amount) VALUES (?, ?, ?, ?)',
    [req.userId, date, name, amount],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'DB error' });
      res.json({ id: result.insertId, userId: req.userId, date, name, amount });
    }
  );
});

app.delete('/expenses/:id', verifyToken, (req, res) => {
  db.query(
    'DELETE FROM expenses WHERE id = ? AND userId = ?',
    [req.params.id, req.userId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'DB error' });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, message: 'Expense deleted' });
    }
  );
});

app.put('/expenses/:id', verifyToken, (req, res) => {
  const { date, name, amount } = req.body;
  db.query(
    'UPDATE expenses SET date = ?, name = ?, amount = ? WHERE id = ? AND userId = ?',
    [date, name, amount, req.params.id, req.userId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'DB error' });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, message: 'Expense updated' });
    }
  );
});

// ===== SALARY (protected) =====
app.post('/salary', verifyToken, (req, res) => {
  const { salary } = req.body;
  db.query(
    'REPLACE INTO salary (userId, salary) VALUES (?, ?)',
    [req.userId, salary],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'DB error' });
      res.json({ success: true });
    }
  );
});

app.get('/salary', verifyToken, (req, res) => {
  db.query('SELECT salary FROM salary WHERE userId = ?', [req.userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'DB error' });
    res.json(results[0] || { salary: 0 });
  });
});

// ===== BUDGET (protected) =====
app.post('/budget', verifyToken, (req, res) => {
  const { name, amount } = req.body;
  db.query(
    'REPLACE INTO budgets (userId, name, amount) VALUES (?, ?, ?)',
    [req.userId, name, amount],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'DB error' });
      res.json({ success: true });
    }
  );
});

app.get('/budget', verifyToken, (req, res) => {
  db.query('SELECT name, amount FROM budgets WHERE userId = ?', [req.userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'DB error' });
    const budgetObj = {};
    results.forEach(r => (budgetObj[r.name] = r.amount));
    res.json(budgetObj);
  });
});

// ===== LOGOUT =====
app.post('/logout', (req, res) => {
  // With JWT, logout is client-side (delete token from storage)
  res.json({ success: true });
});

// ===== Start server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});


