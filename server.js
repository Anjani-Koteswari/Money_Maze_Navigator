const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Middleware
app.use(cors());
app.use(express.json());

// ✅ MySQL Connection (Clever Cloud)
const db = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT || 3306
});

db.connect(err => {
    if (err) {
        console.error("❌ MySQL connection failed:", err);
        process.exit(1);
    }
    console.log("✅ MySQL Connected to Clever Cloud...");
});

// ✅ Register Route
app.post("/register", async (req, res) => {
    const { firstName, lastName, username, email, password } = req.body;

    if (!username || !password || !email) {
        return res.json({ success: false, message: "All fields are required" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
        "INSERT INTO users (firstName, lastName, username, email, password) VALUES (?, ?, ?, ?, ?)",
        [firstName, lastName, username, email, hashedPassword],
        (err, result) => {
            if (err) {
                console.error("❌ Error inserting user:", err);
                return res.json({ success: false, message: "User already exists or DB error" });
            }
            res.json({ success: true, message: "Registration successful" });
        }
    );
});

// ✅ Login Route
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
        if (err || results.length === 0) {
            return res.json({ success: false, message: "Invalid username or password" });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.json({ success: false, message: "Invalid username or password" });
        }

        // ✅ Create JWT
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "1h" });

        res.json({ success: true, token });
    });
});

// ✅ Protected Route (for welcome page)
app.get("/profile", (req, res) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ success: false, message: "No token" });

    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: "Invalid token" });

        db.query("SELECT id, username, firstName, lastName, email FROM users WHERE id = ?", [decoded.id], (err, results) => {
            if (err || results.length === 0) {
                return res.json({ success: false, message: "User not found" });
            }
            res.json({ success: true, user: results[0] });
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
