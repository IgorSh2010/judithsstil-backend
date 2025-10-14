import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from 'cookie-parser';

const app = express();
const JWT_SECRET = app.use(cookieParser()); // має збігатися з login

export const authenticateToken = (req, res, next) => {
  try {
    // 1) спробувати витягти токен з заголовку
    const authHeader = req.headers["authorization"];
    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2) якщо немає в заголовку — спробуємо з cookie (якщо використовуєш cookie)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) return res.status(401).json({ message: "Токен відсутній" });

    // 3) верифікуємо
    const decoded = jwt.verify(token, JWT_SECRET);
    // підкладемо payload у req.user
    req.user = decoded;
    next();
  } catch (err) {
    console.error("authMiddleware error:", err);
    return res.status(401).json({ message: "Невалідний або прострочений токен" });
  }
};
