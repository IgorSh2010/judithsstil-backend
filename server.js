import express from "express";
import cors from "cors";
import pkg from "pg";
import bcrypt from "bcrypt";

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Підключення до PostgreSQL (налаштуй під свою базу)
const pool = new Pool({
  user: "dbadmin",
  host: "localhost",   // якщо Express теж на сервері
  database: "maindatabase",
  password: "Igor2025",
  port: 5433,
});

// 🔹 Реєстрація
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email і пароль обов’язкові" });
  }

  try {
    // Перевірка, чи існує вже юзер
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Користувач з таким email вже існує" });
    }

    // Хешування пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Додавання користувача
    const result = await pool.query(
      `INSERT INTO users (email, password) 
       VALUES ($1, $2) RETURNING id, email, created_at`,
      [email, hashedPassword]
    );

    res.status(201).json({
      message: "Реєстрація успішна",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Помилка при реєстрації:", err);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
});

// 🔹 Тестовий роут
app.get("/", (req, res) => {
  res.send("Backend API працює ✅");
});

// 🔹 Запуск сервера
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend API слухає на порту ${PORT}`);
});
