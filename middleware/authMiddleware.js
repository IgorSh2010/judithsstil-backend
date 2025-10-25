import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
//import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

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
    if (!decoded) return res.status(401).json({ message: "Недійсний токен або невалідний" });

    // підкладемо payload у req.user
    console.log("Authenticated user ID:", decoded.id);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("authMiddleware error:", err);
    return res.status(401).json({ message: "Якісь інші проблеми з токеном" });
  }
};
