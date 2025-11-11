import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
//import cookieParser from 'cookie-parser';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateToken = (req, res, next) => {
  try {
    // 1) спробувати витягти токен з заголовку
    const authHeader = req.headers["authorization"];
    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    
    if (!token) return res.status(401).json({ message: "Токен відсутній" });

    // 3) верифікуємо
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded) return res.status(401).json({ message: "Недійсний токен або невалідний" });

    // підкладемо payload у req.user
    req.user = decoded;
    next();
  } catch (err) {
    console.error("authMiddleware error:", err);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};
