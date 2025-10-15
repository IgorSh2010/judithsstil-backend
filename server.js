import express from "express";
import cors from "cors";
import { pool } from "./middleware/dbConn.js";
import { authenticateToken } from "./middleware/authMiddleware.js"; 
import authRoutes from "./routes/auth.js"; 
//import userRoutes from "./routes/users.js";
import dotenv from "dotenv";

dotenv.config();

/*
🔹 server.js — тільки точка входу: підняти Express, підключити middleware, маршрути, запустити сервер.
🔹 routes/ — окремі файли для груп ендпойнтів (наприклад auth.js, users.js, products.js).
🔹 controllers/ — бізнес-логіка для кожного ендпойнту (щоб код не був у 5 рівнів вкладеності).
🔹 models/ — доступ до БД (SQL-запити, ORM-моделі, як хочеш).
🔹 middleware/ — наприклад, перевірка JWT чи логування.
*/

const app = express();
app.use(cors());
app.use(express.json());

// Маршрути 
app.use("/api/auth", authRoutes); 
//app.use("/users", userRoutes);

// 🧑‍💻 Отримати поточного користувача
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    // req.user.id — це id користувача з токена
    const result = await pool.query(
      "SELECT id, email, username, tenant, phone, role FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "User not founded!" });

    //  console.log("==== /api/me DEBUG ====");
    //  console.log("JWT_SECRET:", process.env.JWT_SECRET);
    //     // console.log("Incoming token:", token);
    //  console.log("Auth header-middle:", req.headers["authorization"]);
    //  console.log("result:", result.rows[0]);
    //  console.log("==== ========= ====");

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("❌ Помилка при отриманні користувача:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  }
});

// 🔹 Тестовий роут
app.get("/", (req, res) => {
  res.send("Backend API працює ✅🚀");
});

// 🧪 Тестовий ендпоінт
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time;")
    res.json({
      message: "✅ Connected to PostgreSQL!",
      time: result.rows[0].current_time,
    })
  } catch (err) {
    console.error("❌ Database connection error:", err)
    res.status(500).json({ error: "Database connection failed", details: err.message })
  }
})

//app.listen(5000, () => console.log("🚀 Server running on port 5000"))

// 🔹 Запуск сервера
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend API слухає на порту ${PORT}`);
});
