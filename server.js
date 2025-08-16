const express = require('express'); 
const mysql = require('mysql');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Default page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// MySQL connection
const db = mysql.createConnection({
    host: 'bkye9jogrdgovgyqdhf1-mysql.services.clever-cloud.com',
    user: 'u2ssz7mhbct9qkak',
    password: '52aT3tAbyryNqkk7rTLZ',
    database: 'bkye9jogrdgovgyqdhf1',
    port: 3306
});

db.connect(err => {
    if (err) throw err;
    console.log('MySQL Connected to Clever Cloud...');
});

// Register
app.post('/register', (req, res) => {
    const { firstName, lastName, email, pincode, username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);

    db.query('SELECT username FROM users WHERE username = ?', [username], (err, results) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        if (results.length > 0) return res.status(400).json({ message: 'Username already exists' });

        const user = { firstName, lastName, email, pincode, username, password: hashedPassword };
        db.query('INSERT INTO users SET ?', user, (err, result) => {
            if (err) return res.status(500).json({ message: 'Server error' });
            res.status(200).json({ message: 'Registration successful', redirect: 'login.html' });
        });
    });
});

// Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        if (results.length === 0) return res.status(400).json({ message: 'Username not found' });

        const user = results[0];
        const passwordIsValid = bcrypt.compareSync(password, user.password);

        if (!passwordIsValid) return res.status(401).json({ message: 'Invalid password' });

        res.status(200).json({ 
            message: 'Welcome to Money Maze Navigator!', 
            redirect: 'welcome.html',
            userId: user.id   // 👈 send userId for per-user expenses
        });
    });
});

// Welcome page
app.get('/welcome', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'welcome.html'));
});


// ===== EXPENSES =====
app.get('/expenses', (req, res) => {
    const { userId } = req.query;
    db.query('SELECT * FROM expenses WHERE userId = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json(results);
    });
});

app.post('/expenses', (req, res) => {
    const { userId, date, name, amount } = req.body;
    db.query('INSERT INTO expenses (userId, date, name, amount) VALUES (?, ?, ?, ?)', 
        [userId, date, name, amount], 
        (err, result) => {
            if (err) return res.status(500).json({ message: 'DB error' });
            res.json({ id: result.insertId, userId, date, name, amount });
        });
});

app.delete('/expenses/:id', (req, res) => {
    db.query('DELETE FROM expenses WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json({ message: 'Expense deleted' });
    });
});

app.put('/expenses/:id', (req, res) => {
    const { date, name, amount } = req.body;
    db.query('UPDATE expenses SET date=?, name=?, amount=? WHERE id=?', 
        [date, name, amount, req.params.id], 
        (err) => {
            if (err) return res.status(500).json({ message: 'DB error' });
            res.json({ message: 'Expense updated' });
        });
});


// ===== SALARY =====
app.post('/salary', (req, res) => {
    const { userId, salary } = req.body;
    db.query('REPLACE INTO salary (userId, salary) VALUES (?, ?)', [userId, salary], (err) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json({ success: true });
    });
});

app.get('/salary', (req, res) => {
    const { userId } = req.query;
    db.query('SELECT salary FROM salary WHERE userId = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json(results[0] || { salary: 0 });
    });
});


// ===== BUDGET =====
app.post('/budget', (req, res) => {
    const { userId, name, amount } = req.body;
    db.query('REPLACE INTO budgets (userId, name, amount) VALUES (?, ?, ?)', [userId, name, amount], (err) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        res.json({ success: true });
    });
});

app.get('/budget', (req, res) => {
    const { userId } = req.query;
    db.query('SELECT name, amount FROM budgets WHERE userId = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        const budgetObj = {};
        results.forEach(r => budgetObj[r.name] = r.amount);
        res.json(budgetObj);
    });
});


// ===== LOGOUT =====
app.post('/logout', (req, res) => {
    // For now just return success (if using JWT, you'd invalidate token here)
    res.json({ success: true });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
