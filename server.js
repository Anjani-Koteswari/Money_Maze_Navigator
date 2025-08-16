const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware
app.use(helmet());
app.use(cors({
  origin: "https://money-maze-navigator.onrender.com", 
  credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());

// ✅ Direct Clever Cloud DB credentials
const db = mysql.createConnection({
  host: "bkye9jogrdgovgyqdhf1-mysql.services.clever-cloud.com",
  user: "u2ssz7mhbct9qkak",
  password: "52aT3tAbyryNqkk7rTLZ",
  database: "bkye9jogrdgovgyqdhf1",
  port: 3306
});

// ✅ JWT Secret
const JWT_SECRET = "supersecretkey";

// ✅ Connect to DB
db.connect(err => {
  if (err) {
    console.error("Database connection failed:", err.stack);
    return;
  }
  console.log("✅ Connected to MySQL database.");
});

// ================== ROUTES ================== //

// Register
app.post("/register", async (req, res) => {
  const { first_name, last_name, email, pincode, username, password } = req.body;

  if (!first_name || !last_name || !email || !username || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (first_name, last_name, email, pincode, username, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
    [first_name, last_name, email, pincode, username, hashedPassword],
    (err, result) => {
      if (err) {
        console.error("Error inserting user:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ message: "User registered successfully" });
    }
  );
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) {
      console.error("Login query error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    res.json({ message: "Login successful" });
  });
});

// Protected route
app.get("/welcome", (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid token" });

    res.json({ message: `Welcome, user ID: ${decoded.id}` });
  });
});

// Logout
app.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  res.json({ message: "Logged out successfully" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
