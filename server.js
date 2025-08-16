const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();

// ===== Middleware =====
app.use(bodyParser.json());
app.use(
  cors({
    origin: true, // allow all origins (adjust later if needed)
    credentials: true, // allow sending cookies
  })
);
app.use(cookieParser());

// ===== Serve static frontend =====
app.use(express.static(path.join(__dirname, "public")));

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

// ===== MySQL connection pool (Clever Cloud) =====
const db = mysql.createPool({
  host:
    process.env.MYSQL_ADDON_HOST ||
    "bkye9jogrdgovgyqdhf1-mysql.services.clever-cloud.com",
  user: process.env.MYSQL_ADDON_USER || "u2ssz7mhbct9qkak",
  password: process.env.MYSQL_ADDON_PASSWORD || "52aT3tAbyryNqkk7rTLZ",
  database: process.env.MYSQL_ADDON_DB || "bkye9jogrdgovgyqdhf1",
  port: process.env.MYSQL_ADDON_PORT || 3306,
  connectionLimit: 10,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ MySQL connection failed:", err);
    process.exit(1);
  }
  console.log("✅ MySQL Connected to Clever Cloud...");
  connection.release();
});

// ===== Middleware: verify JWT from cookies =====
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({ success: false, message: "No token" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    req.userId = decoded.userId;
    next();
  });
}

// ===== Register =====
app.post("/register", (req, res) => {
  const { firstName, lastName, email, pincode, username, password } = req.body;
  if (!firstName || !lastName || !email || !pincode || !username || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  const hashedPassword = bcrypt.hashSync(password, 8);

  db.query(
    "SELECT username, email FROM users WHERE username = ? OR email = ?",
    [username, email],
    (err, results) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, message: "Server error" });

      if (results.length > 0) {
        if (results.find((r) => r.username === username)) {
          return res
            .status(400)
            .json({ success: false, message: "Username already exists" });
        }
        if (results.find((r) => r.email === email)) {
          return res
            .status(400)
            .json({ success: false, message: "Email already registered" });
        }
      }

      const user = {
        firstName,
        lastName,
        email,
        pincode,
        username,
        password: hashedPassword,
      };
      db.query("INSERT INTO users SET ?", user, (err) => {
        if (err)
          return res
            .status(500)
            .json({ success: false, message: "Server error" });
        res
          .status(200)
          .json({ success: true, message: "Registration successful" });
      });
    }
  );
});

// ===== Login =====
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
    if (err)
      return res.status(500).json({ success: false, message: "Server error" });
    if (results.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "Username not found" });

    const user = results[0];
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid)
      return res
        .status(401)
        .json({ success: false, message: "Invalid password" });

    // Generate JWT and store in HTTP-only cookie
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // Render uses HTTPS
      sameSite: "none",
      maxAge: 2 * 60 * 60 * 1000,
    });

    res.status(200).json({ success: true, message: "Login successful" });
  });
});

// ===== Get current user =====
app.get("/api/me", verifyToken, (req, res) => {
  db.query(
    "SELECT id, username, email, firstName, lastName FROM users WHERE id = ?",
    [req.userId],
    (err, results) => {
      if (err)
        return res.status(500).json({ success: false, message: "Server error" });
      if (results.length === 0)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      res.json({
        success: true,
        user: results[0],
      });
    }
  );
});

// ===== Logout =====
app.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  res.json({ success: true, message: "Logged out" });
});

/* ========= Budget & Expenses APIs ========= */

// Get user budget
app.get("/api/budget", verifyToken, (req, res) => {
  db.query(
    "SELECT * FROM budgets WHERE user_id = ?",
    [req.userId],
    (err, results) => {
      if (err)
        return res.status(500).json({ success: false, message: "DB error" });
      res.json({ success: true, budget: results });
    }
  );
});

// Add new budget
app.post("/api/budget", verifyToken, (req, res) => {
  const { amount, category } = req.body;
  db.query(
    "INSERT INTO budgets (user_id, amount, category) VALUES (?, ?, ?)",
    [req.userId, amount, category],
    (err) => {
      if (err)
        return res.status(500).json({ success: false, message: "DB error" });
      res.json({ success: true, message: "Budget added" });
    }
  );
});

// Get user expenses
app.get("/api/expenses", verifyToken, (req, res) => {
  db.query(
    "SELECT * FROM expenses WHERE user_id = ?",
    [req.userId],
    (err, results) => {
      if (err)
        return res.status(500).json({ success: false, message: "DB error" });
      res.json({ success: true, expenses: results });
    }
  );
});

// Add new expense
app.post("/api/expenses", verifyToken, (req, res) => {
  const { amount, category, description } = req.body;
  db.query(
    "INSERT INTO expenses (user_id, amount, category, description) VALUES (?, ?, ?, ?)",
    [req.userId, amount, category, description],
    (err) => {
      if (err)
        return res.status(500).json({ success: false, message: "DB error" });
      res.json({ success: true, message: "Expense added" });
    }
  );
});

/* ========================================== */

// ===== Default route (serve login.html) =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ===== Fallback for unknown routes =====
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ===== Start server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
