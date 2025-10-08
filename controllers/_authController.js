import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import dotenv from "dotenv";

dotenv.config();

// 🧩 Допоміжна функція для створення токена
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// 📝 Реєстрація
export const register = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email і пароль обов’язкові" });

  try {
    // 🔍 Перевіряємо, чи користувач вже існує
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Користувач з таким email вже існує!" });
    }

    // 🔐 Хешування пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🧠 Додаємо нового користувача
    const result = await pool.query(
      `INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email`,
      [email, hashedPassword]
    );

    const newUser = result.rows[0];
    const token = generateToken(newUser);

    res.status(201).json({
      message: "Реєстрація успішна 🎉",
      user: newUser,
      token,
    });
  } catch (err) {
    console.error("❌ Помилка під час реєстрації:", err);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
};

// 🔑 Логін
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email і пароль обов’язкові" });

  try {
    const result = await pool.query("SELECT id, email, password FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Невірний email або пароль" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ message: "Невірний email або пароль" });
    }

    // 🪄 Генеруємо токен
    const token = generateToken(user);

    res.json({
      message: "Успішний вхід ✅",
      user: { id: user.id, email: user.email },
      token,
    });
  } catch (err) {
    console.error("❌ Помилка під час логіну:", err);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
};

// 👤 Перевірка авторизації (опціонально)
export const getProfile = async (req, res) => {
  try {
    // user додається через middleware після перевірки токена
    const userId = req.user.id;

    const result = await pool.query("SELECT id, email, created_at FROM users WHERE id = $1", [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Помилка при отриманні профілю:", err);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
};
