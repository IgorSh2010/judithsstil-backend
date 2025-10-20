import jwt from "jsonwebtoken";
import { pool } from  "./dbConn.js";
import dotenv from "dotenv";

dotenv.config();

export const tenantResolver = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // 🔹 Перевіряємо конкретні типи помилок
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token wygasł" });
      }
      if (err.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Nieprawidłowy token" });
      }
      console.error("❌ JWT verification error:", err);
      return res.status(401).json({ message: "Błąd weryfikacji tokenu" });
    }
    
    const tenantId = decoded.tenant;

    if (!tenantId) {
      return res.status(400).json({ message: "No tenant info" });
    }

    // Установка search_path тільки для цього запиту
    req.tenantId = tenantId;

    // Зберігаємо окреме підключення до бази з встановленим search_path
    req.dbClient = await pool.connect();
    await req.dbClient.query(`SET search_path TO ${tenantId}, public;`);

    next();
  } catch (err) {
    console.error("❌ Tenant resolver error:", err);
    res.status(500).json({ message: "Tenant resolution failed" });
  }
};
